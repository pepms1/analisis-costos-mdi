import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api/client";
import PageHeader from "../components/PageHeader";

const currentYear = new Date().getUTCFullYear();
const defaultRows = [currentYear - 1, currentYear, currentYear + 1].map((year) => ({ year: String(year), rate: "" }));

function factorsToRows(factors = []) {
  return factors
    .map((factor) => ({
      year: String(factor.label || ""),
      rate: Number((Number(factor.factor) - 1) * 100).toFixed(2),
    }))
    .sort((a, b) => Number(a.year) - Number(b.year));
}

function rowsToFactors(rows) {
  return rows
    .filter((row) => row.year && row.rate !== "")
    .map((row) => ({
      label: String(row.year),
      factor: 1 + Number(row.rate) / 100,
    }))
    .sort((a, b) => Number(a.label) - Number(b.label));
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function adjustmentToForm(item) {
  return {
    id: item.id,
    name: item.name || "Inflación anual",
    rows: factorsToRows(item.factors),
  };
}

function AdjustmentsPage() {
  const [items, setItems] = useState([]);
  const [rows, setRows] = useState(defaultRows);
  const [name, setName] = useState("Inflación anual");
  const [editingId, setEditingId] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [status, setStatus] = useState({ error: "", success: "" });

  async function loadItems() {
    const data = await apiRequest(`/adjustments?status=${statusFilter}`);
    setItems(data.items || []);
  }

  useEffect(() => {
    loadItems().catch(() => setItems([]));
  }, [statusFilter]);

  const inflationItems = useMemo(
    () =>
      items
        .filter((item) => item.adjustmentType === "inflation" && item.scopeType === "general")
        .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()),
    [items]
  );

  const inflationItem = useMemo(() => inflationItems.find((item) => item.isActive) || inflationItems[0], [inflationItems]);

  const inflationHistoryRows = useMemo(
    () =>
      inflationItems.flatMap((item) =>
        (item.factors || []).map((factor, index) => ({
          key: `${item.id}-${factor.label}-${index}`,
          adjustmentId: item.id,
          year: factor.label,
          rate: ((Number(factor.factor) - 1) * 100).toFixed(2),
          isActive: item.isActive,
          updatedAt: item.updatedAt || item.createdAt,
        }))
      ),
    [inflationItems]
  );

  useEffect(() => {
    if (!inflationItem) {
      setRows(defaultRows);
      setName("Inflación anual");
      setEditingId("");
      return;
    }

    const form = adjustmentToForm(inflationItem);
    setRows(form.rows.length ? form.rows : defaultRows);
    setName(form.name);
    setEditingId(form.id);
  }, [inflationItem]);

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus({ error: "", success: "" });

    const payload = {
      name,
      adjustmentType: "inflation",
      scopeType: "general",
      factors: rowsToFactors(rows),
    };

    try {
      await apiRequest(editingId ? `/adjustments/${editingId}` : "/adjustments", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      await loadItems();
      setStatus({ error: "", success: "Inflación guardada correctamente." });
    } catch (submitError) {
      setStatus({ error: submitError.message, success: "" });
    }
  }

  return (
    <section className="page-shell">
      <PageHeader
        title="Inflación"
        description="Configura la inflación anual de forma simple. Esta tabla es la fuente usada para estimar precios actuales."
      />

      <form className="card form-grid" onSubmit={handleSubmit}>
        <label className="field">
          <span>Nombre de la configuración</span>
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>

        <div className="inflation-grid">
          <div className="inflation-head">Año</div>
          <div className="inflation-head">Inflación anual (%)</div>
          {rows.map((row, index) => (
            <div className="inflation-row" key={`row-${index}`}>
              <input
                value={row.year}
                onChange={(event) =>
                  setRows((prev) => prev.map((item, rowIndex) => (rowIndex === index ? { ...item, year: event.target.value } : item)))
                }
                placeholder="2026"
              />
              <input
                value={row.rate}
                onChange={(event) =>
                  setRows((prev) => prev.map((item, rowIndex) => (rowIndex === index ? { ...item, rate: event.target.value } : item)))
                }
                placeholder="5.00"
                type="number"
                step="0.01"
              />
            </div>
          ))}
        </div>

        <div className="button-row">
          <button type="button" className="ghost-button" onClick={() => setRows((prev) => [...prev, { year: "", rate: "" }])}>
            Agregar año
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => setRows((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev))}
          >
            Quitar último
          </button>
        </div>

        <div className="alert">
          <strong>Valor en uso:</strong> {inflationItem?.name || "Sin configuración activa"}
          <p className="muted">Modo manual listo para evolucionar a fuente oficial en una siguiente fase.</p>
        </div>

        {status.error ? <div className="alert error">{status.error}</div> : null}
        {status.success ? <div className="alert">{status.success}</div> : null}

        <button type="submit" className="primary-button">
          Guardar inflación
        </button>
      </form>

      <div className="card form-grid">
        <label className="field">
          <span>Visibilidad</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="active">Solo activos</option>
            <option value="inactive">Solo inactivos</option>
            <option value="all">Todos</option>
          </select>
        </label>
      </div>

      <div className="card table-card">
        <h3>Valores anuales guardados</h3>
        <p className="muted">Aquí puedes revisar y confirmar lo que ya quedó registrado.</p>

        <table>
          <thead>
            <tr>
              <th>Año</th>
              <th>Inflación (%)</th>
              <th>Estatus</th>
              <th>Última actualización</th>
            </tr>
          </thead>
          <tbody>
            {inflationHistoryRows.length ? (
              inflationHistoryRows.map((row) => (
                <tr key={row.key}>
                  <td>{row.year}</td>
                  <td>{row.rate}</td>
                  <td>{row.isActive ? "Activo" : "Inactivo"}</td>
                  <td>{formatDate(row.updatedAt)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="empty-state" colSpan={4}>
                  Aún no hay inflaciones guardadas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default AdjustmentsPage;
