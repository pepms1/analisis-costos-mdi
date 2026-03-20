# Importación asistida desde Excel — Stage 3

## Flujo implementado
1. El usuario carga archivo y guarda mapeo (stage 2).
2. El frontend ejecuta `POST /api/import-sessions/:id/parse`.
3. Backend reabre archivo, toma `sheetName`, `dataStartRowIndex`, `ignoreEmptyRows` y `columnMappingJson`.
4. Se regeneran filas staging de la sesión en `import_rows` (borrado + inserción).
5. Se devuelve resumen y muestra inicial para renderizar en pantalla.

## Reglas aplicadas en parseo
- Se ignoran filas vacías cuando `ignoreEmptyRows = true`.
- Se ignoran filas de subtotal/total/resumen por heurística de texto.
- Se conserva `sheet_row_number` original.
- Se asigna `parse_status` por fila: `parsed`, `warning` o `error`.
- `match_status` inicial: `pending`.

## Normalización base
- Texto: trim, lowercase, sin acentos, espacios colapsados y puntuación reducida.
- Números: soporta `4,200.00`, `$4,200.00`, `4 200`, `4.200,00`, etc.
- Unidad: homologación básica (`pza/piezas`, `m2/m²/mt2`, `m3/mt3`, `kg/kilo`, `jor/jornal`, `ml/metro lineal`).
- Fecha: serial Excel, `dd/mm/yyyy`, `yyyy-mm-dd`.

## Casos manuales sugeridos
- Fila válida completa: debe quedar en `parsed`.
- Fila vacía: debe sumarse en ignoradas.
- Fila subtotal (ej. “SUBTOTAL”): debe sumarse en ignoradas.
- Fila con fecha inválida: debe crear fila con `warning`.
- Fila con monto raro (ej. `$4.200,00`): debe parsear monto numérico en `raw_json.normalized.amount`.

## Pendientes Stage 4
- Motor de sugerencias y matching difuso.
- Scoring de confianza avanzado.
- Flujo de revisión avanzada y decisiones asistidas.
- Persistencia final hacia históricos reales.
