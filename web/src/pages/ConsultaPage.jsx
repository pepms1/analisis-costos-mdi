import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api/client";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import { formatCurrency, formatDate, formatPercent } from "../utils/formatters";
import { calculateAdjustedPrice, parseInflationByYear } from "../utils/priceAdjustments";

function classifyQuote(adjustedPrice, quote) {
  if (!adjustedPrice || !quote) return null;
  const differencePercent = ((quote - adjustedPrice) / adjustedPrice) * 100;

  if (differencePercent > 12) return { label: "Alto", tone: "high", differencePercent };
  if (differencePercent < -12) return { label: "Bajo", tone: "low", differencePercent };
  return { label: "Lógico", tone: "ok", differencePercent };
}

function toMeters(value, unit = "m") {
  const numericValue = Number(value);
  if (!numericValue) return null;
  return unit === "cm" ? numericValue / 100 : numericValue;
}

function getMeasurementUnit(concept) {
  return concept?.dimensionSchema?.inputUnit || "cm";
}

function isDimensionalConcept(concept) {
  return concept?.requiresDimensions || ["area_based", "linear_based", "height_based"].includes(concept?.calculationType);
}

function normalizeTargetArea(concept, measureInputs) {
  if (!isDimensionalConcept(concept)) return null;
  const unit = getMeasurementUnit(concept);
  const largo = toMeters(measureInputs.largo, unit);
  const ancho = toMeters(measureInputs.ancho, unit);
  if (!largo || !ancho) return null;
  return { quantity: largo * ancho, normalizedUnit: "m2" };
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
    if (!filters.categoryId) return [];
    const term = filters.search.trim().toLowerCase();
    const conceptsByCategory = concepts.filter(
      (concept) => concept.isActive && concept.categoryId === filters.categoryId
    );
    if (!term) return conceptsByCategory.slice(0, 50);

    return conceptsByCategory
      .filter((concept) => concept.name.toLowerCase().includes(term))
      .slice(0, 50);
  }, [concepts, filters.categoryId, filters.search]);

  const { inflationSetting, inflationByYear, inflationYears } = useMemo(() => parseInflationByYear(adjustments), [adjustments]);
  const selectedConcept = useMemo(
    () => concepts.find((concept) => concept.id === filters.conceptId) || null,
    [concepts, filters.conceptId]
  );
  const requiresDimensions = Boolean(selectedConcept && isDimensionalConcept(selectedConcept));

  const pricingSummary = useMemo(
    () => calculateAdjustedPrice(records, inflationByYear),
    [records, inflationByYear]
  );
  const recordsWithAdjusted = pricingSummary.entries;
  const latestRecord = pricingSummary.latestRecord;
  const firstRecord = pricingSummary.oldestRecord;

  const dimensionalReferenceRecord = useMemo(
    () =>
      recordsWithAdjusted.find(
        (item) => Number(item.normalizedPrice) > 0 && Number(item.normalizedQuantity) > 0
      ) || null,
    [recordsWithAdjusted]
  );

  const baseRecord = requiresDimensions ? dimensionalReferenceRecord : latestRecord;
  const adjustedHeadlinePrice = pricingSummary.adjustedAverage;
  const targetMeasure = useMemo(() => normalizeTargetArea(selectedConcept, measureInputs), [selectedConcept, measureInputs]);

  const normalizedPricingSummary = useMemo(
    () => calculateAdjustedPrice(records, inflationByYear, { amountField: "normalizedPrice" }),
    [records, inflationByYear]
  );
  const adjustedNormalizedPrice = normalizedPricingSummary.adjustedAverage;

  const estimatedComparablePrice =
    requiresDimensions
      ? adjustedNormalizedPrice && targetMeasure?.quantity
        ? adjustedNormalizedPrice * targetMeasure.quantity
        : null
      : adjustedHeadlinePrice;

  const quoteEvaluation = classifyQuote(estimatedComparablePrice, Number(todayQuote));
  const inflationLabel = inflationYears.length
    ? `Actualizado al último índice disponible (${pricingSummary.targetYear})`
    : "Sin inflación configurada";
  const inflationCoverageLabel = pricingSummary.inflationMissingYears.length
    ? `Faltan índices: ${pricingSummary.inflationMissingYears.join(", ")}`
    : `Serie inflacionaria usada: ${inflationYears[0] || pricingSummary.targetYear}–${pricingSummary.targetYear}`;

  return (
    <section className="page-shell">
      <PageHeader
        title="Consulta"
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
            placeholder={filters.categoryId ? "Ej. block hueco 12x20x40" : "Primero selecciona una categoría"}
            disabled={!filters.categoryId}
          />
        </label>

        <label className="field">
          <span>Selecciona un concepto</span>
          <select
            value={filters.conceptId}
            onChange={(event) => setFilters((prev) => ({ ...prev, conceptId: event.target.value }))}
            disabled={!filters.categoryId}
          >
            <option value="">
              {filters.categoryId ? "Selecciona un concepto" : "Selecciona una categoría primero"}
            </option>
            {filteredConcepts.map((concept) => (
              <option key={concept.id} value={concept.id}>
                {concept.name}
              </option>
            ))}
          </select>
        </label>

        {requiresDimensions ? (
          <>
            <label className="field">
              <span>Largo ({getMeasurementUnit(selectedConcept)})</span>
              <input
                type="number"
                step="0.01"
                value={measureInputs.largo}
                onChange={(event) => setMeasureInputs((prev) => ({ ...prev, largo: event.target.value }))}
                placeholder="0.00"
              />
            </label>
            <label className="field">
              <span>Ancho ({getMeasurementUnit(selectedConcept)})</span>
              <input
                type="number"
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

      <div className="content-grid wide-grid">
        <DataTable
          columns={[
            { key: "priceDate", label: "Fecha", render: (value) => formatDate(value) },
            { key: "supplierName", label: "Proveedor" },
            { key: "projectName", label: "Obra" },
            { key: "amount", label: "Precio histórico", render: (value) => formatCurrency(value) },
            { key: "adjustedAmount", label: "Precio ajustado", render: (value) => formatCurrency(value) },
            { key: "dimensions", label: "Medida base", render: (value) => formatDimensions(value) },
            {
              key: "normalizedQuantity",
              label: "Área base",
              render: (value) => (value ? `${value.toFixed(3)} m2` : "—"),
            },
            { key: "normalizedPrice", label: "Precio por m²", render: (value) => formatCurrency(value) },
          ]}
          rows={recordsWithAdjusted}
          emptyLabel="Selecciona un concepto para ver su histórico"
        />

        <div className="card form-grid">
          <h3>Chequeo rápido de cotización</h3>
          {requiresDimensions ? (
            <div className="details-block">
              <p className="muted">Medida histórica base: {formatDimensions(baseRecord?.dimensions)}</p>
              <p className="muted">Área histórica base: {baseRecord?.normalizedQuantity ? `${baseRecord.normalizedQuantity.toFixed(3)} m2` : "—"}</p>
              <p className="muted">Medida nueva: Largo {measureInputs.largo || "—"} · Ancho {measureInputs.ancho || "—"}</p>
              <p className="muted">Área nueva: {targetMeasure?.quantity ? `${targetMeasure.quantity.toFixed(3)} m2` : "—"}</p>
              <p className="muted">Base ajustada por m²: {formatCurrency(adjustedNormalizedPrice)}</p>
            </div>
          ) : null}
          <label className="field">
            <span>Precio cotizado hoy</span>
            <input
              type="number"
              step="0.01"
              value={todayQuote}
              onChange={(event) => setTodayQuote(event.target.value)}
              placeholder="0.00"
            />
          </label>

          <div className={`alert ${quoteEvaluation?.tone === "high" || quoteEvaluation?.tone === "low" ? "error" : ""}`}>
            <strong>Resultado:</strong> {quoteEvaluation?.label || "Captura un precio para evaluar"}
            <p className="muted">Diferencia: {quoteEvaluation ? formatPercent(quoteEvaluation.differencePercent) : "—"}</p>
            <p className="muted">Base de comparación: {formatCurrency(estimatedComparablePrice)}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ConsultaPage;
