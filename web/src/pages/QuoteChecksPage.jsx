import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api/client";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import { formatCurrency, formatPercent } from "../utils/formatters";

const initialForm = {
  conceptId: "",
  supplierId: "",
  quotedPrice: "",
  targetDate: new Date().toISOString().slice(0, 10),
  largo: "",
  ancho: "",
  measurementUnit: "cm",
};

function formatDimensions(dimensions) {
  if (!dimensions) return "—";
  const largo = dimensions.largo ?? dimensions.length ?? dimensions.width;
  const ancho = dimensions.ancho ?? dimensions.height ?? dimensions.width;
  return `L: ${largo || "—"} · A: ${ancho || "—"} ${dimensions.measurementUnit || "cm"}`;
}

function QuoteChecksPage() {
  const [items, setItems] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState(initialForm);

  const selectedConcept = useMemo(() => concepts.find((concept) => concept.id === form.conceptId), [concepts, form.conceptId]);
  const requiresDimensions = Boolean(
    selectedConcept &&
      (selectedConcept.requiresDimensions || ["area_based", "linear_based", "height_based"].includes(selectedConcept.calculationType))
  );

  async function loadPage() {
    const [checksData, conceptsData, suppliersData] = await Promise.all([
      apiRequest("/quote-checks"),
      apiRequest("/concepts"),
      apiRequest("/suppliers"),
    ]);

    setItems(checksData.items);
    setConcepts(conceptsData.items);
    setSuppliers(suppliersData.items);
  }

  useEffect(() => {
    loadPage().catch(() => {
      setItems([]);
      setConcepts([]);
      setSuppliers([]);
    });
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();

    await apiRequest("/quote-checks", {
      method: "POST",
      body: JSON.stringify({
        conceptId: form.conceptId,
        supplierId: form.supplierId || null,
        quotedPrice: Number(form.quotedPrice),
        targetDate: form.targetDate,
        dimensions: requiresDimensions
          ? {
              measurementUnit: form.measurementUnit,
              largo: Number(form.largo),
              ancho: Number(form.ancho),
              width: Number(form.largo),
              height: Number(form.ancho),
            }
          : undefined,
      }),
    });

    setForm(initialForm);
    await loadPage();
  }

  return (
    <section>
      <PageHeader title="Comparativos" description="Comparativo proporcional por m² contra histórico ajustado." />

      <div className="content-grid">
        <form className="card form-grid" onSubmit={handleSubmit}>
          <h3>Nuevo comparativo</h3>
          <label className="field">
            <span>Concepto</span>
            <select value={form.conceptId} onChange={(e) => setForm({ ...form, conceptId: e.target.value })} required>
              <option value="">Selecciona un concepto</option>
              {concepts.map((concept) => (
                <option key={concept.id} value={concept.id}>
                  {concept.name}
                </option>
              ))}
            </select>
          </label>
          {requiresDimensions ? (
            <div className="subgrid">
              <label className="field">
                <span>Largo ({form.measurementUnit})</span>
                <input value={form.largo} onChange={(e) => setForm({ ...form, largo: e.target.value })} required />
              </label>
              <label className="field">
                <span>Ancho ({form.measurementUnit})</span>
                <input value={form.ancho} onChange={(e) => setForm({ ...form, ancho: e.target.value })} required />
              </label>
              <label className="field">
                <span>Unidad de captura</span>
                <select value={form.measurementUnit} onChange={(e) => setForm({ ...form, measurementUnit: e.target.value })}>
                  <option value="cm">cm</option>
                  <option value="m">m</option>
                </select>
              </label>
            </div>
          ) : null}
          <label className="field">
            <span>Proveedor</span>
            <select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
              <option value="">Sin proveedor</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id || supplier._id} value={supplier.id || supplier._id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Precio cotizado</span>
            <input type="number" step="0.01" value={form.quotedPrice} onChange={(e) => setForm({ ...form, quotedPrice: e.target.value })} required />
          </label>
          <label className="field">
            <span>Fecha objetivo</span>
            <input type="date" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} required />
          </label>
          <button type="submit" className="primary-button">Ejecutar comparativo</button>
        </form>

        <DataTable
          columns={[
            { key: "conceptName", label: "Concepto" },
            { key: "baseDimensions", label: "Medida histórica base", render: (value) => formatDimensions(value) },
            { key: "baseAreaM2", label: "Área histórica base", render: (value) => (value ? `${value.toFixed(3)} m2` : "—") },
            { key: "targetDimensions", label: "Medida nueva", render: (value) => formatDimensions(value) },
            { key: "targetAreaM2", label: "Área nueva", render: (value) => (value ? `${value.toFixed(3)} m2` : "—") },
            { key: "historicalPrice", label: "Precio histórico", render: (value) => formatCurrency(value) },
            { key: "adjustedPrice", label: "Precio ajustado", render: (value) => formatCurrency(value) },
            { key: "proportionalEstimatedPrice", label: "Precio proporcional estimado", render: (value) => formatCurrency(value) },
            { key: "quotedPrice", label: "Cotizado", render: (value) => formatCurrency(value) },
            { key: "differencePercent", label: "Diferencia %", render: (value) => formatPercent(value) },
            { key: "result", label: "Resultado" },
          ]}
          rows={items}
        />
      </div>
    </section>
  );
}

export default QuoteChecksPage;
