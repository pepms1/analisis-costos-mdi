# Consulta de Históricos: mejoras de geometría y borrado

## Geometría en la vista
- Se añadió visualización en la tabla para `largo × ancho` y subtítulo de `Área` cuando hay datos dimensionales.
- Los valores se toman de `derivedValues` normalizados en metros y, como respaldo, de `dimensions`.
- También se muestran `Unidad análisis` (`normalizedUnit`) y `P.U. análisis` (`normalizedPrice`).
- Cuando no aplica, la vista muestra `—`.

## Borrado de históricos
- Se añadió acción por fila **Eliminar histórico** únicamente visible para rol `superadmin` en la vista de Consulta de Históricos.
- El backend protege el endpoint con validación de permiso y rol `superadmin`.
- El borrado es lógico (soft delete) sobre `PriceRecord` usando:
  - `isDeleted`
  - `deletedAt`
  - `deletedBy`
- Las consultas normales excluyen registros con `isDeleted = true` por defecto.
