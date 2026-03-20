import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";

const initialForm = {
  name: "",
  adjustmentType: "inflation",
  scopeType: "general",
  factors: '[{"label":"2026","factor":1.05}]',
};

function AdjustmentsPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");

  async function loadItems() {
    const data = await apiRequest("/adjustments");
    setItems(data.items);
  }

  useEffect(() => {
    loadItems().catch(() => setItems([]));
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    try {
      await apiRequest("/adjustments", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          factors: JSON.parse(form.factors),
        }),
      });
      setForm(initialForm);
      await loadItems();
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  return (
    <section>
      <PageHeader
        title="Ajustes"
        description="Parametros manuales de inflacion e incrementos por alcance."
      />

      <div className="content-grid">
        <form className="card form-grid" onSubmit={handleSubmit}>
          <h3>Nuevo ajuste</h3>
          <label className="field">
            <span>Nombre</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label className="field">
            <span>Tipo de ajuste</span>
            <select
              value={form.adjustmentType}
              onChange={(e) => setForm({ ...form, adjustmentType: e.target.value })}
            >
              <option value="inflation">Inflation</option>
              <option value="labor_increase">Labor increase</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <label className="field">
            <span>Alcance</span>
            <select value={form.scopeType} onChange={(e) => setForm({ ...form, scopeType: e.target.value })}>
              <option value="general">general</option>
              <option value="labor">labor</option>
              <option value="material">material</option>
              <option value="category">category</option>
            </select>
          </label>
          <label className="field">
            <span>Factores JSON</span>
            <textarea value={form.factors} onChange={(e) => setForm({ ...form, factors: e.target.value })} rows="5" />
          </label>
          {error ? <div className="alert error">{error}</div> : null}
          <button type="submit" className="primary-button">
            Guardar ajuste
          </button>
        </form>

        <DataTable
          columns={[
            { key: "name", label: "Nombre" },
            { key: "adjustmentType", label: "Tipo" },
            { key: "scopeType", label: "Alcance" },
            { key: "isActive", label: "Activo" },
          ]}
          rows={items}
        />
      </div>
    </section>
  );
}

export default AdjustmentsPage;
