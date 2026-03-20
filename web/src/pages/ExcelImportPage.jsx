import { useMemo, useState } from "react";
import PageHeader from "../components/PageHeader";
import { apiRequest } from "../api/client";

const MAPPING_FIELDS = [
  { key: "concept", label: "Concepto / descripción / partida", required: true },
  { key: "unit", label: "Unidad", required: false },
  { key: "quantity", label: "Cantidad", required: false },
  { key: "unitPrice", label: "Precio unitario", required: false },
  { key: "amount", label: "Importe", required: false },
  { key: "supplier", label: "Proveedor", required: false },
  { key: "date", label: "Fecha", required: false },
  { key: "originalCategory", label: "Categoría original", required: false },
  { key: "observations", label: "Observaciones", required: false },
];

function readFileBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || "");
      const [, base64 = ""] = result.split(",");
      resolve(base64);
    };

    reader.onerror = () => reject(new Error("No se pudo leer el archivo seleccionado"));
    reader.readAsDataURL(file);
  });
}

function ExcelImportPage() {
  const [session, setSession] = useState(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [sheets, setSheets] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [preview, setPreview] = useState(null);
  const [columnMapping, setColumnMapping] = useState({});
  const [headerRowIndex, setHeaderRowIndex] = useState(1);
  const [dataStartRowIndex, setDataStartRowIndex] = useState(2);
  const [ignoreEmptyRows, setIgnoreEmptyRows] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [parseSummary, setParseSummary] = useState(null);
  const [parseRows, setParseRows] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const previewColumns = useMemo(() => preview?.columns || [], [preview]);

  async function loadPreview(sessionId, sheetName) {
    if (!sessionId || !sheetName) {
      return;
    }

    const response = await apiRequest(`/import-sessions/${sessionId}/preview?sheet=${encodeURIComponent(sheetName)}`);
    const item = response.item;

    setPreview(item);
    setSelectedSheet(item.sheetName || sheetName);
    setHeaderRowIndex(item.detectedHeaderRowIndex || 1);
    setDataStartRowIndex(item.detectedDataStartRowIndex || 2);
    setColumnMapping(item.detectedMapping || {});
  }

  async function loadParsedRows(sessionId) {
    if (!sessionId) return;

    setRowsLoading(true);
    try {
      const response = await apiRequest(`/import-sessions/${sessionId}/rows`);
      setParseRows(response.items || []);
    } finally {
      setRowsLoading(false);
    }
  }

  async function handleFileUpload(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    setParseSummary(null);
    setParseRows([]);

    try {
      const fileBase64 = await readFileBase64(file);

      const created = await apiRequest("/import-sessions", {
        method: "POST",
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          sourceType: file.name.toLowerCase().endsWith(".csv") ? "csv" : "excel",
        }),
      });

      const sessionId = created.item.id;

      const uploaded = await apiRequest(`/import-sessions/${sessionId}/upload`, {
        method: "POST",
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          fileBase64,
        }),
      });

      setSession(uploaded.item);
      setSelectedFileName(file.name);
      setSheets(uploaded.sheets || []);

      const firstSheet = uploaded.sheets?.[0]?.name || "";
      setSelectedSheet(firstSheet);

      if (firstSheet) {
        await loadPreview(sessionId, firstSheet);
      }

      setSuccess("Archivo cargado correctamente. Ajusta el mapeo, guarda y luego procesa filas.");
    } catch (uploadError) {
      setError(uploadError.message || "No se pudo cargar el archivo");
    } finally {
      setLoading(false);
    }
  }

  async function handleSheetChange(event) {
    const nextSheet = event.target.value;
    setSelectedSheet(nextSheet);

    if (!session?.id || !nextSheet) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      await loadPreview(session.id, nextSheet);
    } catch (previewError) {
      setError(previewError.message || "No se pudo cargar el preview");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveMapping() {
    if (!session?.id || !selectedSheet) {
      setError("Primero carga un archivo y selecciona una hoja.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const cleanedMapping = Object.fromEntries(MAPPING_FIELDS.map((field) => [field.key, columnMapping[field.key] || null]));

      const response = await apiRequest(`/import-sessions/${session.id}/mapping`, {
        method: "POST",
        body: JSON.stringify({
          sheetName: selectedSheet,
          headerRowIndex: Number(headerRowIndex) || 1,
          dataStartRowIndex: Number(dataStartRowIndex) || 2,
          ignoreEmptyRows,
          columnMappingJson: cleanedMapping,
        }),
      });

      setSession(response.item);
      setSuccess("Configuración guardada. Ahora puedes ejecutar el parseo real de filas.");
    } catch (saveError) {
      setError(saveError.message || "No se pudo guardar el mapeo");
    } finally {
      setSaving(false);
    }
  }

  async function handleParseRows() {
    if (!session?.id) {
      setError("No hay sesión activa para procesar.");
      return;
    }

    setParsing(true);
    setError("");
    setSuccess("");

    try {
      const response = await apiRequest(`/import-sessions/${session.id}/parse`, { method: "POST" });
      setParseSummary(response.summary || null);
      setSession(response.item || session);
      await loadParsedRows(session.id);
      setSuccess("Parseo ejecutado. Se regeneraron las filas staging de esta sesión.");
    } catch (parseError) {
      setError(parseError.message || "No se pudo procesar la sesión");
    } finally {
      setParsing(false);
    }
  }

  function renderStatusBadge(status) {
    return <span className={`status-chip status-chip-${status || "pending"}`}>{status || "pending"}</span>;
  }

  return (
    <section className="page-shell">
      <PageHeader
        title="Importación asistida desde Excel"
        description="Stage 3: parseo real hacia staging, normalización base y visualización inicial de resultados parseados."
      />

      <article className="card import-assistant-card">
        <div className="import-toolbar">
          <label className="file-picker" htmlFor="excel-file-input">
            Seleccionar archivo (.xlsx / .xls / .csv)
          </label>
          <input id="excel-file-input" type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} disabled={loading} />
          <p className="muted">{selectedFileName ? `Archivo cargado: ${selectedFileName}` : "Aún no hay archivo cargado."}</p>
        </div>

        {error ? <p className="import-error">{error}</p> : null}
        {success ? <p className="import-success">{success}</p> : null}

        <div className="import-grid">
          <section className="import-panel card-subtle">
            <h3>Hojas detectadas</h3>
            <p className="muted">Selecciona la hoja que contiene los datos a mapear.</p>
            <select value={selectedSheet} onChange={handleSheetChange} disabled={!sheets.length || loading}>
              <option value="">Seleccionar hoja</option>
              {sheets.map((sheet) => (
                <option key={sheet.name} value={sheet.name}>
                  {sheet.name} ({sheet.rowCount || 0} filas estimadas)
                </option>
              ))}
            </select>
          </section>

          <section className="import-panel card-subtle">
            <h3>Opciones de estructura</h3>
            <p className="muted">Ajusta filas de encabezado y arranque de datos.</p>
            <div className="mapping-options-grid">
              <label>
                Fila de encabezados
                <input type="number" min="1" value={headerRowIndex} onChange={(event) => setHeaderRowIndex(event.target.value)} />
              </label>
              <label>
                Fila inicial de datos
                <input type="number" min="1" value={dataStartRowIndex} onChange={(event) => setDataStartRowIndex(event.target.value)} />
              </label>
            </div>
            <label className="checkline">
              <input type="checkbox" checked={ignoreEmptyRows} onChange={(event) => setIgnoreEmptyRows(event.target.checked)} />
              Ignorar filas vacías
            </label>
          </section>
        </div>

        <section className="import-panel card-subtle">
          <h3>Mapeo manual de columnas</h3>
          <p className="muted">Puedes corregir la detección automática y dejar opcionales en blanco.</p>
          <div className="mapping-grid">
            {MAPPING_FIELDS.map((field) => (
              <label key={field.key}>
                {field.label} {field.required ? <span className="required-dot">*</span> : null}
                <select
                  value={columnMapping[field.key] || ""}
                  onChange={(event) => setColumnMapping((prev) => ({ ...prev, [field.key]: event.target.value || null }))}
                >
                  <option value="">Sin asignar</option>
                  {previewColumns.map((column) => (
                    <option key={column.key} value={column.key}>
                      {column.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </section>

        <section className="import-panel card-subtle">
          <div className="preview-header">
            <h3>Preview inicial de la hoja</h3>
            <span className="muted">Mostrando hasta 30 filas para inspección visual.</span>
          </div>
          <div className="preview-table-wrap">
            <table className="preview-table">
              <tbody>
                {(preview?.rows || []).slice(0, 30).map((row, rowIndex) => (
                  <tr key={`${rowIndex}-${row.join("|")}`}>
                    <th>#{rowIndex + 1}</th>
                    {row.map((value, columnIndex) => (
                      <td key={`${rowIndex}-${columnIndex}`}>{value || "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {!preview?.rows?.length ? <p className="muted">Sin preview disponible todavía.</p> : null}
          </div>
        </section>

        <div className="button-row">
          <button type="button" className="primary-button" onClick={handleSaveMapping} disabled={saving || loading || !session?.id}>
            {saving ? "Guardando..." : "Guardar configuración"}
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={handleParseRows}
            disabled={parsing || saving || loading || !session?.id || session?.status === "uploaded"}
          >
            {parsing ? "Procesando..." : "Procesar filas"}
          </button>
          <p className="muted">Estado sesión: {session?.status || "sin sesión"}</p>
        </div>

        {parseSummary ? (
          <section className="import-panel card-subtle">
            <h3>Resumen de parseo</h3>
            <div className="parse-summary-grid">
              <p>Revisadas: <strong>{parseSummary.totalReviewed}</strong></p>
              <p>Creadas: <strong>{parseSummary.totalCreated}</strong></p>
              <p>Ignoradas: <strong>{parseSummary.totalIgnored}</strong></p>
              <p>Warnings: <strong>{parseSummary.totalWarnings}</strong></p>
              <p>Errores: <strong>{parseSummary.totalErrors}</strong></p>
            </div>
          </section>
        ) : null}

        <section className="import-panel card-subtle">
          <div className="preview-header">
            <h3>Filas staging parseadas</h3>
            <span className="muted">{rowsLoading ? "Cargando..." : `${parseRows.length} filas en staging`}</span>
          </div>
          <div className="preview-table-wrap">
            <table className="preview-table">
              <thead>
                <tr>
                  <th>Fila Excel</th>
                  <th>Concepto</th>
                  <th>Unidad</th>
                  <th>Cantidad</th>
                  <th>P.U.</th>
                  <th>Importe</th>
                  <th>Proveedor</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {parseRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.sheetRowNumber}</td>
                    <td>{row.rawConcept || "—"}</td>
                    <td>{row.rawUnit || row.rawJson?.normalized?.unit || "—"}</td>
                    <td>{row.rawQuantity || row.rawJson?.normalized?.quantity || "—"}</td>
                    <td>{row.rawUnitPrice || row.rawJson?.normalized?.unitPrice || "—"}</td>
                    <td>{row.rawAmount || row.rawJson?.normalized?.amount || "—"}</td>
                    <td>{row.rawSupplier || "—"}</td>
                    <td>{row.rawDate || row.rawJson?.normalized?.dateIso || "—"}</td>
                    <td>{renderStatusBadge(row.parseStatus)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!parseRows.length ? <p className="muted">Sin filas parseadas aún. Guarda mapping y ejecuta “Procesar filas”.</p> : null}
          </div>
        </section>
      </article>
    </section>
  );
}

export default ExcelImportPage;
