import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api/client";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import { formatCurrency, formatDate, formatPercent } from "../utils/formatters";
import { calculateAdjustedPrice, parseInflationByYear } from "../utils/priceAdjustments";

function classifyQuote(adjustedPrice, quote) {
  if (!Number.isFinite(adjustedPrice) || adjustedPrice <= 0 || !Number.isFinite(quote) || quote <= 0) return null;
  const differencePercent = ((quote - adjustedPrice) / adjustedPrice) * 100;

  if (differencePercent > 12) return { label: "Arriba de rango", tone: "high", differencePercent };
  if (differencePercent < -12) return { label: "Abajo de rango", tone: "low", differencePercent };
  return { label: "Dentro de rango", tone: "ok", differencePercent };
}

function normalizeNumericInput(rawValue) {
  return String(rawValue ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(";", ",");
}

function parseDecimalInput(rawValue) {
  const normalizedValue = normalizeNumericInput(rawValue);
  if (!normalizedValue) return null;
  if (!/^[-+]?\d*([.,]\d*)?$/.test(normalizedValue)) return null;
  if (/[.,]$/.test(normalizedValue)) return null;

  const parsedValue = Number(normalizedValue.replace(",", "."));
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function toMeters(value, unit = "m") {
  const numericValue = parseDecimalInput(value);
  if (!(numericValue > 0)) return null;
  return unit === "cm" ? numericValue / 100 : numericValue;
}

function getMeasurementUnit(concept) {
  return concept?.dimensionSchema?.inputUnit || "cm";
}

function normalizeAnalysisUnit(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s/g, "")
    .replace("²", "2");
}

function isAreaAnalysisUnit(value) {
  const normalized = normalizeAnalysisUnit(value);
  return ["m2", "mt2", "sqm", "m^2"].includes(normalized);
}

function isDimensionalConcept(concept) {
  return (
    concept?.requiresDimensions ||
    ["area_based", "linear_based", "height_based"].includes(concept?.calculationType) ||
    isAreaAnalysisUnit(concept?.analysisUnit) ||
    isAreaAnalysisUnit(concept?.applicationUnit)
  );
}

function toPositiveNumber(value) {
  const numericValue = parseDecimalInput(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null;
}

function resolveRecordAreaM2(item) {
  const normalizedQuantity = toPositiveNumber(item?.normalizedQuantity);
  if (normalizedQuantity) return normalizedQuantity;

  const geometryArea = toPositiveNumber(item?.geometryMeta?.areaM2);
  if (geometryArea) return geometryArea;

  const measurementUnit = item?.dimensions?.measurementUnit || "m";
  const largo = toMeters(item?.dimensions?.largo ?? item?.dimensions?.length, measurementUnit);
  const ancho = toMeters(item?.dimensions?.ancho ?? item?.dimensions?.height ?? item?.dimensions?.width, measurementUnit);
  return largo && ancho ? largo * ancho : null;
}

function resolveHistoricalPricePerM2(item) {
  const analysisUnitPrice = toPositiveNumber(item?.analysisUnitPrice);
  if (isAreaAnalysisUnit(item?.analysisUnit) && analysisUnitPrice) return analysisUnitPrice;

  const areaM2 = resolveRecordAreaM2(item);
  if (!areaM2) return null;

  const totalPrice = toPositiveNumber(item?.totalPrice) || toPositiveNumber(item?.amount);
  if (!totalPrice) return null;

  return totalPrice / areaM2;
}

function normalizeTargetArea({ concept, measureInputs, requiresDimensions }) {
  if (!requiresDimensions) return null;
  const unit = getMeasurementUnit(concept);
  const largo = toMeters(measureInputs.largo, unit);
  const ancho = toMeters(measureInputs.ancho, unit);
  if (!largo || !ancho) return null;
  const quantity = largo * ancho;
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  return { quantity, normalizedUnit: "m2" };
}

function formatDimensions(dimensions) {
  if (!dimensions) return "—";
  const largo = dimensions.largo ?? dimensions.length ?? dimensions.width;
  const ancho = dimensions.ancho ?? dimensions.height ?? dimensions.width;
  if (!largo && !ancho) return "—";
  return `Largo: ${largo || "—"} · Ancho: ${ancho || "—"} ${dimensions.measurementUnit || "cm"}`;
}

function ConsultaPage() {
  const [categories, setCategories] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [records, setRecords] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [filters, setFilters] = useState({ categoryId: "", search: "", conceptId: "" });
  const [todayQuote, setTodayQuote] = useState("");
  const [measureInputs, setMeasureInputs] = useState({ largo: "", ancho: "" });

  useEffect(() => {
    Promise.all([apiRequest("/categories"), apiRequest("/concepts"), apiRequest("/adjustments")])
      .then(([categoriesData, conceptsData, adjustmentsData]) => {
        setCategories(categoriesData.items || []);
        setConcepts(conceptsData.items || []);
        setAdjustments(adjustmentsData.items || []);
      })
      .catch(() => {
        setCategories([]);
        setConcepts([]);
        setAdjustments([]);
      });
  }, []);

  useEffect(() => {
    if (!filters.conceptId) {
      setRecords([]);
      return;
    }

    apiRequest(`/price-records?conceptId=${filters.conceptId}`)
      .then((data) => setRecords(data.items || []))
      .catch(() => setRecords([]));
  }, [filters.conceptId]);

  useEffect(() => {
    setFilters((prev) => ({ ...prev, conceptId: "" }));
    setMeasureInputs({ largo: "", ancho: "" });
    setTodayQuote("");
  }, [filters.categoryId]);

  const filteredConcepts = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    const activeConcepts = concepts.filter((concept) => concept.isActive);
    const categoryScopedConcepts = filters.categoryId
      ? activeConcepts.filter((concept) => concept.categoryId === filters.categoryId)
      : activeConcepts;

    if (!filters.categoryId && !term) return [];

    const conceptMatches = term
      ? categoryScopedConcepts.filter((concept) => concept.name.toLowerCase().includes(term))
      : categoryScopedConcepts;

    return conceptMatches
      .sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();

        const aStartsWith = term ? aName.startsWith(term) : false;
        const bStartsWith = term ? bName.startsWith(term) : false;

        if (aStartsWith !== bStartsWith) return aStartsWith ? -1 : 1;
        return aName.localeCompare(bName, "es");
      })
      .slice(0, 50);
  }, [concepts, filters.categoryId, filters.search]);

  const { inflationSetting, inflationByYear, inflationYears } = useMemo(() => parseInflationByYear(adjustments), [adjustments]);
  const selectedConcept = useMemo(() => {
    if (!filters.conceptId) return null;
    return (
      concepts.find((concept) => String(concept.id || concept._id) === String(filters.conceptId)) || null
    );
  }, [concepts, filters.conceptId]);
  const hasAreaReference = useMemo(
    () =>
      records.some(
        (item) =>
          isAreaAnalysisUnit(item?.analysisUnit) ||
          isAreaAnalysisUnit(item?.normalizedUnit) ||
          (Number(item?.normalizedPrice) > 0 && Number(item?.normalizedQuantity) > 0)
      ),
    [records]
  );

  const requiresDimensions = Boolean(selectedConcept && (isDimensionalConcept(selectedConcept) || hasAreaReference));

  const pricingSummary = useMemo(
    () => calculateAdjustedPrice(records, inflationByYear),
    [records, inflationByYear]
  );
  const recordsWithAdjusted = pricingSummary.entries;
  const latestRecord = pricingSummary.latestRecord;
  const firstRecord = pricingSummary.oldestRecord;

  const recordsWithDerivedMetrics = useMemo(
    () =>
      recordsWithAdjusted.map((item) => {
        const areaM2 = resolveRecordAreaM2(item);
        return {
          ...item,
          resolvedAreaM2: areaM2,
          historicalPricePerM2: resolveHistoricalPricePerM2(item),
        };
      }),
    [recordsWithAdjusted]
  );

  const dimensionalReferenceRecord = useMemo(
    () =>
      recordsWithDerivedMetrics.find(
        (item) => Number(item.historicalPricePerM2) > 0 && Number(item.resolvedAreaM2) > 0
      ) || null,
    [recordsWithDerivedMetrics]
  );

  const baseRecord = requiresDimensions ? dimensionalReferenceRecord : latestRecord;
  const adjustedHeadlinePrice = pricingSummary.adjustedAverage;
  const targetMeasure = useMemo(
    () => normalizeTargetArea({ concept: selectedConcept, measureInputs, requiresDimensions }),
    [selectedConcept, measureInputs, requiresDimensions]
  );

  const normalizedPricingSummary = useMemo(
    () => calculateAdjustedPrice(recordsWithDerivedMetrics, inflationByYear, { amountField: "historicalPricePerM2" }),
    [recordsWithDerivedMetrics, inflationByYear]
  );
  const adjustedNormalizedPrice = normalizedPricingSummary.adjustedAverage;
  const quotedTotalPrice = parseDecimalInput(todayQuote);
  const hasValidTargetArea = Number.isFinite(targetMeasure?.quantity) && targetMeasure.quantity > 0;
  const hasValidQuotedTotalPrice = Number.isFinite(quotedTotalPrice) && quotedTotalPrice > 0;
  const hasValidAdjustedNormalizedPrice = Number.isFinite(adjustedNormalizedPrice) && adjustedNormalizedPrice > 0;
  const hasValidAdjustedHeadlinePrice = Number.isFinite(adjustedHeadlinePrice) && adjustedHeadlinePrice > 0;
  const quotedPricePerM2 =
    requiresDimensions && hasValidTargetArea && hasValidQuotedTotalPrice
      ? quotedTotalPrice / targetMeasure.quantity
      : null;

  const estimatedComparablePrice =
    requiresDimensions
      ? hasValidAdjustedNormalizedPrice && hasValidTargetArea
        ? adjustedNormalizedPrice * targetMeasure.quantity
        : null
      : hasValidAdjustedHeadlinePrice
        ? adjustedHeadlinePrice
        : null;

  const comparisonBase = requiresDimensions
    ? hasValidAdjustedNormalizedPrice
      ? adjustedNormalizedPrice
      : null
    : estimatedComparablePrice;
  const comparableQuote = requiresDimensions ? quotedPricePerM2 : quotedTotalPrice;
  const quoteEvaluation = classifyQuote(comparisonBase, comparableQuote);
  const inflationLabel = inflationYears.length
    ? `Actualizado al último índice disponible (${pricingSummary.targetYear})`
    : "Sin inflación configurada";
  const inflationCoverageLabel = pricingSummary.inflationMissingYears.length
    ? `Faltan índices: ${pricingSummary.inflationMissingYears.join(", ")}`
    : `Serie inflacionaria usada: ${inflationYears[0] || pricingSummary.targetYear}–${pricingSummary.targetYear}`;

  return (
    <section className="page-shell">
      <PageHeader
        title="Análisis"
        description="Busca un concepto, revisa su histórico y compáralo contra inflación en una sola vista."
      />

      <div className="card form-grid compact-form">
        <label className="field">
          <span>Selecciona una categoría</span>
          <select
            value={filters.categoryId}
            onChange={(event) => setFilters((prev) => ({ ...prev, categoryId: event.target.value }))}
          >
            <option value="">Selecciona una categoría</option>
            {categories.map((category) => (
              <option key={category.id || category._id} value={category.id || category._id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Buscar concepto</span>
          <input
            value={filters.search}
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            placeholder={
              filters.categoryId
                ? "Ej. block hueco 12x20x40"
                : "Escribe para buscar en todos los conceptos"
            }
          />
        </label>

        <label className="field">
          <span>Selecciona un concepto</span>
          <select
            value={filters.conceptId}
            onChange={(event) => setFilters((prev) => ({ ...prev, conceptId: event.target.value }))}
          >
            <option value="">
              {filters.categoryId
                ? "Selecciona un concepto"
                : filters.search.trim()
                  ? "Selecciona un concepto"
                  : "Escribe para buscar un concepto"}
            </option>
            {filteredConcepts.map((concept) => (
              <option key={concept.id || concept._id} value={concept.id || concept._id}>
                {concept.name} · {concept.categoryName || "Sin categoría"}
              </option>
            ))}
          </select>
        </label>

        {requiresDimensions ? (
          <>
            <label className="field">
              <span>Largo ({getMeasurementUnit(selectedConcept)})</span>
              <input
                type="text"
                inputMode="decimal"
                step="0.01"
                value={measureInputs.largo}
                onChange={(event) => setMeasureInputs((prev) => ({ ...prev, largo: event.target.value }))}
                placeholder="0.00"
              />
            </label>
            <label className="field">
              <span>Ancho ({getMeasurementUnit(selectedConcept)})</span>
              <input
                type="text"
                inputMode="decimal"
                step="0.01"
                value={measureInputs.ancho}
                onChange={(event) => setMeasureInputs((prev) => ({ ...prev, ancho: event.target.value }))}
                placeholder="0.00"
              />
            </label>
          </>
        ) : null}
      </div>

      <div className="stats-grid stats-grid-main consulta-summary-grid">
        <div className="card stat-card highlight-card consulta-hero-card">
          <p className="eyebrow">Precio ajustado</p>
          <h3>{formatCurrency(adjustedHeadlinePrice)}</h3>
          <p className="muted stat-subtitle">{inflationLabel}</p>
          <p className="muted stat-meta">{pricingSummary.validEntries.length ? `${pricingSummary.validEntries.length} registros válidos` : "Sin registros válidos"}</p>
        </div>
        <div className="card stat-card consulta-secondary-card">
          <p className="eyebrow">
            <span className="label-desktop">Último precio registrado</span>
            <span className="label-mobile">Último precio</span>
          </p>
          <h3>{formatCurrency(latestRecord?.amount)}</h3>
          <p className="muted stat-meta">Fecha: {formatDate(latestRecord?.priceDate)}</p>
          <p className="muted stat-meta">Prov: {latestRecord?.supplierName || "—"}</p>
        </div>
        <div className="card stat-card consulta-secondary-card">
          <p className="eyebrow">
            <span className="label-desktop">Primer precio registrado</span>
            <span className="label-mobile">Primer precio</span>
          </p>
          <h3>{formatCurrency(firstRecord?.amount)}</h3>
          <p className="muted stat-meta">Fecha: {formatDate(firstRecord?.priceDate)}</p>
          <p className="muted stat-meta">Prov: {firstRecord?.supplierName || "—"}</p>
        </div>
        <div className="card stat-card consulta-secondary-card">
          <p className="eyebrow">
            <span className="label-desktop">Precio promedio</span>
            <span className="label-mobile">Promedio</span>
          </p>
          <h3>{formatCurrency(pricingSummary.nominalAverage)}</h3>
          <p className="muted stat-meta">
            Registros: {pricingSummary.stats.validRecords}/{pricingSummary.stats.totalRecords}
          </p>
          <p className="muted stat-meta">Nominal simple</p>
        </div>
        <div className="card stat-card consulta-secondary-card">
          <p className="eyebrow">
            <span className="label-desktop">Inflación aplicada</span>
            <span className="label-mobile">Inflación</span>
          </p>
          <h3>{inflationSetting?.name || "Sin configuración activa"}</h3>
          <p className="muted stat-meta">{inflationCoverageLabel}</p>
          <p className="muted stat-meta">Base: índice {pricingSummary.targetYear}</p>
        </div>
      </div>

      <div className="card form-grid consulta-quick-check">
        <h3>Chequeo rápido de cotización</h3>
        {requiresDimensions ? (
          <div className="details-block">
            <p className="muted">Medida histórica base: {formatDimensions(baseRecord?.dimensions)}</p>
            <p className="muted">
              Área histórica base: {Number.isFinite(baseRecord?.resolvedAreaM2) && baseRecord.resolvedAreaM2 > 0 ? `${baseRecord.resolvedAreaM2.toFixed(3)} m2` : "—"}
            </p>
            <p className="muted">Base de comparación usada: Precio ajustado por m²</p>
            <p className="muted">Referencia ajustada por m²: {formatCurrency(adjustedNormalizedPrice)}</p>
          </div>
        ) : null}
        {requiresDimensions ? (
          <>
            <div className="subgrid consulta-quick-check-inputs">
              <label className="field">
                <span>Largo cotizado hoy ({getMeasurementUnit(selectedConcept)})</span>
                <input
                  type="text"
                  inputMode="decimal"
                  step="0.01"
                  value={measureInputs.largo}
                  onChange={(event) => setMeasureInputs((prev) => ({ ...prev, largo: event.target.value }))}
                  placeholder="0.00"
                />
              </label>
              <label className="field">
                <span>Ancho cotizado hoy ({getMeasurementUnit(selectedConcept)})</span>
                <input
                  type="text"
                  inputMode="decimal"
                  step="0.01"
                  value={measureInputs.ancho}
                  onChange={(event) => setMeasureInputs((prev) => ({ ...prev, ancho: event.target.value }))}
                  placeholder="0.00"
                />
              </label>
              <label className="field">
                <span>Precio cotizado hoy (total)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  step="0.01"
                  value={todayQuote}
                  onChange={(event) => setTodayQuote(event.target.value)}
                  placeholder="0.00"
                />
              </label>
            </div>
            <p className="muted">Cálculo automático al escribir (sin botón de procesar).</p>
            <div className="details-block">
              <p className="muted">Área calculada: {hasValidTargetArea ? `${targetMeasure.quantity.toFixed(3)} m2` : "—"}</p>
              <p className="muted">Precio cotizado por m²: {Number.isFinite(quotedPricePerM2) ? formatCurrency(quotedPricePerM2) : "—"}</p>
              <p className="muted">Base de comparación: {formatCurrency(comparisonBase)} por m²</p>
              <p className="muted">
                Diferencia: {quoteEvaluation ? formatPercent(quoteEvaluation.differencePercent) : "—"}
              </p>
            </div>
          </>
        ) : (
          <label className="field">
            <span>Precio cotizado hoy</span>
            <input
              type="text"
              inputMode="decimal"
              step="0.01"
              value={todayQuote}
              onChange={(event) => setTodayQuote(event.target.value)}
              placeholder="0.00"
            />
          </label>
        )}

        <div className={`alert ${quoteEvaluation?.tone === "high" || quoteEvaluation?.tone === "low" ? "error" : ""}`}>
          <strong>Conclusión:</strong> {quoteEvaluation?.label || "Captura medidas y precio para evaluar"}
          <p className="muted">Diferencia: {quoteEvaluation ? formatPercent(quoteEvaluation.differencePercent) : "—"}</p>
          <p className="muted">
            Base de comparación: {formatCurrency(comparisonBase)} {requiresDimensions ? "por m²" : "(total)"}
          </p>
          {requiresDimensions ? (
            <p className="muted">Comparativo total estimado para el área capturada: {formatCurrency(estimatedComparablePrice)}</p>
          ) : null}
        </div>
      </div>

      <div className="content-grid consulta-history-grid">
        <DataTable
          columns={[
            { key: "priceDate", label: "Fecha", render: (value) => formatDate(value) },
            { key: "supplierName", label: "Proveedor" },
            { key: "projectName", label: "Obra" },
            { key: "amount", label: "Precio histórico", render: (value) => formatCurrency(value) },
            { key: "adjustedAmount", label: "Precio ajustado", render: (value) => formatCurrency(value) },
            { key: "dimensions", label: "Medida base", render: (value) => formatDimensions(value) },
            {
              key: "resolvedAreaM2",
              label: "Área base",
              render: (value) => (Number.isFinite(value) && value > 0 ? `${value.toFixed(3)} m2` : "—"),
            },
            { key: "historicalPricePerM2", label: "Precio por m²", render: (value) => formatCurrency(value) },
          ]}
          rows={recordsWithDerivedMetrics}
          emptyLabel="Selecciona un concepto para ver su histórico"
        />
      </div>
    </section>
  );
}

export default ConsultaPage;
