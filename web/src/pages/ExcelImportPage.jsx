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

  async function handleFileUpload(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

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

      setSuccess("Archivo cargado correctamente. Ajusta el mapeo y guarda la configuración.");
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
      const cleanedMapping = Object.fromEntries(
        MAPPING_FIELDS.map((field) => [field.key, columnMapping[field.key] || null])
      );

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
      setSuccess("Configuración guardada. La sesión quedó lista para el siguiente stage de parseo.");
    } catch (saveError) {
      setError(saveError.message || "No se pudo guardar el mapeo");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="page-shell">
      <PageHeader
        title="Importación asistida desde Excel"
        description="Carga real de archivo, lectura de hojas, preview inicial y mapeo manual para preparar el parseo del siguiente stage."
      />

      <article className="card import-assistant-card">
        <div className="import-toolbar">
          <label className="file-picker" htmlFor="excel-file-input">
            Seleccionar archivo (.xlsx / .xls / .csv)
          </label>
          <input
            id="excel-file-input"
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            disabled={loading}
          />
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
                <input
                  type="number"
                  min="1"
                  value={headerRowIndex}
                  onChange={(event) => setHeaderRowIndex(event.target.value)}
                />
              </label>
              <label>
                Fila inicial de datos
                <input
                  type="number"
                  min="1"
                  value={dataStartRowIndex}
                  onChange={(event) => setDataStartRowIndex(event.target.value)}
                />
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
            {saving ? "Guardando..." : "Guardar configuración y continuar"}
          </button>
          <p className="muted">Estado sesión: {session?.status || "sin sesión"}</p>
        </div>
      </article>
    </section>
  );
}

export default ExcelImportPage;
