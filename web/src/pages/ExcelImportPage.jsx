import { useEffect, useMemo, useState } from "react";
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

const REVIEW_FILTERS = [
  { key: "all", label: "Todas" },
  { key: "pending", label: "Pendientes" },
  { key: "accepted", label: "Aceptadas" },
  { key: "edited", label: "Editadas" },
  { key: "ignored", label: "Ignoradas" },
  { key: "high", label: "Alta confianza" },
  { key: "medium", label: "Media" },
  { key: "low", label: "Baja" },
  { key: "no_match", label: "Sin coincidencia" },
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
  const [suggestionSummary, setSuggestionSummary] = useState(null);
  const [parseRows, setParseRows] = useState([]);
  const [rowCounters, setRowCounters] = useState(null);
  const [suggesting, setSuggesting] = useState(false);
  const [selectedRows, setSelectedRows] = useState({});
  const [reviewFilter, setReviewFilter] = useState("all");
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const [bulkSupplierId, setBulkSupplierId] = useState("");
  const [catalogs, setCatalogs] = useState({ categories: [], suppliers: [], projects: [] });
  const [editingRow, setEditingRow] = useState(null);
  const [applying, setApplying] = useState(false);
  const [applySummary, setApplySummary] = useState(null);
  const [editForm, setEditForm] = useState({
    finalCategoryId: "",
    finalSupplierId: "",
    finalCost: "",
    finalDate: "",
    finalWorkId: "",
    finalNotes: "",
    lengthM: "",
    widthM: "",
    sourceUnit: "cm",
    areaM2: "",
    applicationUnit: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const previewColumns = useMemo(() => preview?.columns || [], [preview]);

  const visibleRows = useMemo(() => {
    if (reviewFilter === "all") return parseRows;
    if (["pending", "accepted", "edited", "ignored"].includes(reviewFilter)) {
      return parseRows.filter((row) => row.reviewStatus === reviewFilter);
    }
    return parseRows.filter((row) => row.confidenceLabel === reviewFilter);
  }, [parseRows, reviewFilter]);

  const selectedIds = useMemo(() => Object.keys(selectedRows).filter((id) => selectedRows[id]), [selectedRows]);

  useEffect(() => {
    async function loadCatalogs() {
      try {
        const [categoriesResponse, suppliersResponse, projectsResponse] = await Promise.all([
          apiRequest("/categories?status=active"),
          apiRequest("/suppliers?status=active"),
          apiRequest("/projects?activeOnly=1"),
        ]);

        setCatalogs({
          categories: categoriesResponse.items || [],
          suppliers: suppliersResponse.items || [],
          projects: projectsResponse.items || [],
        });
      } catch {
        // Catálogos opcionales para revisión manual.
      }
    }

    loadCatalogs();
  }, []);

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
      setRowCounters(response.counters || null);
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
    setSuggestionSummary(null);
    setApplySummary(null);
    setParseRows([]);
    setSelectedRows({});

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
      setSuggestionSummary(null);
      setSession(response.item || session);
      await loadParsedRows(session.id);
      setSuccess("Parseo ejecutado. Se regeneraron las filas staging de esta sesión.");
    } catch (parseError) {
      setError(parseError.message || "No se pudo procesar la sesión");
    } finally {
      setParsing(false);
    }
  }

  async function handleGenerateSuggestions() {
    if (!session?.id) {
      setError("No hay sesión activa para generar sugerencias.");
      return;
    }

    setSuggesting(true);
    setError("");
    setSuccess("");

    try {
      const response = await apiRequest(`/import-sessions/${session.id}/suggestions`, { method: "POST" });
      setSuggestionSummary(response.summary || null);
      setSession(response.item || session);
      await loadParsedRows(session.id);
      setSuccess("Sugerencias generadas y guardadas en staging para revisión.");
    } catch (suggestError) {
      setError(suggestError.message || "No se pudieron generar sugerencias");
    } finally {
      setSuggesting(false);
    }
  }

  async function applyDecision(rowId, payload) {
    try {
      setError("");
      await apiRequest(`/import-rows/${rowId}/decision`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      await loadParsedRows(session?.id);
    } catch (decisionError) {
      setError(decisionError.message || "No se pudo guardar la decisión");
    }
  }

  async function handleBulkAction(action) {
    if (!session?.id || !selectedIds.length) return;

    try {
      setError("");
      await apiRequest(`/import-sessions/${session.id}/decisions/bulk`, {
        method: "POST",
        body: JSON.stringify({
          action,
          rowIds: selectedIds,
          categoryId: bulkCategoryId || null,
          supplierId: bulkSupplierId || null,
        }),
      });
      setSelectedRows({});
      await loadParsedRows(session.id);
    } catch (bulkError) {
      setError(bulkError.message || "No se pudo ejecutar la acción masiva");
    }
  }

  async function handleApplyToHistoric() {
    if (!session?.id) {
      setError("No hay sesión activa para aplicar.");
      return;
    }

    setApplying(true);
    setError("");
    setSuccess("");

    try {
      const response = await apiRequest(`/import-sessions/${session.id}/apply`, { method: "POST" });
      setApplySummary(response.summary || null);
      setSession(response.item || session);
      await loadParsedRows(session.id);
      setSuccess("Aplicación a históricos finalizada.");
    } catch (applyError) {
      setError(applyError.message || "No se pudo aplicar la sesión a históricos");
    } finally {
      setApplying(false);
    }
  }

  function openEditModal(row) {
    const measurementSeed = row.decision?.finalMeasurementsJson || row.finalValues?.measurements || null;
    setEditingRow(row);
    setEditForm({
      finalCategoryId: row.decision?.finalCategoryId || row.finalValues?.categoryId || "",
      finalSupplierId: row.decision?.finalSupplierId || row.finalValues?.supplierId || "",
      finalCost: row.decision?.finalCost ?? row.finalValues?.cost ?? "",
      finalDate: row.decision?.finalDate ? String(row.decision.finalDate).slice(0, 10) : "",
      finalWorkId: row.decision?.finalWorkId || row.finalValues?.workId || "",
      finalNotes: row.decision?.finalNotes || "",
      lengthM: measurementSeed?.lengthM ?? "",
      widthM: measurementSeed?.widthM ?? "",
      sourceUnit: measurementSeed?.sourceUnit || row.rawJson?.normalized?.detectedDimensions?.sourceUnit || "cm",
      areaM2: measurementSeed?.areaM2 ?? "",
      applicationUnit:
        measurementSeed?.applicationUnit || row.rawJson?.normalized?.suggestedApplicationUnit || "",
    });
  }

  function updateMeasurementField(field, value) {
    setEditForm((prev) => {
      const next = { ...prev, [field]: value };
      const length = Number(next.lengthM);
      const width = Number(next.widthM);
      if (Number.isFinite(length) && length > 0 && Number.isFinite(width) && width > 0) {
        next.areaM2 = Number((length * width).toFixed(6));
      } else {
        next.areaM2 = "";
      }
      return next;
    });
  }

  async function saveEditDecision() {
    if (!editingRow) return;
    await applyDecision(editingRow.id, {
      decisionType: "edited",
      finalCategoryId: editForm.finalCategoryId || null,
      finalSupplierId: editForm.finalSupplierId || null,
      finalCost: editForm.finalCost === "" ? null : Number(editForm.finalCost),
      finalDate: editForm.finalDate || null,
      finalWorkId: editForm.finalWorkId || null,
      finalNotes: editForm.finalNotes || "",
      finalMeasurementsJson:
        editForm.lengthM === "" || editForm.widthM === ""
          ? null
          : {
              lengthM: Number(editForm.lengthM),
              widthM: Number(editForm.widthM),
              sourceUnit: editForm.sourceUnit || null,
              areaM2: editForm.areaM2 === "" ? Number(editForm.lengthM) * Number(editForm.widthM) : Number(editForm.areaM2),
              applicationUnit: editForm.applicationUnit || null,
            },
    });
    setEditingRow(null);
  }

  function renderStatusBadge(status) {
    return <span className={`status-chip status-chip-${status || "pending"}`}>{status || "pending"}</span>;
  }

  function renderConfidence(row) {
    if (!row.suggestion) return <span className="status-chip confidence-chip-no_match">Sin match</span>;
    return (
      <span className={`status-chip confidence-chip-${row.confidenceLabel || "low"}`}>
        {(row.suggestion?.score || 0).toFixed(2)} · {row.confidenceLabel || "low"}
      </span>
    );
  }

  return (
    <section className="page-shell">
      <PageHeader
        title="Importación asistida desde Excel"
        description="Stage 6: aplicación final desde decisiones staging a históricos reales con trazabilidad e idempotencia."
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
          <button
            type="button"
            className="primary-button"
            onClick={handleGenerateSuggestions}
            disabled={suggesting || parsing || saving || loading || !session?.id || !parseRows.length}
          >
            {suggesting ? "Generando..." : "Generar sugerencias"}
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={handleApplyToHistoric}
            disabled={applying || suggesting || parsing || saving || loading || !session?.id}
          >
            {applying ? "Aplicando..." : "Aplicar a históricos"}
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

        {suggestionSummary ? (
          <section className="import-panel card-subtle">
            <h3>Resumen de sugerencias</h3>
            <div className="parse-summary-grid">
              <p>Alta: <strong>{suggestionSummary.high}</strong></p>
              <p>Media: <strong>{suggestionSummary.medium}</strong></p>
              <p>Baja: <strong>{suggestionSummary.low}</strong></p>
              <p>Sin match: <strong>{suggestionSummary.noMatch}</strong></p>
              <p>Candidatas: <strong>{suggestionSummary.candidateRows}</strong></p>
            </div>
          </section>
        ) : null}

        {applySummary ? (
          <section className="import-panel card-subtle">
            <h3>Resumen de aplicación final</h3>
            <div className="parse-summary-grid">
              <p>Decisiones revisadas: <strong>{applySummary.totalReviewed}</strong></p>
              <p>Elegibles (accepted/edited): <strong>{applySummary.eligible}</strong></p>
              <p>Aplicadas: <strong>{applySummary.applied}</strong></p>
              <p>Omitidas: <strong>{applySummary.omitted}</strong></p>
              <p>Con error: <strong>{applySummary.errors}</strong></p>
              <p>Advertencia duplicado: <strong>{applySummary.duplicateWarnings}</strong></p>
              <p>Ya aplicadas (idempotencia): <strong>{applySummary.alreadyApplied}</strong></p>
            </div>
            {applySummary.errorRows?.length ? (
              <div>
                <p><strong>Filas con error:</strong></p>
                <ul>
                  {applySummary.errorRows.slice(0, 10).map((item) => (
                    <li key={`${item.importRowId}-${item.sheetRowNumber}`}>Fila #{item.sheetRowNumber}: {item.reason}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {applySummary.warnings?.length ? (
              <div>
                <p><strong>Advertencias de posible duplicado:</strong></p>
                <ul>
                  {applySummary.warnings.slice(0, 10).map((item) => (
                    <li key={`${item.importRowId}-${item.duplicateHistoricId}`}>
                      Fila #{item.sheetRowNumber}: posible duplicado con histórico {item.duplicateHistoricId}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="import-panel card-subtle">
          <div className="preview-header">
            <h3>Revisión de filas staging</h3>
            <span className="muted">{rowsLoading ? "Cargando..." : `${visibleRows.length} filas visibles de ${parseRows.length}`}</span>
          </div>

          <div className="review-filters">
            {REVIEW_FILTERS.map((filter) => (
              <button
                type="button"
                key={filter.key}
                className={`chip-button ${reviewFilter === filter.key ? "chip-button-active" : ""}`}
                onClick={() => setReviewFilter(filter.key)}
              >
                {filter.label}
                <strong>{filter.key === "all" ? rowCounters?.total || 0 : rowCounters?.[filter.key] || 0}</strong>
              </button>
            ))}
          </div>

          <div className="bulk-toolbar">
            <span className="muted">Seleccionadas: {selectedIds.length}</span>
            <button type="button" onClick={() => handleBulkAction("accept")} disabled={!selectedIds.length}>Aceptar seleccionadas</button>
            <button type="button" onClick={() => handleBulkAction("ignore")} disabled={!selectedIds.length}>Ignorar seleccionadas</button>
            <select value={bulkSupplierId} onChange={(event) => setBulkSupplierId(event.target.value)}>
              <option value="">Proveedor para seleccionadas</option>
              {catalogs.suppliers.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <button type="button" onClick={() => handleBulkAction("set_supplier")} disabled={!selectedIds.length || !bulkSupplierId}>Asignar proveedor</button>
            <select value={bulkCategoryId} onChange={(event) => setBulkCategoryId(event.target.value)}>
              <option value="">Categoría para seleccionadas</option>
              {catalogs.categories.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <button type="button" onClick={() => handleBulkAction("set_category")} disabled={!selectedIds.length || !bulkCategoryId}>Asignar categoría</button>
          </div>

          <div className="preview-table-wrap">
            <table className="preview-table">
              <thead>
                <tr>
                  <th><input type="checkbox" checked={visibleRows.length > 0 && selectedIds.length === visibleRows.length} onChange={(event) => {
                    const checked = event.target.checked;
                    const next = {};
                    visibleRows.forEach((row) => { next[row.id] = checked; });
                    setSelectedRows(next);
                  }} /></th>
                  <th>Fila Excel</th>
                  <th>Concepto importado</th>
                  <th>Unidad</th>
                  <th>Cantidad</th>
                  <th>P.U. leído</th>
                  <th>Categoría sugerida</th>
                  <th>Proveedor sugerido</th>
                  <th>Costo sugerido</th>
                  <th>Geometría detectada</th>
                  <th>Confianza</th>
                  <th>Estado revisión</th>
                  <th>Final / notas</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input type="checkbox" checked={Boolean(selectedRows[row.id])} onChange={(event) => setSelectedRows((prev) => ({ ...prev, [row.id]: event.target.checked }))} />
                    </td>
                    <td>{row.sheetRowNumber}</td>
                    <td className="cell-wrap">{row.rawConcept || "—"}</td>
                    <td>{row.rawUnit || row.rawJson?.normalized?.unit || "—"}</td>
                    <td>{row.rawQuantity || row.rawJson?.normalized?.quantity || "—"}</td>
                    <td>{row.rawUnitPrice || row.rawJson?.normalized?.unitPrice || "—"}</td>
                    <td>{row.suggestion?.reasonJson?.matched?.categoryName || "—"}</td>
                    <td>{row.suggestion?.reasonJson?.matched?.supplierName || "—"}</td>
                    <td>{row.suggestion?.suggestedCost ?? "—"}</td>
                    <td className="cell-wrap">
                      {row.rawJson?.normalized?.detectedDimensions ? (
                        <>
                          {row.rawJson.normalized.detectedDimensions.lengthM}m × {row.rawJson.normalized.detectedDimensions.widthM}m
                          {" · "}
                          {row.rawJson.normalized.detectedDimensions.areaM2}m²
                          {" · sugerida: "}
                          {row.rawJson?.normalized?.suggestedApplicationUnit || "—"}
                        </>
                      ) : "—"}
                    </td>
                    <td>{renderConfidence(row)}</td>
                    <td>{renderStatusBadge(row.reviewStatus)}</td>
                    <td className="cell-wrap">{row.finalValues?.cost ?? "—"} · {row.finalValues?.notes || "sin notas"}</td>
                    <td className="row-actions">
                      <button
                        type="button"
                        disabled={row.parseStatus === "error"}
                        onClick={() => applyDecision(row.id, { decisionType: "accepted" })}
                      >
                        Aceptar sugerencia
                      </button>
                      <button type="button" onClick={() => openEditModal(row)}>Editar</button>
                      <button type="button" onClick={() => applyDecision(row.id, { decisionType: "ignored" })}>Ignorar</button>
                      <button type="button" onClick={() => applyDecision(row.id, { decisionType: "new" })}>Volver pendiente</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visibleRows.length ? <p className="muted">No hay filas para este filtro.</p> : null}
          </div>
        </section>
      </article>

      {editingRow ? (
        <div className="simple-modal-backdrop" role="presentation">
          <div className="simple-modal">
            <h3>Editar fila #{editingRow.sheetRowNumber}</h3>
            <div className="mapping-grid">
              <label>
                Categoría final
                <select value={editForm.finalCategoryId} onChange={(event) => setEditForm((prev) => ({ ...prev, finalCategoryId: event.target.value }))}>
                  <option value="">Sin categoría</option>
                  {catalogs.categories.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Proveedor final
                <select value={editForm.finalSupplierId} onChange={(event) => setEditForm((prev) => ({ ...prev, finalSupplierId: event.target.value }))}>
                  <option value="">Sin proveedor</option>
                  {catalogs.suppliers.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Obra final
                <select value={editForm.finalWorkId} onChange={(event) => setEditForm((prev) => ({ ...prev, finalWorkId: event.target.value }))}>
                  <option value="">Sin obra</option>
                  {catalogs.projects.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Costo final
                <input type="number" step="0.01" value={editForm.finalCost} onChange={(event) => setEditForm((prev) => ({ ...prev, finalCost: event.target.value }))} />
              </label>
              <label>
                Fecha final
                <input type="date" value={editForm.finalDate} onChange={(event) => setEditForm((prev) => ({ ...prev, finalDate: event.target.value }))} />
              </label>
              <label>
                Notas
                <input value={editForm.finalNotes} onChange={(event) => setEditForm((prev) => ({ ...prev, finalNotes: event.target.value }))} />
              </label>
              <label>
                Largo sugerido (m)
                <input type="number" step="0.001" value={editForm.lengthM} onChange={(event) => updateMeasurementField("lengthM", event.target.value)} />
              </label>
              <label>
                Ancho sugerido (m)
                <input type="number" step="0.001" value={editForm.widthM} onChange={(event) => updateMeasurementField("widthM", event.target.value)} />
              </label>
              <label>
                Unidad base
                <select value={editForm.sourceUnit} onChange={(event) => setEditForm((prev) => ({ ...prev, sourceUnit: event.target.value }))}>
                  <option value="mm">mm</option>
                  <option value="cm">cm</option>
                  <option value="m">m</option>
                </select>
              </label>
              <label>
                Área calculada (m²)
                <input type="number" step="0.000001" value={editForm.areaM2} onChange={(event) => setEditForm((prev) => ({ ...prev, areaM2: event.target.value }))} />
              </label>
              <label>
                Unidad sugerida de aplicación
                <input value={editForm.applicationUnit} onChange={(event) => setEditForm((prev) => ({ ...prev, applicationUnit: event.target.value }))} placeholder="m2 / pieza / ml..." />
              </label>
            </div>
            <div className="button-row">
              <button type="button" className="primary-button" onClick={saveEditDecision}>Guardar edición</button>
              <button type="button" onClick={() => setEditingRow(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default ExcelImportPage;
