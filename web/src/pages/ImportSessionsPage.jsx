import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { apiRequest } from "../api/client";

const STATUS_FILTERS = [
  { key: "all", label: "Todas" },
  { key: "reviewing", label: "Reviewing" },
  { key: "confirmed", label: "Confirmed" },
  { key: "failed", label: "Failed" },
  { key: "discarded", label: "Discarded" },
];

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ImportSessionsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (status && status !== "all") params.set("status", status);
    if (search.trim()) params.set("search", search.trim());
    const serialized = params.toString();
    return serialized ? `?${serialized}` : "";
  }, [status, search]);

  async function loadSessions() {
    setLoading(true);
    setError("");
    try {
      const response = await apiRequest(`/import-sessions${query}`);
      setItems(response.items || []);
    } catch (requestError) {
      setError(requestError.message || "No se pudieron cargar las sesiones");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSessions();
  }, [query]);

  async function updateStatus(sessionId, nextStatus) {
    setError("");
    setSuccess("");
    try {
      await apiRequest(`/import-sessions/${sessionId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      setSuccess(`Sesión marcada como ${nextStatus}.`);
      await loadSessions();
    } catch (requestError) {
      setError(requestError.message || "No se pudo actualizar el estado");
    }
  }

  async function deleteSession(sessionId) {
    if (!window.confirm("¿Eliminar la sesión y todo su staging? Esta acción no se puede deshacer.")) return;

    setError("");
    setSuccess("");
    try {
      await apiRequest(`/import-sessions/${sessionId}`, { method: "DELETE" });
      setSuccess("Sesión eliminada correctamente.");
      await loadSessions();
    } catch (requestError) {
      setError(requestError.message || "No se pudo eliminar la sesión");
    }
  }

  return (
    <section className="page-shell">
      <PageHeader
        title="Sesiones de importación"
        description="Retoma sesiones en progreso, revisa su estado y administra lotes sin perder avances."
      />

      <article className="card import-assistant-card">
        <div className="button-row">
          <Link className="primary-button" to="/importacion-excel">Nueva importación</Link>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por archivo"
            className="session-search"
          />
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            {STATUS_FILTERS.map((item) => (
              <option key={item.key} value={item.key}>{item.label}</option>
            ))}
          </select>
        </div>

        {error ? <p className="import-error">{error}</p> : null}
        {success ? <p className="import-success">{success}</p> : null}

        <div className="preview-table-wrap">
          <table className="preview-table">
            <thead>
              <tr>
                <th>Archivo</th>
                <th>Creación</th>
                <th>Última actualización</th>
                <th>Usuario</th>
                <th>Estado</th>
                <th>Totales</th>
                <th>Decisiones</th>
                <th>Aplicadas</th>
                <th>Errores</th>
                <th>Proveedor/Obra</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((session) => (
                <tr key={session.id}>
                  <td>{session.fileName || "(sin nombre)"}</td>
                  <td>{formatDate(session.createdAt)}</td>
                  <td>{formatDate(session.updatedAt)}</td>
                  <td>{session.createdByName || "—"}</td>
                  <td><span className={`status-chip status-chip-${session.status}`}>{session.status}</span></td>
                  <td>{session.counters?.totalRows || 0}</td>
                  <td>
                    A:{session.counters?.accepted || 0} / E:{session.counters?.edited || 0} / I:{session.counters?.ignored || 0}
                  </td>
                  <td>{session.counters?.applied || 0}</td>
                  <td>{session.counters?.errors || 0}</td>
                  <td>{session.detectedSupplierName || "—"} / {session.detectedWorkName || "—"}</td>
                  <td>
                    <div className="row-actions">
                      <Link className="ghost-button" to={`/importacion-excel?sessionId=${session.id}`}>Abrir / continuar</Link>
                      <button type="button" onClick={() => updateStatus(session.id, "discarded")}>Descartar</button>
                      <button type="button" onClick={() => deleteSession(session.id)}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!items.length && !loading ? (
                <tr>
                  <td colSpan={11} className="empty-state">No hay sesiones para los filtros seleccionados.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

export default ImportSessionsPage;
