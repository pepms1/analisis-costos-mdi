import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api/client";
import CrudActions from "../components/CrudActions";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../contexts/AuthContext";
import { formatDate } from "../utils/formatters";

const initialForm = {
  name: "",
  code: "",
  clientName: "",
  location: "",
  notes: "",
  isActive: true,
};

function ProjectsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [error, setError] = useState("");

  async function loadItems() {
    const data = await apiRequest(`/projects?status=${statusFilter}`);
    setItems(data.items);
  }

  useEffect(() => {
    loadItems().catch(() => setItems([]));
  }, [statusFilter]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;

    return items.filter((item) =>
      [item.name, item.code, item.clientName, item.location].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(term)
      )
    );
  }, [items, search]);
  const canManageProjects = ["superadmin", "admin"].includes(user?.role);

  function handleEdit(item) {
    setEditingId(item.id);
    setForm({
      name: item.name || "",
      code: item.code || "",
      clientName: item.clientName || "",
      location: item.location || "",
      notes: item.notes || "",
      isActive: Boolean(item.isActive),
    });
  }

  function resetForm() {
    setEditingId("");
    setForm(initialForm);
    setError("");
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
      await apiRequest(shouldActivate ? `/projects/${item.id}/reactivate` : `/projects/${item.id}`, {
        method: shouldActivate ? "PATCH" : "DELETE",
      });
      if (editingId === item.id) {
        resetForm();
      }
      await loadItems();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    try {
      if (editingId) {
        await apiRequest(`/projects/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(form),
        });
      } else {
        await apiRequest("/projects", {
          method: "POST",
          body: JSON.stringify(form),
        });
      }

      resetForm();
      await loadItems();
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  return (
    <section>
      <PageHeader
        title="Obras"
        description="Catalogo formal de proyectos para relacionar historicos, proveedores y comparativos."
      />

      <div className="content-grid">
        {canManageProjects ? (
          <form className="card form-grid" onSubmit={handleSubmit}>
            <h3>{editingId ? "Editar obra" : "Nueva obra"}</h3>
            <label className="field">
              <span>Nombre</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </label>
            <label className="field">
              <span>Codigo</span>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </label>
            <label className="field">
              <span>Cliente</span>
              <input value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} />
            </label>
            <label className="field">
              <span>Ubicacion</span>
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </label>
            <label className="field">
              <span>Notas</span>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows="3" />
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              <span>Obra activa</span>
            </label>
            {error ? <div className="alert error">{error}</div> : null}
            <div className="button-row">
              <button type="submit" className="primary-button">
                {editingId ? "Actualizar obra" : "Guardar obra"}
              </button>
              {editingId ? (
                <button type="button" className="ghost-button" onClick={resetForm}>
                  Cancelar
                </button>
              ) : null}
            </div>
          </form>
        ) : (
          <div className="card">
            <h3>Consulta de obras</h3>
            <p className="muted">
              Tu rol actual permite consultar el catalogo, pero no crear ni editar obras.
            </p>
          </div>
        )}

        <div className="page-shell">
          <div className="card form-grid">
            <label className="field">
              <span>Buscar obra</span>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre, codigo o cliente" />
            </label>
            <label className="field">
              <span>Visibilidad</span>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="active">Solo activas</option>
                <option value="inactive">Solo inactivas</option>
                <option value="all">Todas</option>
              </select>
            </label>
          </div>

          <DataTable
            columns={[
              { key: "name", label: "Nombre" },
              { key: "code", label: "Codigo" },
              { key: "clientName", label: "Cliente" },
              { key: "location", label: "Ubicacion" },
              { key: "status", label: "Estado", render: (_value, row) => (row.isActive ? "Activa" : "Inactiva") },
              { key: "createdAt", label: "Alta", render: (value) => formatDate(value) },
              ...(canManageProjects
                ? [
                    {
                      key: "actions",
                      label: "Acciones",
                      render: (_value, row) => (
                        <CrudActions
                          onEdit={() => handleEdit(row)}
                          onToggleActive={() => handleToggleActive(row)}
                          isActive={row.isActive}
                        />
                      ),
                    },
                  ]
                : []),
            ]}
            rows={filteredItems}
            emptyLabel="No hay obras registradas"
          />
        </div>
      </div>
    </section>
  );
}

export default ProjectsPage;
