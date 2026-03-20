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

function ConceptsPage() {
  const { user } = useAuth();
  const canManage = ["superadmin", "admin"].includes(user?.role);
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");

  async function loadPage() {
    const [conceptsData, categoriesData] = await Promise.all([apiRequest("/concepts"), apiRequest("/categories")]);
    setItems(conceptsData.items);
    setCategories(categoriesData.items);
  }

  useEffect(() => {
    loadPage().catch(() => {
      setItems([]);
      setCategories([]);
    });
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

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

  async function handleDelete(item) {
    if (!window.confirm(`¿Seguro que deseas eliminar ${item.name}? Esta accion desactiva el registro.`)) return;

    try {
      setError("");
      await apiRequest(`/concepts/${item.id}`, { method: "DELETE" });
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

      <div className="content-grid">
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

        <DataTable
          columns={[
            { key: "name", label: "Nombre" },
            { key: "categoryName", label: "Categoria" },
            { key: "mainType", label: "Tipo" },
            { key: "calculationType", label: "Calculo" },
            { key: "primaryUnit", label: "Unidad" },
            { key: "requiresDimensions", label: "Dimensiones" },
            ...(canManage
              ? [
                  {
                    key: "actions",
                    label: "Acciones",
                    render: (_value, row) => (
                      <CrudActions
                        onEdit={() => handleEdit(row)}
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

export default ConceptsPage;
