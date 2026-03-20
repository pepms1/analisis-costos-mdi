import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import CrudActions from "../components/CrudActions";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../contexts/AuthContext";
import { PERMISSIONS } from "../utils/permissions";
import { MAIN_TYPE_OPTIONS } from "../utils/constants";
import { formatCurrency, formatDate } from "../utils/formatters";
import { isValidMoneyInput, normalizeMoneyDraft } from "../utils/money";

const getDefaultYear = () => new Date().getFullYear().toString();
const getYearMidDate = (year) => `${year}-07-01`;
const LABOR_PRICING_MODE = "total_price";

const initialForm = {
  mainType: "material",
  categoryId: "",
  conceptId: "",
  supplierId: "",
  projectId: "",
  unit: "pieza",
  priceDate: getYearMidDate(getDefaultYear()),
  pricingMode: "unit_price",
  amount: "",
  location: "",
  observations: "",
  largo: "",
  ancho: "",
  measurementUnit: "cm",
};

function PriceRecordsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.PRICES_EDIT);
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [projectSearch, setProjectSearch] = useState("");
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");
  const [captureYear, setCaptureYear] = useState(getDefaultYear());

  async function loadRecords({ year, categoryId, supplierId } = {}) {
    const query = new URLSearchParams();
    if (categoryId) query.set("categoryId", categoryId);
    if (supplierId) query.set("supplierId", supplierId);
    if (year && /^\d{4}$/.test(year)) {
      query.set("dateFrom", `${year}-01-01`);
      query.set("dateTo", `${year}-12-31`);
    }

    const recordsData = await apiRequest(`/price-records${query.toString() ? `?${query.toString()}` : ""}`);
    setItems(recordsData.items);
  }

  async function loadCatalogs() {
    const [categoriesData, conceptsData, suppliersData, projectsData] = await Promise.all([
      apiRequest("/categories"),
      apiRequest("/concepts"),
      apiRequest("/suppliers"),
      apiRequest("/projects"),
    ]);

    setCategories(categoriesData.items);
    setConcepts(conceptsData.items);
    setSuppliers(suppliersData.items);
    setProjects(projectsData.items);
  }

  useEffect(() => {
    Promise.all([loadCatalogs(), loadRecords()]).catch(() => {
      setItems([]);
      setCategories([]);
      setConcepts([]);
      setSuppliers([]);
      setProjects([]);
    });
  }, []);

  useEffect(() => {
    loadRecords({
      year: captureYear,
      categoryId: form.categoryId,
      supplierId: form.supplierId,
    }).catch(() => setItems([]));
  }, [captureYear, form.categoryId, form.supplierId]);

  const filteredConcepts = concepts.filter((concept) => (form.categoryId ? concept.categoryId === form.categoryId : true));

  const selectedConcept = concepts.find((concept) => concept.id === form.conceptId);
  const isLaborMainType = form.mainType === "labor";
  const effectivePricingMode = isLaborMainType ? LABOR_PRICING_MODE : form.pricingMode;
  const requiresDimensions = Boolean(
    selectedConcept &&
      (selectedConcept.requiresDimensions || ["area_based", "linear_based", "height_based"].includes(selectedConcept.calculationType))
  );

  const visibleProjects = projects.filter(
    (project) => project.isActive && project.name.toLowerCase().includes(projectSearch.trim().toLowerCase())
  );

  useEffect(() => {
    if (isLaborMainType && form.pricingMode !== LABOR_PRICING_MODE) {
      setForm((prev) => ({ ...prev, pricingMode: LABOR_PRICING_MODE }));
    }
  }, [isLaborMainType, form.pricingMode]);

  function resetCaptureContext() {
    const currentYear = getDefaultYear();
    setCaptureYear(currentYear);
    setForm({
      ...initialForm,
      priceDate: getYearMidDate(currentYear),
    });
    setEditingId("");
    setError("");
  }

  function clearRecordFieldsAndKeepContext() {
    setForm((prev) => ({
      ...prev,
      conceptId: "",
      amount: "",
      location: "",
      observations: "",
      largo: "",
      ancho: "",
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!isValidMoneyInput(form.amount)) {
      setError("Monto inválido. Usa un número positivo con máximo 2 decimales.");
      return;
    }

    const payload = {
      mainType: form.mainType,
      categoryId: form.categoryId,
      conceptId: form.conceptId,
      supplierId: form.supplierId || null,
      projectId: form.projectId || null,
      unit: form.unit,
      priceDate: form.priceDate,
      pricingMode: effectivePricingMode,
      amount: normalizeMoneyDraft(form.amount),
      location: form.location,
      observations: form.observations,
      dimensions:
        requiresDimensions && (form.largo || form.ancho)
          ? {
              measurementUnit: form.measurementUnit,
              largo: form.largo ? Number(form.largo) : undefined,
              ancho: form.ancho ? Number(form.ancho) : undefined,
              width: form.largo ? Number(form.largo) : undefined,
              height: form.ancho ? Number(form.ancho) : undefined,
            }
          : undefined,
    };

    try {
      await apiRequest(editingId ? `/price-records/${editingId}` : "/price-records", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });

      clearRecordFieldsAndKeepContext();
      setEditingId("");
      await loadRecords({
        year: captureYear,
        categoryId: form.categoryId,
        supplierId: form.supplierId,
      });
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
        clearRecordFieldsAndKeepContext();
        setEditingId("");
      }
      await loadRecords({
        year: captureYear,
        categoryId: form.categoryId,
        supplierId: form.supplierId,
      });
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  return (
    <section>
      <PageHeader title="Históricos (avanzado)" description="Vista administrativa para edición detallada y filtros avanzados de históricos." />

      <div className="content-grid">
        {canManage ? (
          <form className="card form-grid" onSubmit={handleSubmit}>
            <h3>{editingId ? "Editar historico" : "Nuevo historico"}</h3>
            <div className="card">
              <h4>Contexto de captura por lote</h4>
              <p className="muted">Este contexto se mantiene entre guardados para acelerar el backfill masivo.</p>
              <div className="subgrid">
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
                  <span>Año backfill</span>
                  <input
                    type="number"
                    min="1900"
                    max="2100"
                    step="1"
                    value={captureYear}
                    onChange={(e) => {
                      const nextYear = e.target.value;
                      setCaptureYear(nextYear);
                      if (/^\d{4}$/.test(nextYear)) {
                        setForm((prev) => ({ ...prev, priceDate: getYearMidDate(nextYear) }));
                      }
                    }}
                  />
                </label>
              </div>
            </div>
            <label className="field">
              <span>Categoria</span>
              <select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value, conceptId: "" })}
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
              <input
                type="date"
                value={form.priceDate}
                onChange={(e) => {
                  const nextDate = e.target.value;
                  setForm({ ...form, priceDate: nextDate });
                  if (nextDate) setCaptureYear(nextDate.slice(0, 4));
                }}
                required
              />
            </label>
            {isLaborMainType ? (
              <label className="field">
                <span>Tipo de captura</span>
                <input value="Sueldo/pago total de mano de obra" readOnly />
              </label>
            ) : (
              <label className="field">
                <span>Modo de precio</span>
                <select value={form.pricingMode} onChange={(e) => setForm({ ...form, pricingMode: e.target.value })}>
                  <option value="unit_price">Precio unitario</option>
                  <option value="total_price">Precio total</option>
                </select>
              </label>
            )}
            <label className="field">
              <span>{isLaborMainType ? "Sueldo / pago total" : "Monto"}</span>
              <input
                type="text"
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                onBlur={(e) => setForm((prev) => ({ ...prev, amount: normalizeMoneyDraft(e.target.value) }))}
                required
              />
            </label>
            {requiresDimensions ? (
              <>
                <div className="subgrid">
                  <label className="field">
                    <span>Largo</span>
                    <input value={form.largo} onChange={(e) => setForm({ ...form, largo: e.target.value })} />
                  </label>
                  <label className="field">
                    <span>Ancho</span>
                    <input value={form.ancho} onChange={(e) => setForm({ ...form, ancho: e.target.value })} />
                  </label>
                </div>
                <label className="field">
                  <span>Unidad de captura</span>
                  <select value={form.measurementUnit} onChange={(e) => setForm({ ...form, measurementUnit: e.target.value })}>
                    <option value="cm">cm</option>
                    <option value="m">m</option>
                  </select>
                </label>
              </>
            ) : null}
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
                {editingId ? "Actualizar y mantener contexto" : "Guardar y nuevo"}
              </button>
              <button type="button" className="ghost-button" onClick={resetCaptureContext}>
                Reset contexto
              </button>
              {editingId ? (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    setEditingId("");
                    clearRecordFieldsAndKeepContext();
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
          <div className="card">
            <h3>Históricos relacionados en tiempo real</h3>
            <p className="muted">
              La lista se actualiza con el contexto de captura actual: año ({captureYear || "todos"}), categoría y proveedor.
            </p>
          </div>
          <DataTable
            columns={[
              { key: "priceDate", label: "Fecha", render: (value) => formatDate(value) },
              { key: "projectName", label: "Obra" },
              {
                key: "categoryId",
                label: "Categoría",
                render: (value) => categories.find((category) => (category.id || category._id) === value)?.name || "—",
              },
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
                              pricingMode: row.mainType === "labor" ? LABOR_PRICING_MODE : row.pricingMode || "unit_price",
                              amount: row.capturedAmount || (row.amount ? normalizeMoneyDraft(String(row.amount)) : ""),
                              location: row.location || "",
                              observations: row.observations || "",
                              largo: row.dimensions?.largo || row.dimensions?.length || row.dimensions?.width || "",
                              ancho: row.dimensions?.ancho || row.dimensions?.height || row.dimensions?.width || "",
                              measurementUnit: row.dimensions?.measurementUnit || "cm",
                            });
                            if (row.priceDate) {
                              setCaptureYear(new Date(row.priceDate).toISOString().slice(0, 4));
                            }
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
