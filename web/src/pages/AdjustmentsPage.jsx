import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api/client";
import CrudActions from "../components/CrudActions";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../contexts/AuthContext";

const defaultForm = { year: "", rate: "" };

function getYearSortValue(value) {
  const parsedYear = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isNaN(parsedYear) ? Number.POSITIVE_INFINITY : parsedYear;
}

function factorsToRows(factors = []) {
  const rows = factors.map((factor) => ({
    year: String(factor.label || ""),
    rate: Number((Number(factor.factor) - 1) * 100).toFixed(2),
  }));
  const byYear = new Map();
  rows.forEach((row) => byYear.set(row.year, row));
  return Array.from(byYear.values()).sort((a, b) => getYearSortValue(a.year) - getYearSortValue(b.year));
}

function rowsToFactors(rows) {
  return rows
    .filter((row) => row.year && row.rate !== "")
    .map((row) => ({
      label: String(row.year),
      factor: 1 + Number(row.rate) / 100,
    }))
    .sort((a, b) => getYearSortValue(a.label) - getYearSortValue(b.label));
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
    rows: factorsToRows(item.factors || []),
  };
}

function AdjustmentsPage() {
  const { user } = useAuth();
  const canDeleteInflation = user?.role === "superadmin";
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [name, setName] = useState("Inflación anual");
  const [editingId, setEditingId] = useState("");
  const [editingYear, setEditingYear] = useState("");
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

  const inflationHistoryRows = useMemo(() => {
    if (!inflationItem) return [];
    const rows = factorsToRows(inflationItem.factors || []);
    return rows.map((row) => ({
      key: `${inflationItem.id}-${row.year}`,
      adjustmentId: inflationItem.id,
      year: row.year,
      rate: row.rate,
      isActive: inflationItem.isActive,
      updatedAt: inflationItem.updatedAt || inflationItem.createdAt,
    }));
  }, [inflationItem]);

  useEffect(() => {
    if (inflationItem) {
      const inflationForm = adjustmentToForm(inflationItem);
      setName(inflationForm.name);
      setEditingId(inflationForm.id);
    } else {
      setName("Inflación anual");
      setEditingId("");
    }
  }, [inflationItem]);

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus({ error: "", success: "" });

    const currentRows = inflationItem ? factorsToRows(inflationItem.factors || []) : [];
    const normalizedYear = String(form.year).trim();
    const duplicateYear = currentRows.find((row) => row.year === normalizedYear);
    const isEditingSameYear = editingYear && editingYear === normalizedYear;

    if (duplicateYear && !isEditingSameYear) {
      setStatus({
        error: `Ya existe una inflación guardada para el año ${normalizedYear}. Si deseas cambiarla, edita ese registro existente.`,
        success: "",
      });
      return;
    }

    const withoutEdited = currentRows.filter((row) => row.year !== editingYear);
    const mergedRows = [...withoutEdited, { year: normalizedYear, rate: form.rate }];

    const payload = {
      name,
      adjustmentType: "inflation",
      scopeType: "general",
      factors: rowsToFactors(mergedRows),
    };

    try {
      await apiRequest(editingId ? `/adjustments/${editingId}` : "/adjustments", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      await loadItems();
      setForm(defaultForm);
      setEditingYear("");
      setStatus({ error: "", success: "Inflación guardada correctamente." });
    } catch (submitError) {
      setStatus({ error: submitError.message, success: "" });
    }
  }

  async function handleDelete(row) {
    const isSingleYearSetting = inflationHistoryRows.length === 1;
    const confirmationMessage = isSingleYearSetting
      ? `¿Seguro que deseas eliminar la inflación ${row.year} con valor ${row.rate}%? Esta acción es permanente.`
      : `¿Seguro que deseas eliminar solo el año ${row.year} con valor ${row.rate}%? Esta acción es permanente.`;

    if (!window.confirm(confirmationMessage)) return;

    try {
      setStatus({ error: "", success: "" });
      if (isSingleYearSetting) {
        await apiRequest(`/adjustments/${row.adjustmentId}`, { method: "DELETE" });
        if (editingId === row.adjustmentId) {
          setEditingId("");
          setName("Inflación anual");
        }
      } else {
        const remainingRows = inflationHistoryRows.filter((item) => item.year !== row.year).map((item) => ({ year: item.year, rate: item.rate }));
        await apiRequest(`/adjustments/${row.adjustmentId}`, {
          method: "PUT",
          body: JSON.stringify({
            name,
            adjustmentType: "inflation",
            scopeType: "general",
            factors: rowsToFactors(remainingRows),
          }),
        });
      }

      if (editingYear === row.year) {
        setForm(defaultForm);
        setEditingYear("");
      }
      await loadItems();
      setStatus({ error: "", success: `Registro ${row.year} (${row.rate}%) eliminado correctamente.` });
    } catch (deleteError) {
      setStatus({ error: `No se pudo eliminar ${row.year} (${row.rate}%): ${deleteError.message}`, success: "" });
    }
  }

  return (
    <section className="page-shell">
      <PageHeader
        title="Inflación"
        description="Configura la inflación anual de forma simple. Esta tabla es la fuente usada para estimar precios actuales."
      />

      <form className="card form-grid" onSubmit={handleSubmit}>
        <div className="inflation-grid">
          <label className="field">
            <span>Año</span>
            <input
              value={form.year}
              onChange={(event) => setForm((prev) => ({ ...prev, year: event.target.value }))}
              placeholder="2026"
              required
            />
          </label>
          <label className="field">
            <span>Inflación anual (%)</span>
            <input
              value={form.rate}
              onChange={(event) => setForm((prev) => ({ ...prev, rate: event.target.value }))}
              placeholder="5.00"
              type="number"
              step="0.01"
              required
            />
          </label>
        </div>

        <div className="alert">
          <strong>Valor en uso:</strong> {inflationItem?.name || "Sin configuración activa"}
          <p className="muted">Modo manual listo para evolucionar a fuente oficial en una siguiente fase.</p>
        </div>

        {status.error ? <div className="alert error">{status.error}</div> : null}
        {status.success ? <div className="alert">{status.success}</div> : null}

        <div className="button-row">
          <button type="submit" className="primary-button">
            {editingYear ? "Actualizar inflación" : "Guardar inflación"}
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              setForm(defaultForm);
              setEditingYear("");
              setStatus({ error: "", success: "" });
            }}
          >
            Limpiar formulario
          </button>
        </div>
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
              {canDeleteInflation ? <th>Acciones</th> : null}
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
                  {canDeleteInflation ? (
                    <td>
                      <CrudActions
                        onEdit={() => {
                          const selected = inflationItems.find((item) => item.id === row.adjustmentId);
                          if (!selected) return;
                          const selectedForm = adjustmentToForm(selected);
                          setEditingId(selectedForm.id);
                          setName(selectedForm.name);
                          setForm({ year: String(row.year), rate: String(row.rate) });
                          setEditingYear(String(row.year));
                          setStatus({ error: "", success: "" });
                        }}
                        onDelete={() => handleDelete(row)}
                      />
                    </td>
                  ) : null}
                </tr>
              ))
            ) : (
              <tr>
                <td className="empty-state" colSpan={canDeleteInflation ? 5 : 4}>
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
