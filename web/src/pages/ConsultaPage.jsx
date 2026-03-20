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

function ConsultaPage() {
  const [concepts, setConcepts] = useState([]);
  const [records, setRecords] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [filters, setFilters] = useState({ search: "", conceptId: "" });
  const [todayQuote, setTodayQuote] = useState("");

  useEffect(() => {
    Promise.all([apiRequest("/concepts"), apiRequest("/adjustments")])
      .then(([conceptsData, adjustmentsData]) => {
        setConcepts(conceptsData.items || []);
        setAdjustments(adjustmentsData.items || []);
      })
      .catch(() => {
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

  const filteredConcepts = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    if (!term) return concepts.slice(0, 25);

    return concepts
      .filter((concept) => concept.isActive && concept.name.toLowerCase().includes(term))
      .slice(0, 25);
  }, [concepts, filters.search]);

  const { inflationSetting, inflationByYear } = useMemo(() => normalizeInflation(adjustments), [adjustments]);

  const recordsWithAdjusted = useMemo(
    () =>
      records.map((item) => ({
        ...item,
        adjustedAmount: adjustedPriceWithInflation(item.amount, item.priceDate, inflationByYear),
      })),
    [records, inflationByYear]
  );

  const latestRecord = recordsWithAdjusted[0];
  const latestAdjusted = latestRecord?.adjustedAmount || null;
  const gap = latestAdjusted && latestRecord?.amount ? latestAdjusted - latestRecord.amount : null;
  const quoteEvaluation = classifyQuote(latestAdjusted, Number(todayQuote));

  return (
    <section className="page-shell">
      <PageHeader
        title="Consulta"
        description="Busca un concepto, revisa su histórico y compáralo contra inflación en una sola vista."
      />

      <div className="card form-grid compact-form">
        <label className="field">
          <span>Buscar concepto</span>
          <input
            value={filters.search}
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            placeholder="Ej. block hueco 12x20x40"
          />
        </label>

        <label className="field">
          <span>Selecciona un concepto</span>
          <select
            value={filters.conceptId}
            onChange={(event) => setFilters((prev) => ({ ...prev, conceptId: event.target.value }))}
          >
            <option value="">Selecciona un concepto</option>
            {filteredConcepts.map((concept) => (
              <option key={concept.id} value={concept.id}>
                {concept.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="stats-grid stats-grid-main">
        <div className="card stat-card">
          <p className="eyebrow">Último precio</p>
          <h3>{formatCurrency(latestRecord?.amount)}</h3>
          <p className="muted">Fecha: {formatDate(latestRecord?.priceDate)}</p>
        </div>
        <div className="card stat-card">
          <p className="eyebrow">Precio estimado actual</p>
          <h3>{formatCurrency(latestAdjusted)}</h3>
          <p className="muted">Inflación activa: {inflationSetting?.name || "Sin configurar"}</p>
        </div>
        <div className="card stat-card">
          <p className="eyebrow">Diferencia histórica vs actual</p>
          <h3>{formatCurrency(gap)}</h3>
          <p className="muted">{gap !== null && latestRecord?.amount ? formatPercent((gap / latestRecord.amount) * 100) : "—"}</p>
        </div>
        <div className="card stat-card">
          <p className="eyebrow">Referencia reciente</p>
          <h3>{latestRecord?.supplierName || "—"}</h3>
          <p className="muted">Obra: {latestRecord?.projectName || "—"}</p>
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
            { key: "observations", label: "Observaciones" },
          ]}
          rows={recordsWithAdjusted}
          emptyLabel="Selecciona un concepto para ver su histórico"
        />

        <div className="card form-grid">
          <h3>Chequeo rápido de cotización</h3>
          <p className="muted">"Me cotizaron hoy en..." para validar rápidamente contra el valor ajustado.</p>
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
            <p className="muted">
              Diferencia: {quoteEvaluation ? formatPercent(quoteEvaluation.differencePercent) : "—"}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ConsultaPage;
