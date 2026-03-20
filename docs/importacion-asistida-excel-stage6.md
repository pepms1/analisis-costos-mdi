# Importación asistida desde Excel · Stage 6 (aplicación final)

## Flujo end-to-end

1. El usuario revisa filas staging y guarda decisiones en `import_row_decisions`.
2. `POST /api/import-sessions/:id/apply` usa **exclusivamente** `import_row_decisions` como fuente de verdad.
3. Solo procesa decisiones `accepted` y `edited`.
4. Crea registros reales en `price_records` con trazabilidad de origen de importación.
5. Guarda `saved_historic_id` en cada decisión aplicada.
6. Al finalizar correctamente, marca la sesión como `confirmed`.

## Idempotencia de reaplicación

- Si una decisión ya tiene `saved_historic_id`, no vuelve a crear histórico.
- Se contabiliza como `alreadyApplied` en el resumen y se omite en la creación.
- Esto permite reintentar `apply` sin duplicar históricos por la misma decisión.

## Validaciones finales por fila

Antes de crear el histórico, valida:

- categoría final existente,
- costo final numérico y mayor a cero,
- fecha final válida (directa o resoluble desde fila/sesión),
- parse status (si está en error, requiere edición explícita),
- obra final activa (si fue asignada).

Si falla una fila, se registra en `errorRows` y se continúa con las demás.

## Advertencias de posible duplicado

No bloquea la creación. Solo advierte en el resumen si encuentra coincidencias
por:

- mismo concepto,
- misma categoría,
- mismo proveedor (si aplica),
- fecha cercana (±7 días),
- costo cercano (±5% en `unitPrice`).

Se devuelve la referencia del histórico potencialmente duplicado.
