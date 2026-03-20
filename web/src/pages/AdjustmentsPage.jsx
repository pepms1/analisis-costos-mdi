import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import CrudActions from "../components/CrudActions";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../contexts/AuthContext";

const initialForm = {
  name: "",
  adjustmentType: "inflation",
  scopeType: "general",
  factors: '[{"label":"2026","factor":1.05}]',
};

function AdjustmentsPage() {
  const { user } = useAuth();
  const canManage = ["superadmin", "admin"].includes(user?.role);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState("");
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
      await apiRequest(editingId ? `/adjustments/${editingId}` : "/adjustments", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify({
          ...form,
          factors: JSON.parse(form.factors),
        }),
      });
      setForm(initialForm);
      setEditingId("");
      await loadItems();
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(`¿Seguro que deseas eliminar ${item.name}? Esta accion desactiva el registro.`)) return;

    try {
      setError("");
      await apiRequest(`/adjustments/${item.id}`, { method: "DELETE" });
      if (editingId === item.id) {
        setEditingId("");
        setForm(initialForm);
      }
      await loadItems();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  return (
    <section>
      <PageHeader title="Ajustes" description="Parametros manuales de inflacion e incrementos por alcance." />

      <div className="content-grid">
        {canManage ? (
          <form className="card form-grid" onSubmit={handleSubmit}>
            <h3>{editingId ? "Editar ajuste" : "Nuevo ajuste"}</h3>
            <label className="field">
              <span>Nombre</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </label>
            <label className="field">
              <span>Tipo de ajuste</span>
              <select value={form.adjustmentType} onChange={(e) => setForm({ ...form, adjustmentType: e.target.value })}>
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
            <div className="button-row">
              <button type="submit" className="primary-button">
                {editingId ? "Actualizar" : "Guardar"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    setEditingId("");
                    setForm(initialForm);
                    setError("");
                  }}
                >
                  Cancelar
                </button>
              ) : null}
            </div>
          </form>
        ) : (
          <div className="card">
            <h3>Consulta de ajustes</h3>
            <p className="muted">Tu rol actual solo tiene permisos de lectura en este modulo.</p>
          </div>
        )}

        <DataTable
          columns={[
            { key: "name", label: "Nombre" },
            { key: "adjustmentType", label: "Tipo" },
            { key: "scopeType", label: "Alcance" },
            { key: "isActive", label: "Activo" },
            ...(canManage
              ? [
                  {
                    key: "actions",
                    label: "Acciones",
                    render: (_value, row) => (
                      <CrudActions
                        onEdit={() => {
                          setEditingId(row.id);
                          setForm({
                            name: row.name || "",
                            adjustmentType: row.adjustmentType || "inflation",
                            scopeType: row.scopeType || "general",
                            factors: JSON.stringify(row.factors || [], null, 2),
                          });
                          setError("");
                        }}
                        onDelete={() => handleDelete(row)}
                        disableDelete={!row.isActive}
                      />
                    ),
                  },
                ]
              : []),
          ]}
          rows={items}
        />
      </div>
    </section>
  );
}

export default AdjustmentsPage;
