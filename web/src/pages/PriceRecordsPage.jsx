import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import CrudActions from "../components/CrudActions";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../contexts/AuthContext";
import { MAIN_TYPE_OPTIONS } from "../utils/constants";
import { formatCurrency, formatDate } from "../utils/formatters";

const initialForm = {
  mainType: "material",
  categoryId: "",
  conceptId: "",
  supplierId: "",
  projectId: "",
  unit: "pieza",
  priceDate: new Date().toISOString().slice(0, 10),
  pricingMode: "unit_price",
  amount: "",
  location: "",
  observations: "",
  width: "",
  height: "",
  length: "",
  measurementUnit: "cm",
};

function PriceRecordsPage() {
  const { user } = useAuth();
  const canManage = ["superadmin", "admin"].includes(user?.role);
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [filters, setFilters] = useState({ projectId: "" });
  const [projectSearch, setProjectSearch] = useState("");
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");

  async function loadPage(projectFilterId = filters.projectId) {
    const query = new URLSearchParams();
    if (projectFilterId) query.set("projectId", projectFilterId);

    const [recordsData, categoriesData, conceptsData, suppliersData, projectsData] = await Promise.all([
      apiRequest(`/price-records${query.toString() ? `?${query.toString()}` : ""}`),
      apiRequest("/categories"),
      apiRequest("/concepts"),
      apiRequest("/suppliers"),
      apiRequest("/projects"),
    ]);

    setItems(recordsData.items);
    setCategories(categoriesData.items);
    setConcepts(conceptsData.items);
    setSuppliers(suppliersData.items);
    setProjects(projectsData.items);
  }

  useEffect(() => {
    loadPage().catch(() => {
      setItems([]);
      setCategories([]);
      setConcepts([]);
      setSuppliers([]);
      setProjects([]);
    });
  }, []);

  const filteredConcepts = concepts.filter((concept) => (form.categoryId ? concept.categoryId === form.categoryId : true));

  const visibleProjects = projects.filter(
    (project) => project.isActive && project.name.toLowerCase().includes(projectSearch.trim().toLowerCase())
  );

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const payload = {
      mainType: form.mainType,
      categoryId: form.categoryId,
      conceptId: form.conceptId,
      supplierId: form.supplierId || null,
      projectId: form.projectId || null,
      unit: form.unit,
      priceDate: form.priceDate,
      pricingMode: form.pricingMode,
      amount: Number(form.amount),
      location: form.location,
      observations: form.observations,
      dimensions:
        form.width || form.height || form.length
          ? {
              measurementUnit: form.measurementUnit,
              width: form.width ? Number(form.width) : undefined,
              height: form.height ? Number(form.height) : undefined,
              length: form.length ? Number(form.length) : undefined,
            }
          : undefined,
    };

    try {
      await apiRequest(editingId ? `/price-records/${editingId}` : "/price-records", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });

      setForm(initialForm);
      setEditingId("");
      await loadPage();
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(`¿Seguro que deseas eliminar el historico del ${formatDate(item.priceDate)}? Esta accion es permanente.`)) return;

    try {
      setError("");
      await apiRequest(`/price-records/${item.id}`, { method: "DELETE" });
      if (editingId === item.id) {
        setEditingId("");
        setForm(initialForm);
      }
      await loadPage();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  async function handleFilterSubmit(event) {
    event.preventDefault();
    await loadPage(filters.projectId);
  }

  return (
    <section>
      <PageHeader title="Historicos" description="Captura manual de precios con soporte base para medidas y normalizacion." />

      <div className="content-grid">
        {canManage ? (
          <form className="card form-grid" onSubmit={handleSubmit}>
            <h3>{editingId ? "Editar historico" : "Nuevo historico"}</h3>
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
              <span>Categoria</span>
              <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} required>
                <option value="">Selecciona una categoria</option>
                {categories.map((category) => (
                  <option key={category.id || category._id} value={category.id || category._id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Concepto</span>
              <select value={form.conceptId} onChange={(e) => setForm({ ...form, conceptId: e.target.value })} required>
                <option value="">Selecciona un concepto</option>
                {filteredConcepts.map((concept) => (
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
              <span>Buscar obra</span>
              <input value={projectSearch} onChange={(e) => setProjectSearch(e.target.value)} placeholder="Filtrar obras activas" />
            </label>
            <label className="field">
              <span>Obra</span>
              <select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
                <option value="">Sin obra</option>
                {visibleProjects.map((project) => (
                  <option key={project.id || project._id} value={project.id || project._id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Unidad</span>
              <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} required />
            </label>
            <label className="field">
              <span>Fecha</span>
              <input type="date" value={form.priceDate} onChange={(e) => setForm({ ...form, priceDate: e.target.value })} required />
            </label>
            <label className="field">
              <span>Modo de precio</span>
              <select value={form.pricingMode} onChange={(e) => setForm({ ...form, pricingMode: e.target.value })}>
                <option value="unit_price">Precio unitario</option>
                <option value="total_price">Precio total</option>
              </select>
            </label>
            <label className="field">
              <span>Monto</span>
              <input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
            </label>
            <div className="subgrid">
              <label className="field">
                <span>Ancho</span>
                <input value={form.width} onChange={(e) => setForm({ ...form, width: e.target.value })} />
              </label>
              <label className="field">
                <span>Alto</span>
                <input value={form.height} onChange={(e) => setForm({ ...form, height: e.target.value })} />
              </label>
              <label className="field">
                <span>Longitud</span>
                <input value={form.length} onChange={(e) => setForm({ ...form, length: e.target.value })} />
              </label>
            </div>
            <label className="field">
              <span>Unidad de medida</span>
              <select value={form.measurementUnit} onChange={(e) => setForm({ ...form, measurementUnit: e.target.value })}>
                <option value="cm">cm</option>
                <option value="m">m</option>
              </select>
            </label>
            <label className="field">
              <span>Ubicacion</span>
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </label>
            <label className="field">
              <span>Observaciones</span>
              <textarea value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} rows="3" />
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
            <h3>Consulta de historicos</h3>
            <p className="muted">Tu rol actual solo tiene permisos de lectura en este modulo.</p>
          </div>
        )}

        <div className="page-shell">
          <form className="card form-grid" onSubmit={handleFilterSubmit}>
            <h3>Filtros</h3>
            <label className="field">
              <span>Obra</span>
              <select value={filters.projectId} onChange={(e) => setFilters((prev) => ({ ...prev, projectId: e.target.value }))}>
                <option value="">Todas las obras</option>
                {projects.map((project) => (
                  <option key={project.id || project._id} value={project.id || project._id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="button-row">
              <button type="submit" className="primary-button">
                Aplicar filtros
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={async () => {
                  setFilters({ projectId: "" });
                  setProjectSearch("");
                  await loadPage("");
                }}
              >
                Limpiar
              </button>
            </div>
          </form>

          <DataTable
            columns={[
              { key: "priceDate", label: "Fecha", render: (value) => formatDate(value) },
              { key: "projectName", label: "Obra" },
              { key: "conceptName", label: "Concepto" },
              { key: "supplierName", label: "Proveedor" },
              { key: "mainType", label: "Tipo" },
              { key: "amount", label: "Monto", render: (value) => formatCurrency(value) },
              {
                key: "normalizedPrice",
                label: "Normalizado",
                render: (value, row) => (value ? `${formatCurrency(value)} / ${row.normalizedUnit}` : "—"),
              },
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
                              mainType: row.mainType || "material",
                              categoryId: row.categoryId || "",
                              conceptId: row.conceptId || "",
                              supplierId: row.supplierId || "",
                              projectId: row.projectId || "",
                              unit: row.unit || "pieza",
                              priceDate: row.priceDate ? new Date(row.priceDate).toISOString().slice(0, 10) : initialForm.priceDate,
                              pricingMode: row.pricingMode || "unit_price",
                              amount: row.amount || "",
                              location: row.location || "",
                              observations: row.observations || "",
                              width: row.dimensions?.width || "",
                              height: row.dimensions?.height || "",
                              length: row.dimensions?.length || "",
                              measurementUnit: row.dimensions?.measurementUnit || "cm",
                            });
                            setError("");
                          }}
                          onDelete={() => handleDelete(row)}
                        />
                      ),
                    },
                  ]
                : []),
            ]}
            rows={items}
          />
        </div>
      </div>
    </section>
  );
}

export default PriceRecordsPage;
