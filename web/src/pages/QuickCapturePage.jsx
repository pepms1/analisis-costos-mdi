import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api/client";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../contexts/AuthContext";
import { MAIN_TYPE_OPTIONS } from "../utils/constants";
import { getTodayDateOnlyLocal } from "../utils/dateOnly";
import { PERMISSIONS } from "../utils/permissions";
import { isValidMoneyInput, normalizeMoneyDraft } from "../utils/money";
import { canonicalizeProjectIds } from "../utils/projectIds";
import { sortByLabel } from "../utils/sorting";

const initialForm = {
  categoryFilterId: "",
  conceptId: "",
  unit: "",
  supplierId: "",
  projectIds: [],
  priceDate: getTodayDateOnlyLocal(),
  amount: "",
  pricingMode: "unit_price",
  location: "",
  observations: "",
  largo: "",
  ancho: "",
  measurementUnit: "cm",
};

const initialCategoryQuickForm = {
  name: "",
  mainType: "material",
  description: "",
};

const initialSupplierQuickForm = {
  name: "",
  legalName: "",
  contactName: "",
  phone: "",
  email: "",
  notes: "",
};

const initialConceptQuickForm = {
  name: "",
  categoryId: "",
  mainType: "material",
  primaryUnit: "pieza",
  calculationType: "fixed_unit",
  requiresDimensions: false,
  description: "",
};

const LABOR_PRICING_MODE = "total_price";

function QuickCapturePage() {
  const { hasPermission } = useAuth();
  const canQuickCapture = hasPermission(PERMISSIONS.PRICES_QUICK_CAPTURE);
  const canCreatePrice = hasPermission(PERMISSIONS.PRICES_CREATE);
  const canManageCatalogs = hasPermission(PERMISSIONS.CATALOGS_MANAGE);
  const [categories, setCategories] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState({ error: "", success: "" });
  const [quickCreateType, setQuickCreateType] = useState("");
  const [quickCreateStatus, setQuickCreateStatus] = useState({ error: "", success: "" });
  const [categoryQuickForm, setCategoryQuickForm] = useState(initialCategoryQuickForm);
  const [supplierQuickForm, setSupplierQuickForm] = useState(initialSupplierQuickForm);
  const [conceptQuickForm, setConceptQuickForm] = useState(initialConceptQuickForm);

  const filteredConcepts = useMemo(
    () => concepts.filter((concept) => (form.categoryFilterId ? concept.categoryId === form.categoryFilterId : true)),
    [concepts, form.categoryFilterId]
  );

  async function loadCatalogs() {
    const [categoriesData, conceptsData, suppliersData, projectsData] = await Promise.all([
      apiRequest("/categories"),
      apiRequest("/concepts"),
      apiRequest("/suppliers"),
      apiRequest("/projects"),
    ]);

    setCategories(sortByLabel((categoriesData.items || []).filter((category) => category.isActive), (item) => item.name));
    setConcepts(sortByLabel((conceptsData.items || []).filter((concept) => concept.isActive), (item) => item.name));
    setSuppliers(sortByLabel(suppliersData.items || [], (item) => item.name));
    setProjects(sortByLabel((projectsData.items || []).filter((project) => project.isActive), (item) => item.name));
  }

  async function refreshCategories() {
    const categoriesData = await apiRequest("/categories");
    setCategories(sortByLabel((categoriesData.items || []).filter((category) => category.isActive), (item) => item.name));
  }

  async function refreshConcepts() {
    const conceptsData = await apiRequest("/concepts");
    setConcepts(sortByLabel((conceptsData.items || []).filter((concept) => concept.isActive), (item) => item.name));
  }

  async function refreshSuppliers() {
    const suppliersData = await apiRequest("/suppliers");
    setSuppliers(sortByLabel(suppliersData.items || [], (item) => item.name));
  }

  useEffect(() => {
    loadCatalogs().catch(() => {
      setCategories([]);
      setConcepts([]);
      setSuppliers([]);
      setProjects([]);
    });
  }, []);

  useEffect(() => {
    if (form.conceptId && !filteredConcepts.some((concept) => concept.id === form.conceptId)) {
      setForm((prev) => ({ ...prev, conceptId: "", unit: "" }));
    }
  }, [filteredConcepts, form.conceptId]);

  const selectedConcept = useMemo(() => concepts.find((concept) => concept.id === form.conceptId), [concepts, form.conceptId]);
  const conceptBaseUnit = (selectedConcept?.primaryUnit || "").trim();
  const isLaborConcept = selectedConcept?.mainType === "labor";
  const effectivePricingMode = isLaborConcept ? LABOR_PRICING_MODE : form.pricingMode;
  const requiresDimensions = Boolean(
    selectedConcept &&
      (selectedConcept.requiresDimensions || ["area_based", "linear_based", "height_based"].includes(selectedConcept.calculationType))
  );

  useEffect(() => {
    if (isLaborConcept && form.pricingMode !== LABOR_PRICING_MODE) {
      setForm((prev) => ({ ...prev, pricingMode: LABOR_PRICING_MODE }));
    }
  }, [isLaborConcept, form.pricingMode]);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      unit: conceptBaseUnit || "",
    }));
  }, [conceptBaseUnit, form.conceptId]);

  useEffect(() => {
    setConceptQuickForm((prev) => {
      if (prev.categoryId) return prev;
      return {
        ...prev,
        categoryId: form.categoryFilterId || prev.categoryId,
      };
    });
  }, [form.categoryFilterId]);

  function openQuickCreate(type) {
    setQuickCreateType(type);
    setQuickCreateStatus({ error: "", success: "" });
    if (type === "concept") {
      setConceptQuickForm((prev) => ({ ...prev, categoryId: prev.categoryId || form.categoryFilterId }));
    }
  }

  function closeQuickCreate() {
    setQuickCreateType("");
    setQuickCreateStatus({ error: "", success: "" });
  }

  async function handleQuickCreateCategory(event) {
    event.preventDefault();
    setQuickCreateStatus({ error: "", success: "" });

    try {
      const created = await apiRequest("/categories", {
        method: "POST",
        body: JSON.stringify(categoryQuickForm),
      });
      const createdCategoryId = created?.item?.id || created?.id;

      await refreshCategories();
      setCategoryQuickForm(initialCategoryQuickForm);
      setQuickCreateStatus({ error: "", success: "Categoría creada correctamente." });

      if (createdCategoryId) {
        setForm((prev) => ({ ...prev, categoryFilterId: createdCategoryId, conceptId: "" }));
        setConceptQuickForm((prev) => ({ ...prev, categoryId: createdCategoryId }));
      }
      closeQuickCreate();
    } catch (submitError) {
      setQuickCreateStatus({ error: submitError.message, success: "" });
    }
  }

  async function handleQuickCreateSupplier(event) {
    event.preventDefault();
    setQuickCreateStatus({ error: "", success: "" });

    try {
      const created = await apiRequest("/suppliers", {
        method: "POST",
        body: JSON.stringify(supplierQuickForm),
      });
      const createdSupplierId = created?.item?.id || created?.id;

      await refreshSuppliers();
      setSupplierQuickForm(initialSupplierQuickForm);
      setQuickCreateStatus({ error: "", success: "Proveedor creado correctamente." });

      if (createdSupplierId) {
        setForm((prev) => ({ ...prev, supplierId: createdSupplierId }));
      }
      closeQuickCreate();
    } catch (submitError) {
      setQuickCreateStatus({ error: submitError.message, success: "" });
    }
  }

  async function handleQuickCreateConcept(event) {
    event.preventDefault();
    setQuickCreateStatus({ error: "", success: "" });

    try {
      const payload = {
        ...conceptQuickForm,
        dimensionSchema: conceptQuickForm.requiresDimensions
          ? {
              width: true,
              height: ["area_based"].includes(conceptQuickForm.calculationType),
              length: ["linear_based", "height_based"].includes(conceptQuickForm.calculationType),
              inputUnit: "cm",
            }
          : null,
      };

      const created = await apiRequest("/concepts", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const createdConceptId = created?.item?.id || created?.id;

      await refreshConcepts();
      setConceptQuickForm(initialConceptQuickForm);
      setQuickCreateStatus({ error: "", success: "Concepto creado correctamente." });

      if (createdConceptId) {
        setForm((prev) => ({
          ...prev,
          categoryFilterId: payload.categoryId,
          conceptId: createdConceptId,
        }));
      }
      closeQuickCreate();
    } catch (submitError) {
      setQuickCreateStatus({ error: submitError.message, success: "" });
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus({ error: "", success: "" });

    if (!selectedConcept) {
      setStatus({ error: "Selecciona un concepto válido.", success: "" });
      return;
    }

    if (requiresDimensions && (!form.largo || !form.ancho)) {
      setStatus({ error: "Para conceptos dimensionales captura largo y ancho.", success: "" });
      return;
    }
    if (!isValidMoneyInput(form.amount)) {
      setStatus({ error: "Precio inválido. Usa un número positivo con máximo 2 decimales.", success: "" });
      return;
    }
    if (!form.unit.trim()) {
      setStatus({ error: "La unidad es obligatoria. Selecciona un concepto con unidad o captura una manualmente.", success: "" });
      return;
    }

    try {
      const normalizedProjectIds = canonicalizeProjectIds(form.projectIds);

      await apiRequest("/price-records", {
        headers: { "x-capture-flow": "quick" },
        method: "POST",
        body: JSON.stringify({
          mainType: selectedConcept.mainType,
          categoryId: selectedConcept.categoryId,
          conceptId: form.conceptId,
          supplierId: form.supplierId || null,
          projectIds: normalizedProjectIds,
          projectId: normalizedProjectIds[0] || null,
          unit: form.unit.trim(),
          priceDate: form.priceDate,
          pricingMode: effectivePricingMode,
          amount: normalizeMoneyDraft(form.amount),
          location: form.location,
          observations: form.observations,
          dimensions: requiresDimensions
            ? {
                measurementUnit: form.measurementUnit,
                largo: Number(form.largo),
                ancho: Number(form.ancho),
                width: Number(form.largo),
                height: Number(form.ancho),
              }
            : undefined,
        }),
      });

      setForm(initialForm);
      setStatus({ error: "", success: "Precio guardado correctamente." });
    } catch (submitError) {
      setStatus({ error: submitError.message, success: "" });
    }
  }

  if (!canQuickCapture || !canCreatePrice) {
    return (
      <section>
        <PageHeader title="Captura rápida" description="No tienes permisos para registrar precios en este flujo." />
      </section>
    );
  }

  return (
    <section>
      <PageHeader
        title="Captura rápida"
        description="Registra un nuevo precio con solo lo indispensable. Los campos técnicos quedan en detalles opcionales."
      />

      <form className="card form-grid" onSubmit={handleSubmit}>
        <h3>Nuevo precio</h3>

        <div className="subgrid quick-capture-catalog-head">
          <label className="field">
            <span>Categoría (filtro)</span>
            <select
              value={form.categoryFilterId}
              onChange={(event) => setForm((prev) => ({ ...prev, categoryFilterId: event.target.value }))}
            >
              <option value="">Todas las categorías</option>
              {categories.map((category) => (
                <option key={category.id || category._id} value={category.id || category._id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field quick-capture-concept-field">
            <span>Concepto</span>
            <select value={form.conceptId} onChange={(event) => setForm((prev) => ({ ...prev, conceptId: event.target.value }))} required>
              <option value="">Selecciona un concepto</option>
              {filteredConcepts.map((concept) => (
                <option key={concept.id} value={concept.id}>
                  {concept.name}
                </option>
              ))}
            </select>
            <small className="muted quick-capture-results">Resultados: {filteredConcepts.length}</small>
          </label>

          {canManageCatalogs ? (
            <div className="quick-capture-actions-column" role="group" aria-label="Altas rápidas de catálogos">
              <span className="quick-capture-actions-spacer" aria-hidden="true" />
              <div className="quick-create-actions">
                <button type="button" className="ghost-button" onClick={() => openQuickCreate("concept")}>+ Nuevo concepto</button>
                <button type="button" className="ghost-button" onClick={() => openQuickCreate("supplier")}>+ Nuevo proveedor</button>
                <button type="button" className="ghost-button" onClick={() => openQuickCreate("category")}>+ Nueva categoría</button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="subgrid">
          <label className="field">
            <span>{isLaborConcept ? "Sueldo / pago total" : "Precio"}</span>
            <input
              type="text"
              inputMode="decimal"
              value={form.amount}
              onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
              onBlur={(event) => setForm((prev) => ({ ...prev, amount: normalizeMoneyDraft(event.target.value) }))}
              required
            />
          </label>

          <label className="field">
            <span>Fecha</span>
            <input
              type="date"
              value={form.priceDate}
              onChange={(event) => setForm((prev) => ({ ...prev, priceDate: event.target.value }))}
              required
            />
          </label>

          {isLaborConcept ? (
            <label className="field">
              <span>Tipo de captura</span>
              <input value="Pago total por periodo (mano de obra)" readOnly />
            </label>
          ) : (
            <label className="field">
              <span>Modo</span>
              <select
                value={form.pricingMode}
                onChange={(event) => setForm((prev) => ({ ...prev, pricingMode: event.target.value }))}
              >
                <option value="unit_price">Precio unitario</option>
                <option value="total_price">Precio total</option>
              </select>
            </label>
          )}
        </div>

        <label className="field">
          <span>Unidad</span>
          <input
            value={form.unit}
            onChange={(event) => setForm((prev) => ({ ...prev, unit: event.target.value }))}
            placeholder={conceptBaseUnit ? "" : "Ej. m2, pieza, litro"}
            readOnly={Boolean(conceptBaseUnit)}
            required
          />
          {!conceptBaseUnit ? <small className="muted">Este concepto no tiene unidad base; captúrala para guardar.</small> : null}
        </label>

        <div className="subgrid">
          <label className="field">
            <span>Proveedor</span>
            <select value={form.supplierId} onChange={(event) => setForm((prev) => ({ ...prev, supplierId: event.target.value }))}>
              <option value="">Sin proveedor</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id || supplier._id} value={supplier.id || supplier._id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Obras</span>
            <select
              multiple
              value={form.projectIds}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  projectIds: canonicalizeProjectIds(Array.from(event.target.selectedOptions, (option) => option.value)),
                }))
              }
            >
              {projects.map((project) => (
                <option key={project.id || project._id} value={project.id || project._id}>
                  {project.name}
                </option>
              ))}
            </select>
            <small className="muted">Si no seleccionas ninguna, el histórico se guarda como general (sin obra).</small>
          </label>
        </div>

        <details className="details-block">
          <summary>Más detalles</summary>
          <div className="form-grid details-content">
            {requiresDimensions ? (
              <div className="subgrid">
                <label className="field">
                  <span>Largo ({form.measurementUnit})</span>
                  <input value={form.largo} onChange={(event) => setForm((prev) => ({ ...prev, largo: event.target.value }))} />
                </label>
                <label className="field">
                  <span>Ancho ({form.measurementUnit})</span>
                  <input value={form.ancho} onChange={(event) => setForm((prev) => ({ ...prev, ancho: event.target.value }))} />
                </label>
              </div>
            ) : null}
            {requiresDimensions ? (
              <label className="field">
                <span>Unidad de captura</span>
                <select
                  value={form.measurementUnit}
                  onChange={(event) => setForm((prev) => ({ ...prev, measurementUnit: event.target.value }))}
                >
                  <option value="cm">cm</option>
                  <option value="m">m</option>
                </select>
              </label>
            ) : null}
            <label className="field">
              <span>Ubicación</span>
              <input value={form.location} onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))} />
            </label>
            <label className="field">
              <span>Observaciones</span>
              <textarea
                value={form.observations}
                onChange={(event) => setForm((prev) => ({ ...prev, observations: event.target.value }))}
                rows="3"
              />
            </label>
          </div>
        </details>

        {status.error ? <div className="alert error">{status.error}</div> : null}
        {status.success ? <div className="alert">{status.success}</div> : null}

        <div className="button-row">
          <button type="submit" className="primary-button">
            Guardar precio
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              setForm(initialForm);
              setStatus({ error: "", success: "" });
            }}
          >
            Limpiar
          </button>
        </div>
      </form>

      {quickCreateType ? (
        <div className="simple-modal-backdrop" role="presentation">
          <div className="simple-modal quick-create-modal">
            {quickCreateType === "category" ? (
              <form className="form-grid" onSubmit={handleQuickCreateCategory}>
                <h3>Nueva categoría</h3>
                <label className="field">
                  <span>Nombre</span>
                  <input value={categoryQuickForm.name} onChange={(event) => setCategoryQuickForm((prev) => ({ ...prev, name: event.target.value }))} required />
                </label>
                <label className="field">
                  <span>Tipo principal</span>
                  <select value={categoryQuickForm.mainType} onChange={(event) => setCategoryQuickForm((prev) => ({ ...prev, mainType: event.target.value }))}>
                    {MAIN_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Descripción</span>
                  <textarea value={categoryQuickForm.description} onChange={(event) => setCategoryQuickForm((prev) => ({ ...prev, description: event.target.value }))} rows="3" />
                </label>
                {quickCreateStatus.error ? <div className="alert error">{quickCreateStatus.error}</div> : null}
                <div className="button-row">
                  <button type="submit" className="primary-button">Guardar categoría</button>
                  <button type="button" className="ghost-button" onClick={closeQuickCreate}>Cancelar</button>
                </div>
              </form>
            ) : null}

            {quickCreateType === "supplier" ? (
              <form className="form-grid" onSubmit={handleQuickCreateSupplier}>
                <h3>Nuevo proveedor</h3>
                <label className="field">
                  <span>Nombre comercial</span>
                  <input value={supplierQuickForm.name} onChange={(event) => setSupplierQuickForm((prev) => ({ ...prev, name: event.target.value }))} required />
                </label>
                <label className="field">
                  <span>Razón social</span>
                  <input value={supplierQuickForm.legalName} onChange={(event) => setSupplierQuickForm((prev) => ({ ...prev, legalName: event.target.value }))} />
                </label>
                <label className="field">
                  <span>Contacto</span>
                  <input value={supplierQuickForm.contactName} onChange={(event) => setSupplierQuickForm((prev) => ({ ...prev, contactName: event.target.value }))} />
                </label>
                <label className="field">
                  <span>Teléfono</span>
                  <input value={supplierQuickForm.phone} onChange={(event) => setSupplierQuickForm((prev) => ({ ...prev, phone: event.target.value }))} />
                </label>
                <label className="field">
                  <span>Email</span>
                  <input value={supplierQuickForm.email} onChange={(event) => setSupplierQuickForm((prev) => ({ ...prev, email: event.target.value }))} />
                </label>
                <label className="field">
                  <span>Notas</span>
                  <textarea value={supplierQuickForm.notes} onChange={(event) => setSupplierQuickForm((prev) => ({ ...prev, notes: event.target.value }))} rows="3" />
                </label>
                {quickCreateStatus.error ? <div className="alert error">{quickCreateStatus.error}</div> : null}
                <div className="button-row">
                  <button type="submit" className="primary-button">Guardar proveedor</button>
                  <button type="button" className="ghost-button" onClick={closeQuickCreate}>Cancelar</button>
                </div>
              </form>
            ) : null}

            {quickCreateType === "concept" ? (
              <form className="form-grid" onSubmit={handleQuickCreateConcept}>
                <h3>Nuevo concepto</h3>
                <label className="field">
                  <span>Nombre</span>
                  <input value={conceptQuickForm.name} onChange={(event) => setConceptQuickForm((prev) => ({ ...prev, name: event.target.value }))} required />
                </label>
                <label className="field">
                  <span>Categoría</span>
                  <select value={conceptQuickForm.categoryId} onChange={(event) => setConceptQuickForm((prev) => ({ ...prev, categoryId: event.target.value }))} required>
                    <option value="">Selecciona una categoría</option>
                    {categories.map((category) => (
                      <option key={category.id || category._id} value={category.id || category._id}>{category.name}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Tipo principal</span>
                  <select value={conceptQuickForm.mainType} onChange={(event) => setConceptQuickForm((prev) => ({ ...prev, mainType: event.target.value }))}>
                    {MAIN_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Unidad principal</span>
                  <input value={conceptQuickForm.primaryUnit} onChange={(event) => setConceptQuickForm((prev) => ({ ...prev, primaryUnit: event.target.value }))} required />
                </label>
                <label className="field">
                  <span>Tipo de cálculo</span>
                  <select value={conceptQuickForm.calculationType} onChange={(event) => setConceptQuickForm((prev) => ({ ...prev, calculationType: event.target.value }))}>
                    <option value="fixed_unit">fixed_unit</option>
                    <option value="area_based">area_based</option>
                    <option value="linear_based">linear_based</option>
                    <option value="height_based">height_based</option>
                    <option value="custom_formula">custom_formula</option>
                  </select>
                </label>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={conceptQuickForm.requiresDimensions}
                    onChange={(event) => setConceptQuickForm((prev) => ({ ...prev, requiresDimensions: event.target.checked }))}
                  />
                  <span>Requiere dimensiones</span>
                </label>
                <label className="field">
                  <span>Descripción</span>
                  <textarea value={conceptQuickForm.description} onChange={(event) => setConceptQuickForm((prev) => ({ ...prev, description: event.target.value }))} rows="3" />
                </label>
                {quickCreateStatus.error ? <div className="alert error">{quickCreateStatus.error}</div> : null}
                <div className="button-row">
                  <button type="submit" className="primary-button">Guardar concepto</button>
                  <button type="button" className="ghost-button" onClick={closeQuickCreate}>Cancelar</button>
                </div>
              </form>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default QuickCapturePage;
