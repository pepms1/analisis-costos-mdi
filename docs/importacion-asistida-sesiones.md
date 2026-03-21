# Importación asistida: gestión persistente de sesiones/lotes

## Objetivo
Permitir que cada importación sea un expediente persistente hasta que el usuario decida descartarlo, archivarlo o eliminarlo.

## Flujo
1. **Nueva importación**: desde `Importación asistida` se crea una sesión (`POST /api/import-sessions`) y se sube archivo.
2. **Persistencia**: la sesión queda guardada con `sessionId` y se puede retomar por URL (`/importacion-excel?sessionId=<id>`).
3. **Listado de sesiones**: en `Sesiones de importación` (`/importacion-excel/sesiones`) se consultan lotes por estado y archivo.
4. **Reapertura robusta**: abrir sesión recarga mapping, hoja, contexto detectado, filas, sugerencias y decisiones ya guardadas.
5. **Acciones de gestión**:
   - Continuar sesión.
   - Marcar como descartada (`PATCH /api/import-sessions/:id/status`).
   - Eliminar definitivamente (`DELETE /api/import-sessions/:id`) junto con staging de filas/sugerencias/decisiones.

## Estados soportados
- `uploaded`
- `mapped`
- `parsed`
- `reviewing`
- `confirmed`
- `failed`
- `discarded`
- `archived`

## Notas clave
- No hay eliminación automática por errores de apply.
- Las sesiones `confirmed` y `failed` siguen listables y reabribles para consulta/revisión.
- La eliminación sólo ocurre por acción explícita del usuario.
