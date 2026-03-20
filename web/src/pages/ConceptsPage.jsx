import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import CrudActions from "../components/CrudActions";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../contexts/AuthContext";
import { CALCULATION_TYPE_OPTIONS, MAIN_TYPE_OPTIONS } from "../utils/constants";

const initialForm = {
  name: "",
  categoryId: "",
  mainType: "material",
  primaryUnit: "pieza",
  calculationType: "fixed_unit",
  requiresDimensions: false,
  description: "",
};

function normalizeText(value = "") {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function isApproximateMatch(conceptName, searchValue) {
  const normalizedConcept = normalizeText(conceptName);
  const normalizedSearch = normalizeText(searchValue);

  if (!normalizedSearch) return true;
  if (!normalizedConcept) return false;
  if (normalizedConcept.includes(normalizedSearch) || normalizedSearch.includes(normalizedConcept)) return true;

  const searchTokens = normalizedSearch.split(/\s+/).filter(Boolean);
  return searchTokens.every((token) => normalizedConcept.includes(token));
}

function ConceptsPage() {
  const { user } = useAuth();
  const canManage = ["superadmin", "admin"].includes(user?.role);
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [error, setError] = useState("");

  async function loadPage() {
    const [conceptsData, categoriesData] = await Promise.all([
      apiRequest(`/concepts?status=${statusFilter}`),
      apiRequest("/categories"),
    ]);
    setItems(conceptsData.items);
    setCategories(categoriesData.items);
  }

  useEffect(() => {
    loadPage().catch(() => {
      setItems([]);
      setCategories([]);
    });
  }, [statusFilter]);

  const categoryFocusedItems = items.filter((item) => (form.categoryId ? item.categoryId === form.categoryId : true));
  const filteredItems = categoryFocusedItems.filter((item) =>
    isApproximateMatch(item.name, form.name)
  );
  const similarConcepts = filteredItems.filter((item) => item.id !== editingId);
  const normalizedFormName = normalizeText(form.name);
  const exactDuplicate = items.find(
    (item) =>
      item.id !== editingId &&
      item.categoryId === form.categoryId &&
      normalizeText(item.name) === normalizedFormName
  );
  const hasExactDuplicate = Boolean(form.categoryId && normalizedFormName && exactDuplicate);
  const hasPossibleDuplicate = Boolean(form.categoryId && form.name.trim() && similarConcepts.length);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (hasExactDuplicate) {
      setError(`No se puede guardar porque ya existe "${exactDuplicate.name}" en esta categoría.`);
      return;
    }

    const payload = {
      ...form,
      dimensionSchema: form.requiresDimensions
        ? {
            width: true,
            height: ["area_based"].includes(form.calculationType),
            length: ["linear_based", "height_based"].includes(form.calculationType),
            inputUnit: "cm",
          }
        : null,
    };

    try {
      await apiRequest(editingId ? `/concepts/${editingId}` : "/concepts", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });

      setEditingId("");
      setForm(initialForm);
      await loadPage();
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
      await apiRequest(shouldActivate ? `/concepts/${item.id}/reactivate` : `/concepts/${item.id}`, {
        method: shouldActivate ? "PATCH" : "DELETE",
      });
      if (editingId === item.id) {
        setEditingId("");
        setForm(initialForm);
      }
      await loadPage();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  function handleEdit(item) {
    setEditingId(item.id);
    setForm({
      name: item.name || "",
      categoryId: item.categoryId || "",
      mainType: item.mainType || "material",
      primaryUnit: item.primaryUnit || "pieza",
      calculationType: item.calculationType || "fixed_unit",
      requiresDimensions: Boolean(item.requiresDimensions),
      description: item.description || "",
    });
  }

  return (
    <section>
      <PageHeader title="Conceptos" description="Base configurable para conceptos simples o dimensionales." />

      <div className="content-grid concepts-layout">
        {canManage ? (
          <form className="card form-grid" onSubmit={handleSubmit}>
            <h3>{editingId ? "Editar concepto" : "Nuevo concepto"}</h3>
            <label className="field">
              <span>Nombre</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </label>
            <label className="field">
              <span>Categoria</span>
              <select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                required
              >
                <option value="">Selecciona una categoria</option>
                {categories.map((category) => (
                  <option key={category.id || category._id} value={category.id || category._id}>
                    {category.name}
                  </option>
                ))}
              </select>
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
              <span>Unidad principal</span>
              <input
                value={form.primaryUnit}
                onChange={(e) => setForm({ ...form, primaryUnit: e.target.value })}
                required
              />
            </label>
            <label className="field">
              <span>Tipo de calculo</span>
              <select
                value={form.calculationType}
                onChange={(e) => setForm({ ...form, calculationType: e.target.value })}
              >
                {CALCULATION_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={form.requiresDimensions}
                onChange={(e) => setForm({ ...form, requiresDimensions: e.target.checked })}
              />
              <span>Requiere dimensiones</span>
            </label>
            <label className="field">
              <span>Descripcion</span>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows="3" />
            </label>
            {error ? <div className="alert error">{error}</div> : null}
            {hasExactDuplicate ? (
              <div className="alert error">
                Duplicado exacto detectado en la misma categoría. Cambia el nombre para continuar.
              </div>
            ) : null}
            {hasPossibleDuplicate ? (
              <div className="alert">
                Ya existe(n) {similarConcepts.length} concepto(s) parecido(s) en esta categoría. Revísalos en la tabla para evitar duplicados.
              </div>
            ) : null}
            <div className="button-row">
              <button type="submit" className="primary-button" disabled={hasExactDuplicate}>
                {editingId ? "Actualizar" : "Guardar"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    setEditingId("");
                    setError("");
                    setForm(initialForm);
                  }}
                >
                  Cancelar
                </button>
              ) : null}
            </div>
          </form>
        ) : (
          <div className="card">
            <h3>Consulta de conceptos</h3>
            <p className="muted">Tu rol actual solo tiene permisos de lectura en este modulo.</p>
          </div>
        )}

        <div className="card">
          <h3>Coincidencias en tiempo real</h3>
          <p className="muted">
            Se filtra automáticamente por la categoría y el texto del concepto mientras capturas.
          </p>
          <ul className="muted">
            <li>Categoría seleccionada: {form.categoryId ? categories.find((c) => (c.id || c._id) === form.categoryId)?.name || "—" : "Todas"}</li>
            <li>Texto buscado: {form.name.trim() || "—"}</li>
            <li>Resultados visibles: {filteredItems.length}</li>
          </ul>
        </div>

        <div className="concepts-table-wrap">
          <DataTable
            columns={[
              { key: "categoryName", label: "Categoria" },
              { key: "name", label: "Nombre" },
              { key: "mainType", label: "Tipo principal" },
              { key: "primaryUnit", label: "Unidad principal" },
              { key: "status", label: "Estatus", render: (_value, row) => (row.isActive ? "Activo" : "Inactivo") },
              { key: "calculationType", label: "Calculo" },
              { key: "requiresDimensions", label: "Dimensiones" },
              ...(canManage
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
          />
        </div>
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

export default ConceptsPage;
