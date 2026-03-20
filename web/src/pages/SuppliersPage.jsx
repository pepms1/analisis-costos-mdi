import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import CrudActions from "../components/CrudActions";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../contexts/AuthContext";
import { PERMISSIONS } from "../utils/permissions";

const initialForm = {
  name: "",
  legalName: "",
  contactName: "",
  phone: "",
  email: "",
  notes: "",
};

function SuppliersPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.CATALOGS_MANAGE);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [error, setError] = useState("");

  async function loadItems() {
    const data = await apiRequest(`/suppliers?status=${statusFilter}`);
    setItems(data.items);
  }

  useEffect(() => {
    loadItems().catch(() => setItems([]));
  }, [statusFilter]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    try {
      await apiRequest(editingId ? `/suppliers/${editingId}` : "/suppliers", {
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
      await apiRequest(shouldActivate ? `/suppliers/${item.id}/reactivate` : `/suppliers/${item.id}`, {
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
        title="Proveedores"
        description="Catalogo independiente para relacionar multiples conceptos y filtros historicos."
      />

      <div className="content-grid">
        {canManage ? (
          <form className="card form-grid" onSubmit={handleSubmit}>
            <h3>{editingId ? "Editar proveedor" : "Nuevo proveedor"}</h3>
            <label className="field">
              <span>Nombre comercial</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </label>
            <label className="field">
              <span>Razon social</span>
              <input value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} />
            </label>
            <label className="field">
              <span>Contacto</span>
              <input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
            </label>
            <label className="field">
              <span>Telefono</span>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </label>
            <label className="field">
              <span>Email</span>
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label className="field">
              <span>Notas</span>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows="3" />
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
            <h3>Consulta de proveedores</h3>
            <p className="muted">Tu rol actual solo tiene permisos de lectura en este modulo.</p>
          </div>
        )}

        <DataTable
          columns={[
            { key: "name", label: "Nombre" },
            { key: "contactName", label: "Contacto" },
            { key: "phone", label: "Telefono" },
            { key: "email", label: "Email" },
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
                            legalName: row.legalName || "",
                            contactName: row.contactName || "",
                            phone: row.phone || "",
                            email: row.email || "",
                            notes: row.notes || "",
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

export default SuppliersPage;
