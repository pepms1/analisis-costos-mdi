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

function AdjustmentsPage() {
  const [items, setItems] = useState([]);
  const [rows, setRows] = useState(defaultRows);
  const [name, setName] = useState("Inflación anual");
  const [editingId, setEditingId] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [error, setError] = useState("");

  async function loadItems() {
    const data = await apiRequest(`/adjustments?status=${statusFilter}`);
    setItems(data.items);
  const [status, setStatus] = useState({ error: "", success: "" });

  async function loadItems() {
    const data = await apiRequest("/adjustments");
    setItems(data.items || []);
  }

  useEffect(() => {
    loadItems().catch(() => setItems([]));
  }, [statusFilter]);

  const inflationItem = useMemo(
    () => items.find((item) => item.adjustmentType === "inflation" && item.scopeType === "general" && item.isActive),
    [items]
  );

  useEffect(() => {
    if (!inflationItem) {
      setRows(defaultRows);
      setName("Inflación anual");
      setEditingId("");
      return;
    }

    setRows(factorsToRows(inflationItem.factors));
    setName(inflationItem.name || "Inflación anual");
    setEditingId(inflationItem.id);
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
      await apiRequest(shouldActivate ? `/adjustments/${item.id}/reactivate` : `/adjustments/${item.id}`, {
        method: shouldActivate ? "PATCH" : "DELETE",
      });
      if (editingId === item.id) {
        setEditingId("");
        setForm(initialForm);
      }
      await loadItems();
    } catch (deleteError) {
      setError(deleteError.message);
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
          </form>
        ) : (
          <div className="card">
            <h3>Consulta de ajustes</h3>
            <p className="muted">Tu rol actual solo tiene permisos de lectura en este modulo.</p>
          </div>
        )}

        <DataTable
          columns={[
            { key: "name", label: "Nombre" },
            { key: "adjustmentType", label: "Tipo" },
            { key: "scopeType", label: "Alcance" },
            { key: "status", label: "Estado", render: (_value, row) => (row.isActive ? "Activo" : "Inactivo") },
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
                            name: row.name || "",
                            adjustmentType: row.adjustmentType || "inflation",
                            scopeType: row.scopeType || "general",
                            factors: JSON.stringify(row.factors || [], null, 2),
                          });
                          setError("");
                        }}
                        onToggleActive={() => handleToggleActive(row)}
                        isActive={row.isActive}
                      />
                    ),
                  },
                ]
              : []),
          ]}
          rows={items}
        />
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
          ))}
        </div>

        <div className="button-row">
          <button
            type="button"
            className="ghost-button"
            onClick={() => setRows((prev) => [...prev, { year: "", rate: "" }])}
          >
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
    </section>
  );
}

export default AdjustmentsPage;
