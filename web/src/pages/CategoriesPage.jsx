import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import CrudActions from "../components/CrudActions";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../contexts/AuthContext";
import { PERMISSIONS } from "../utils/permissions";
import { MAIN_TYPE_OPTIONS } from "../utils/constants";

const initialForm = {
  name: "",
  mainType: "material",
  description: "",
};

function CategoriesPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.CATALOGS_MANAGE);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [error, setError] = useState("");

  async function loadItems() {
    const data = await apiRequest(`/categories?status=${statusFilter}`);
    setItems(data.items);
  }

  useEffect(() => {
    loadItems().catch(() => setItems([]));
  }, [statusFilter]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    try {
      await apiRequest(editingId ? `/categories/${editingId}` : "/categories", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(form),
      });
      setForm(initialForm);
      setEditingId("");
      await loadItems();
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  async function handleToggleActive(item) {
    const shouldActivate = !item.isActive;
    if (
      !window.confirm(
        shouldActivate
          ? `¿Quieres reactivar este registro (${item.name})?`
          : `¿Quieres desactivar este registro (${item.name})?`
      )
    ) return;

    try {
      setError("");
      await apiRequest(shouldActivate ? `/categories/${item.id}/reactivate` : `/categories/${item.id}`, {
        method: shouldActivate ? "PATCH" : "DELETE",
      });
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
      <PageHeader
        title="Categorias"
        description="Separacion base entre mano de obra y materiales / conceptos."
      />

      <div className="content-grid">
        {canManage ? (
          <form className="card form-grid" onSubmit={handleSubmit}>
            <h3>{editingId ? "Editar categoria" : "Nueva categoria"}</h3>
            <label className="field">
              <span>Nombre</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </label>
            <label className="field">
              <span>Tipo principal</span>
              <select value={form.mainType} onChange={(e) => setForm({ ...form, mainType: e.target.value })}>
                {MAIN_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Descripcion</span>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows="4"
              />
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
            <h3>Consulta de categorias</h3>
            <p className="muted">Tu rol actual solo tiene permisos de lectura en este modulo.</p>
          </div>
        )}

        <DataTable
          columns={[
            { key: "name", label: "Nombre" },
            { key: "mainType", label: "Tipo" },
            { key: "description", label: "Descripcion" },
            { key: "status", label: "Estado", render: (_value, row) => (row.isActive ? "Activo" : "Inactivo") },
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
                            mainType: row.mainType || "material",
                            description: row.description || "",
                          });
                          setError("");
                        }}
                        onToggleActive={() => handleToggleActive(row)}
                        isActive={row.isActive}
                      />
                    ),
                  },
                ]
              : []),
          ]}
          rows={items}
        />
      </div>
      <div className="card form-grid">
        <label className="field">
          <span>Visibilidad</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="active">Solo activos</option>
            <option value="inactive">Solo inactivos</option>
            <option value="all">Todos</option>
          </select>
        </label>
      </div>
    </section>
  );
}

export default CategoriesPage;
