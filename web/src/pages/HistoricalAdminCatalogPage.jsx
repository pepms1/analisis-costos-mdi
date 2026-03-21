import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api/client";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../contexts/AuthContext";
import { PERMISSIONS } from "../utils/permissions";
import { formatCurrency, formatDate } from "../utils/formatters";
import { isValidMoneyInput, normalizeMoneyDraft } from "../utils/money";

const PAGE_SIZE = 20;
const LABOR_PRICING_MODE = "total_price";

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
  largo: "",
  ancho: "",
  measurementUnit: "cm",
  commercialUnit: "",
  commercialUnitPrice: "",
  analysisUnit: "",
};

function formatMeasurement(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return Number(value).toFixed(2);
}

function extractGeometry(row) {
  const largo = row?.derivedValues?.largoM ?? row?.dimensions?.largo ?? row?.dimensions?.length ?? row?.dimensions?.width ?? null;
  const ancho = row?.derivedValues?.anchoM ?? row?.dimensions?.ancho ?? row?.dimensions?.height ?? null;
  const measurementUnit = row?.derivedValues?.largoM || row?.derivedValues?.anchoM ? "m" : row?.dimensions?.measurementUnit || "m";

  const largoText = formatMeasurement(largo);
  const anchoText = formatMeasurement(ancho);

  if (!largoText || !anchoText) return "—";

  const area = typeof row?.normalizedQuantity === "number" ? Number(row.normalizedQuantity).toFixed(2) : null;

  return (
    <div className="historical-geometry-cell">
      <strong>{`${largoText} × ${anchoText} ${measurementUnit}`}</strong>
      <span className="muted">{area ? `Área ${area} m²` : "Área —"}</span>
    </div>
  );
}

function HistoricalAdminCatalogPage() {
  const { hasPermission, user } = useAuth();
  const canEdit = hasPermission(PERMISSIONS.PRICES_EDIT);
  const canDelete = user?.role === "superadmin";

  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [filters, setFilters] = useState({
    projectId: "",
    categoryId: "",
    conceptId: "",
    supplierId: "",
    page: 1,
  });
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, totalItems: 0, limit: PAGE_SIZE });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [editingRecord, setEditingRecord] = useState(null);
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    Promise.all([apiRequest("/categories"), apiRequest("/concepts"), apiRequest("/suppliers"), apiRequest("/projects")])
      .then(([categoriesData, conceptsData, suppliersData, projectsData]) => {
        setCategories(categoriesData.items || []);
        setConcepts(conceptsData.items || []);
        setSuppliers(suppliersData.items || []);
        setProjects(projectsData.items || []);
      })
      .catch(() => {
        setCategories([]);
        setConcepts([]);
        setSuppliers([]);
        setProjects([]);
      });
  }, []);

  useEffect(() => {
    fetchHistoricalRecords(filters);
  }, [filters]);

  const filteredConcepts = useMemo(() => {
    if (!filters.categoryId) return concepts;
    return concepts.filter((concept) => concept.categoryId === filters.categoryId);
  }, [concepts, filters.categoryId]);

  const formConceptOptions = useMemo(() => {
    if (!form.categoryId) return concepts;
    return concepts.filter((concept) => concept.categoryId === form.categoryId);
  }, [concepts, form.categoryId]);

  const selectedConcept = concepts.find((concept) => concept.id === form.conceptId);
  const isLaborMainType = form.mainType === "labor";
  const effectivePricingMode = isLaborMainType ? LABOR_PRICING_MODE : form.pricingMode;
  const requiresDimensions = Boolean(
    selectedConcept &&
      (selectedConcept.requiresDimensions || ["area_based", "linear_based", "height_based"].includes(selectedConcept.calculationType))
  );
  const hasExistingGeometry = Boolean(
    editingRecord?.geometryMeta?.areaM2 ||
      editingRecord?.derivedValues?.largoM ||
      editingRecord?.derivedValues?.anchoM ||
      editingRecord?.dimensions?.largo ||
      editingRecord?.dimensions?.ancho ||
      editingRecord?.dimensions?.length ||
      editingRecord?.dimensions?.height ||
      editingRecord?.dimensions?.width
  );
  const shouldShowGeometryBlock = requiresDimensions || hasExistingGeometry || (form.analysisUnit || "").trim().toLowerCase() === "m2";
  const parsedLargo = Number(form.largo);
  const parsedAncho = Number(form.ancho);
  const areaM2 =
    Number.isFinite(parsedLargo) &&
    parsedLargo > 0 &&
    Number.isFinite(parsedAncho) &&
    parsedAncho > 0
      ? (form.measurementUnit === "cm" ? parsedLargo / 100 : parsedLargo) * (form.measurementUnit === "cm" ? parsedAncho / 100 : parsedAncho)
      : null;
  const normalizedAmount = Number(normalizeMoneyDraft(form.amount || "0"));
  const totalPricePreview =
    Number.isFinite(normalizedAmount) && normalizedAmount > 0
      ? effectivePricingMode === "total_price"
        ? normalizedAmount
        : areaM2
          ? normalizedAmount * areaM2
          : null
      : null;
  const analysisUnitPricePreview =
    (form.analysisUnit || "").trim().toLowerCase() === "m2" && areaM2 && totalPricePreview
      ? totalPricePreview / areaM2
      : null;

  useEffect(() => {
    if (!filters.categoryId) return;
    const conceptStillVisible = filteredConcepts.some((concept) => concept.id === filters.conceptId);
    if (!conceptStillVisible && filters.conceptId) {
      setFilters((prev) => ({ ...prev, conceptId: "", page: 1 }));
    }
  }, [filteredConcepts, filters.categoryId, filters.conceptId]);

  function updateFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  }

  function goToPage(nextPage) {
    setFilters((prev) => ({ ...prev, page: nextPage }));
  }

  async function fetchHistoricalRecords(activeFilters) {
    const query = new URLSearchParams();
    if (activeFilters.projectId) query.set("projectId", activeFilters.projectId);
    if (activeFilters.categoryId) query.set("categoryId", activeFilters.categoryId);
    if (activeFilters.conceptId) query.set("conceptId", activeFilters.conceptId);
    if (activeFilters.supplierId) query.set("supplierId", activeFilters.supplierId);
    query.set("page", String(activeFilters.page || 1));
    query.set("limit", String(PAGE_SIZE));

    setLoading(true);
    setError("");

    try {
      const data = await apiRequest(`/price-records?${query.toString()}`);
      setItems(data.items || []);
      setPagination(data.pagination || { page: 1, totalPages: 1, totalItems: data.items?.length || 0, limit: PAGE_SIZE });
    } catch (requestError) {
      setItems([]);
      setPagination({ page: 1, totalPages: 1, totalItems: 0, limit: PAGE_SIZE });
      setError(requestError.message || "No se pudieron consultar los históricos.");
    } finally {
      setLoading(false);
    }
  }

  function openEditPanel(row) {
    setEditingRecord(row);
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
      ancho: row.dimensions?.ancho || row.dimensions?.height || "",
      measurementUnit: row.dimensions?.measurementUnit || "cm",
      commercialUnit: row.commercialUnit || row.unit || "",
      commercialUnitPrice: row.commercialUnitPrice ? normalizeMoneyDraft(String(row.commercialUnitPrice)) : "",
      analysisUnit: row.analysisUnit || row.normalizedUnit || "",
    });
    setSuccessMessage("");
    setError("");
  }

  async function handleUpdate(event) {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!editingRecord?.id) return;
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
      commercialUnit: form.commercialUnit || form.unit || null,
      commercialUnitPrice: form.commercialUnitPrice ? Number(normalizeMoneyDraft(form.commercialUnitPrice)) : null,
      analysisUnit: form.analysisUnit || null,
      analysisUnitPrice: analysisUnitPricePreview ? Number(analysisUnitPricePreview.toFixed(6)) : null,
      geometryMeta:
        shouldShowGeometryBlock && areaM2
          ? {
              lengthM: form.measurementUnit === "cm" ? parsedLargo / 100 : parsedLargo,
              widthM: form.measurementUnit === "cm" ? parsedAncho / 100 : parsedAncho,
              areaM2,
              sourceUnit: form.measurementUnit,
            }
          : null,
      dimensions:
        shouldShowGeometryBlock && (form.largo || form.ancho)
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
      await apiRequest(`/price-records/${editingRecord.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setSuccessMessage("Histórico actualizado correctamente.");
      await fetchHistoricalRecords(filters);
      setEditingRecord(null);
      setForm(initialForm);
    } catch (updateError) {
      setError(updateError.message || "No se pudo actualizar el histórico.");
    }
  }

  async function handleDelete(row) {
    if (!window.confirm(`¿Seguro que deseas eliminar el histórico del ${formatDate(row.priceDate)}? Esta acción es permanente.`)) return;

    setError("");
    setSuccessMessage("");
    try {
      await apiRequest(`/price-records/${row.id}`, { method: "DELETE" });
      setSuccessMessage("Histórico eliminado correctamente.");
      if (editingRecord?.id === row.id) {
        setEditingRecord(null);
        setForm(initialForm);
      }
      await fetchHistoricalRecords(filters);
    } catch (deleteError) {
      setError(deleteError.message || "No se pudo eliminar el histórico.");
    }
  }

  return (
    <section className="page-shell">
      <PageHeader
        title="Administración de históricos"
        description="Vista administrativa de catálogos para editar y eliminar registros históricos con filtros por obra, concepto, categoría y proveedor."
      />

      <div className="card form-grid compact-form historical-filters">
        <label className="field">
          <span>Obra</span>
          <select value={filters.projectId} onChange={(event) => updateFilter("projectId", event.target.value)}>
            <option value="">Todas las obras</option>
            {projects.map((project) => (
              <option key={project.id || project._id} value={project.id || project._id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Proveedor</span>
          <select value={filters.supplierId} onChange={(event) => updateFilter("supplierId", event.target.value)}>
            <option value="">Todos los proveedores</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id || supplier._id} value={supplier.id || supplier._id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Categoría</span>
          <select value={filters.categoryId} onChange={(event) => updateFilter("categoryId", event.target.value)}>
            <option value="">Todas las categorías</option>
            {categories.map((category) => (
              <option key={category.id || category._id} value={category.id || category._id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Concepto</span>
          <select value={filters.conceptId} onChange={(event) => updateFilter("conceptId", event.target.value)}>
            <option value="">Todos los conceptos</option>
            {filteredConcepts.map((concept) => (
              <option key={concept.id} value={concept.id}>
                {concept.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? <div className="alert error">{error}</div> : null}
      {successMessage ? <div className="alert">{successMessage}</div> : null}

      {editingRecord && canEdit ? (
        <form className="card form-grid" onSubmit={handleUpdate}>
          <h3>Editar histórico</h3>
          <label className="field">
            <span>Tipo principal</span>
            <select value={form.mainType} onChange={(e) => setForm((prev) => ({ ...prev, mainType: e.target.value }))}>
              <option value="material">Material</option>
              <option value="labor">Mano de obra</option>
            </select>
          </label>
          <label className="field">
            <span>Categoría</span>
            <select value={form.categoryId} onChange={(e) => setForm((prev) => ({ ...prev, categoryId: e.target.value, conceptId: "" }))} required>
              <option value="">Selecciona una categoría</option>
              {categories.map((category) => (
                <option key={category.id || category._id} value={category.id || category._id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Concepto</span>
            <select value={form.conceptId} onChange={(e) => setForm((prev) => ({ ...prev, conceptId: e.target.value }))} required>
              <option value="">Selecciona un concepto</option>
              {formConceptOptions.map((concept) => (
                <option key={concept.id} value={concept.id}>
                  {concept.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Proveedor</span>
            <select value={form.supplierId} onChange={(e) => setForm((prev) => ({ ...prev, supplierId: e.target.value }))}>
              <option value="">Sin proveedor</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id || supplier._id} value={supplier.id || supplier._id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Obra</span>
            <select value={form.projectId} onChange={(e) => setForm((prev) => ({ ...prev, projectId: e.target.value }))}>
              <option value="">Sin obra</option>
              {projects.map((project) => (
                <option key={project.id || project._id} value={project.id || project._id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Fecha</span>
            <input type="date" value={form.priceDate} onChange={(e) => setForm((prev) => ({ ...prev, priceDate: e.target.value }))} required />
          </label>
          <label className="field">
            <span>Unidad comercial</span>
            <input value={form.unit} onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))} required />
          </label>
          <label className="field">
            <span>Unidad comercial original</span>
            <input value={form.commercialUnit} onChange={(e) => setForm((prev) => ({ ...prev, commercialUnit: e.target.value }))} />
          </label>
          {!isLaborMainType ? (
            <label className="field">
              <span>Modo de precio</span>
              <select value={form.pricingMode} onChange={(e) => setForm((prev) => ({ ...prev, pricingMode: e.target.value }))}>
                <option value="unit_price">Precio unitario</option>
                <option value="total_price">Precio total</option>
              </select>
            </label>
          ) : null}
          <label className="field">
            <span>Precio histórico</span>
            <input
              type="text"
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
              onBlur={(e) => setForm((prev) => ({ ...prev, amount: normalizeMoneyDraft(e.target.value) }))}
              required
            />
          </label>
          <label className="field">
            <span>Precio histórico total</span>
            <input value={totalPricePreview ? normalizeMoneyDraft(String(totalPricePreview)) : "—"} readOnly />
          </label>
          {shouldShowGeometryBlock ? (
            <>
              <div className="card">
                <h4>Geometría y análisis</h4>
                <p className="muted">Actualiza largo/ancho para recalcular área y precio analítico normalizado.</p>
              </div>
              <div className="subgrid">
                <label className="field">
                  <span>Largo</span>
                  <input value={form.largo} onChange={(e) => setForm((prev) => ({ ...prev, largo: e.target.value }))} />
                </label>
                <label className="field">
                  <span>Ancho</span>
                  <input value={form.ancho} onChange={(e) => setForm((prev) => ({ ...prev, ancho: e.target.value }))} />
                </label>
              </div>
              <label className="field">
                <span>Unidad dimensiones</span>
                <select value={form.measurementUnit} onChange={(e) => setForm((prev) => ({ ...prev, measurementUnit: e.target.value }))}>
                  <option value="cm">cm</option>
                  <option value="m">m</option>
                </select>
              </label>
              <label className="field">
                <span>Área calculada (m²)</span>
                <input value={areaM2 ? areaM2.toFixed(4) : "—"} readOnly />
              </label>
              <label className="field">
                <span>Unidad analítica</span>
                <input value={form.analysisUnit} onChange={(e) => setForm((prev) => ({ ...prev, analysisUnit: e.target.value }))} placeholder="m2" />
              </label>
              <label className="field">
                <span>Precio analítico normalizado</span>
                <input value={analysisUnitPricePreview ? normalizeMoneyDraft(String(analysisUnitPricePreview)) : "—"} readOnly />
              </label>
            </>
          ) : null}
          <label className="field">
            <span>Precio unidad comercial original</span>
            <input
              type="text"
              inputMode="decimal"
              value={form.commercialUnitPrice}
              onChange={(e) => setForm((prev) => ({ ...prev, commercialUnitPrice: e.target.value }))}
              onBlur={(e) => setForm((prev) => ({ ...prev, commercialUnitPrice: normalizeMoneyDraft(e.target.value) }))}
            />
          </label>
          <label className="field">
            <span>Notas / metadata</span>
            <textarea value={form.observations} onChange={(e) => setForm((prev) => ({ ...prev, observations: e.target.value }))} rows="3" />
          </label>
          <label className="field">
            <span>Ubicación / información adicional</span>
            <input value={form.location} onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))} />
          </label>
          <div className="button-row">
            <button type="submit" className="primary-button">Guardar cambios</button>
            <button type="button" className="ghost-button" onClick={() => setEditingRecord(null)}>Cancelar</button>
          </div>
        </form>
      ) : null}

      <DataTable
        columns={[
          { key: "priceDate", label: "Fecha", render: (value) => formatDate(value) },
          { key: "projectName", label: "Obra", render: (value) => value || "Sin obra" },
          { key: "conceptName", label: "Concepto" },
          { key: "categoryName", label: "Categoría" },
          { key: "supplierName", label: "Proveedor" },
          { key: "amount", label: "Precio histórico", render: (value) => formatCurrency(value) },
          { key: "unit", label: "Unidad comercial", render: (value) => value || "—" },
          { key: "normalizedUnit", label: "Unidad análisis", render: (value) => value || "—" },
          { key: "geometry", label: "Geometría", render: (_value, row) => extractGeometry(row) },
          { key: "captureOrigin", label: "Origen", render: (value) => value || "manual" },
          {
            key: "additional",
            label: "Información adicional",
            render: (_value, row) => row.observations || row.location || row.sourceFileName || "—",
          },
          {
            key: "actions",
            label: "Acciones",
            render: (_value, row) => (
              <div className="table-actions">
                {canEdit ? (
                  <button type="button" className="ghost-button" onClick={() => openEditPanel(row)}>
                    Editar
                  </button>
                ) : null}
                {canDelete ? (
                  <button type="button" className="ghost-button danger-button" onClick={() => handleDelete(row)}>
                    Eliminar
                  </button>
                ) : null}
                {!canEdit && !canDelete ? "—" : null}
              </div>
            ),
          },
        ]}
        rows={items}
        emptyLabel={loading ? "Cargando históricos..." : "No hay históricos para estos filtros"}
      />

      <div className="card historical-pagination">
        <p className="muted">
          Mostrando página <strong>{pagination.page}</strong> de <strong>{pagination.totalPages}</strong> · Registros totales: {pagination.totalItems}
        </p>
        <div className="button-row">
          <button type="button" className="ghost-button" onClick={() => goToPage(Math.max(1, pagination.page - 1))} disabled={pagination.page <= 1 || loading}>
            Anterior
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => goToPage(Math.min(pagination.totalPages, pagination.page + 1))}
            disabled={pagination.page >= pagination.totalPages || loading}
          >
            Siguiente
          </button>
        </div>
      </div>
    </section>
  );
}

export default HistoricalAdminCatalogPage;
