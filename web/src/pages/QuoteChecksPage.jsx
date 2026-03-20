import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import { formatCurrency, formatPercent } from "../utils/formatters";

const initialForm = {
  conceptId: "",
  supplierId: "",
  quotedPrice: "",
  targetDate: new Date().toISOString().slice(0, 10),
};

function QuoteChecksPage() {
  const [items, setItems] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState(initialForm);

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
      }),
    });

    setForm(initialForm);
    await loadPage();
  }

  return (
    <section>
      <PageHeader
        title="Comparativos"
        description="Validacion inicial de una cotizacion nueva contra un historico ajustado."
      />

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
            <input
              type="number"
              step="0.01"
              value={form.quotedPrice}
              onChange={(e) => setForm({ ...form, quotedPrice: e.target.value })}
              required
            />
          </label>
          <label className="field">
            <span>Fecha objetivo</span>
            <input
              type="date"
              value={form.targetDate}
              onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
              required
            />
          </label>
          <button type="submit" className="primary-button">
            Ejecutar comparativo
          </button>
        </form>

        <DataTable
          columns={[
            { key: "conceptName", label: "Concepto" },
            { key: "historicalPrice", label: "Historico", render: (value) => formatCurrency(value) },
            { key: "adjustedPrice", label: "Ajustado", render: (value) => formatCurrency(value) },
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
