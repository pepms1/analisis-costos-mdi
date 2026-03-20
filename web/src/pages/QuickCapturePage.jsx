import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api/client";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../contexts/AuthContext";
import { PERMISSIONS } from "../utils/permissions";

const initialForm = {
  conceptId: "",
  supplierId: "",
  projectId: "",
  priceDate: new Date().toISOString().slice(0, 10),
  amount: "",
  pricingMode: "unit_price",
  location: "",
  observations: "",
  largo: "",
  ancho: "",
  measurementUnit: "cm",
};

const LABOR_PRICING_MODE = "total_price";

function QuickCapturePage() {
  const { hasPermission } = useAuth();
  const canQuickCapture = hasPermission(PERMISSIONS.PRICES_QUICK_CAPTURE);
  const canCreatePrice = hasPermission(PERMISSIONS.PRICES_CREATE);
  const [concepts, setConcepts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState({ error: "", success: "" });

  useEffect(() => {
    Promise.all([apiRequest("/concepts"), apiRequest("/suppliers"), apiRequest("/projects")])
      .then(([conceptsData, suppliersData, projectsData]) => {
        setConcepts((conceptsData.items || []).filter((concept) => concept.isActive));
        setSuppliers(suppliersData.items || []);
        setProjects((projectsData.items || []).filter((project) => project.isActive));
      })
      .catch(() => {
        setConcepts([]);
        setSuppliers([]);
        setProjects([]);
      });
  }, []);

  const selectedConcept = useMemo(() => concepts.find((concept) => concept.id === form.conceptId), [concepts, form.conceptId]);
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

    try {
      await apiRequest("/price-records", {
        headers: { "x-capture-flow": "quick" },
        method: "POST",
        body: JSON.stringify({
          mainType: selectedConcept.mainType,
          categoryId: selectedConcept.categoryId,
          conceptId: form.conceptId,
          supplierId: form.supplierId || null,
          projectId: form.projectId || null,
          unit: selectedConcept.primaryUnit || "pieza",
          priceDate: form.priceDate,
          pricingMode: effectivePricingMode,
          amount: Number(form.amount),
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

        <label className="field">
          <span>Concepto</span>
          <select value={form.conceptId} onChange={(event) => setForm((prev) => ({ ...prev, conceptId: event.target.value }))} required>
            <option value="">Selecciona un concepto</option>
            {concepts.map((concept) => (
              <option key={concept.id} value={concept.id}>
                {concept.name}
              </option>
            ))}
          </select>
        </label>

        <div className="subgrid">
          <label className="field">
            <span>{isLaborConcept ? "Sueldo / pago total" : "Precio"}</span>
            <input
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
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
            <span>Obra</span>
            <select value={form.projectId} onChange={(event) => setForm((prev) => ({ ...prev, projectId: event.target.value }))}>
              <option value="">Sin obra</option>
              {projects.map((project) => (
                <option key={project.id || project._id} value={project.id || project._id}>
                  {project.name}
                </option>
              ))}
            </select>
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
    </section>
  );
}

export default QuickCapturePage;
