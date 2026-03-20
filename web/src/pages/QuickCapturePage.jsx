import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api/client";
import PageHeader from "../components/PageHeader";

const initialForm = {
  conceptId: "",
  supplierId: "",
  projectId: "",
  priceDate: new Date().toISOString().slice(0, 10),
  amount: "",
  pricingMode: "unit_price",
  location: "",
  observations: "",
  width: "",
  height: "",
  length: "",
  measurementUnit: "cm",
};

function QuickCapturePage() {
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

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus({ error: "", success: "" });

    if (!selectedConcept) {
      setStatus({ error: "Selecciona un concepto válido.", success: "" });
      return;
    }

    try {
      await apiRequest("/price-records", {
        method: "POST",
        body: JSON.stringify({
          mainType: selectedConcept.mainType,
          categoryId: selectedConcept.categoryId,
          conceptId: form.conceptId,
          supplierId: form.supplierId || null,
          projectId: form.projectId || null,
          unit: selectedConcept.primaryUnit || "pieza",
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
        }),
      });

      setForm(initialForm);
      setStatus({ error: "", success: "Precio guardado correctamente." });
    } catch (submitError) {
      setStatus({ error: submitError.message, success: "" });
    }
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
            <span>Precio</span>
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
            <div className="subgrid">
              <label className="field">
                <span>Ancho</span>
                <input value={form.width} onChange={(event) => setForm((prev) => ({ ...prev, width: event.target.value }))} />
              </label>
              <label className="field">
                <span>Alto</span>
                <input value={form.height} onChange={(event) => setForm((prev) => ({ ...prev, height: event.target.value }))} />
              </label>
              <label className="field">
                <span>Longitud</span>
                <input value={form.length} onChange={(event) => setForm((prev) => ({ ...prev, length: event.target.value }))} />
              </label>
            </div>
            <label className="field">
              <span>Unidad de medida</span>
              <select
                value={form.measurementUnit}
                onChange={(event) => setForm((prev) => ({ ...prev, measurementUnit: event.target.value }))}
              >
                <option value="cm">cm</option>
                <option value="m">m</option>
              </select>
            </label>
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
