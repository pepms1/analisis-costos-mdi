# Importación asistida desde Excel — Stage 1

## Qué quedó listo

- Estructura base de datos en colecciones `import_sessions`, `import_rows`, `import_row_suggestions` e `import_row_decisions`.
- Estados base de sesión y de fila para soportar el flujo incremental.
- Endpoints base del módulo para crear sesión, consultar sesión, listar renglones staging, guardar decisión y preparar `apply` en modo stub.
- Ruta y pantalla inicial en frontend (`/importacion-excel`) con opción en menú.
- Script de migración para materializar colecciones e índices (`migrate:import-assistant-stage1`).

## Qué falta para próximas etapas

- Integración del upload real y parsing de archivo Excel.
- Motor de sugerencias y matching (incluyendo fuzzy matching).
- Pantalla de revisión avanzada por fila con aprobaciones masivas.
- Persistencia final a históricos reales y trazabilidad de confirmación.
- Métricas operativas (tiempo por sesión, tasa de error por columna, etc.).
