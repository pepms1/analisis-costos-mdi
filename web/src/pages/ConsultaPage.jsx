import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api/client";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import { formatCurrency, formatDate, formatPercent } from "../utils/formatters";

function normalizeInflation(adjustments) {
  const inflationSetting = adjustments.find(
    (item) => item.adjustmentType === "inflation" && item.scopeType === "general" && item.isActive
  );

  const inflationByYear = Object.fromEntries(
    (inflationSetting?.factors || [])
      .map((factor) => {
        const year = Number(factor.label);
        if (!Number.isInteger(year)) return null;
        return [year, Number(factor.factor) - 1];
      })
      .filter(Boolean)
  );

  return {
    inflationSetting,
    inflationByYear,
  };
}

function adjustedPriceWithInflation(baseAmount, fromDate, inflationByYear) {
  if (!baseAmount || !fromDate) return null;
  const startYear = new Date(fromDate).getUTCFullYear();
  const currentYear = new Date().getUTCFullYear();

  let factor = 1;
  for (let year = startYear + 1; year <= currentYear; year += 1) {
    factor *= 1 + Number(inflationByYear[year] || 0);
  }

  return Number(baseAmount) * factor;
}

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

  const { inflationSetting, inflationByYear } = useMemo(() => normalizeInflation(adjustments), [adjustments]);
  const selectedConcept = useMemo(
    () => concepts.find((concept) => concept.id === filters.conceptId) || null,
    [concepts, filters.conceptId]
  );
  const requiresDimensions = Boolean(selectedConcept && isDimensionalConcept(selectedConcept));

  const recordsWithAdjusted = useMemo(
    () =>
      records.map((item) => ({
        ...item,
        adjustedAmount: adjustedPriceWithInflation(item.amount, item.priceDate, inflationByYear),
      })),
    [records, inflationByYear]
  );

  const latestRecord = recordsWithAdjusted[0] || null;
  const dimensionalReferenceRecord = useMemo(
    () =>
      recordsWithAdjusted.find(
        (item) => Number(item.normalizedPrice) > 0 && Number(item.normalizedQuantity) > 0
      ) || null,
    [recordsWithAdjusted]
  );

  const baseRecord = requiresDimensions ? dimensionalReferenceRecord : latestRecord;
  const latestAdjusted = baseRecord?.adjustedAmount || null;
  const targetMeasure = useMemo(() => normalizeTargetArea(selectedConcept, measureInputs), [selectedConcept, measureInputs]);

  const adjustedNormalizedPrice =
    requiresDimensions && baseRecord?.normalizedPrice
      ? adjustedPriceWithInflation(baseRecord.normalizedPrice, baseRecord.priceDate, inflationByYear)
      : null;

  const estimatedComparablePrice =
    requiresDimensions
      ? adjustedNormalizedPrice && targetMeasure?.quantity
        ? adjustedNormalizedPrice * targetMeasure.quantity
        : null
      : latestAdjusted;

  const quoteEvaluation = classifyQuote(estimatedComparablePrice, Number(todayQuote));

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

      <div className="stats-grid stats-grid-main">
        <div className="card stat-card">
          <p className="eyebrow">Medida histórica base</p>
          <h3>{formatDimensions(baseRecord?.dimensions)}</h3>
          <p className="muted">Área histórica base: {baseRecord?.normalizedQuantity ? `${baseRecord.normalizedQuantity.toFixed(3)} m2` : "—"}</p>
        </div>
        <div className="card stat-card">
          <p className="eyebrow">Medida nueva</p>
          <h3>{requiresDimensions ? `Largo ${measureInputs.largo || "—"} · Ancho ${measureInputs.ancho || "—"}` : "No aplica"}</h3>
          <p className="muted">Área nueva: {targetMeasure?.quantity ? `${targetMeasure.quantity.toFixed(3)} m2` : "—"}</p>
        </div>
        <div className="card stat-card">
          <p className="eyebrow">Precio histórico</p>
          <h3>{formatCurrency(baseRecord?.amount)}</h3>
          <p className="muted">Fecha: {formatDate(baseRecord?.priceDate)}</p>
        </div>
        <div className="card stat-card">
          <p className="eyebrow">Precio ajustado</p>
          <h3>{formatCurrency(latestAdjusted)}</h3>
          <p className="muted">Inflación activa: {inflationSetting?.name || "Sin configurar"}</p>
        </div>
        <div className="card stat-card">
          <p className="eyebrow">Precio proporcional estimado</p>
          <h3>{formatCurrency(estimatedComparablePrice)}</h3>
          <p className="muted">Base por m²: {formatCurrency(adjustedNormalizedPrice)}</p>
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
