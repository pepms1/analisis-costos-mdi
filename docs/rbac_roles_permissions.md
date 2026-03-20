# RBAC - Análisis de Costos MDI

## Objetivo
Implementar control de acceso por roles y permisos atómicos en frontend y backend para evitar acciones no autorizadas aunque se intente llamar a la API directamente.

## Roles
- `superadmin`: acceso total.
- `admin`: operación diaria, sin cambios globales/inflación/usuarios/procesos masivos.
- `capturista`: captura rápida y lectura operativa.
- `viewer`: solo lectura.

## Permisos
- `prices.view`
- `prices.create`
- `prices.edit`
- `prices.delete`
- `prices.quick_capture`
- `catalogs.view`
- `catalogs.manage`
- `budgets.view`
- `budgets.manage`
- `inflation.view`
- `inflation.manage`
- `settings.view`
- `settings.manage`
- `processes.run_massive`
- `users.view`
- `users.manage`
- `audit.view`

## Reglas de acceso
- Backend: se usa `requirePermission(...)` para proteger endpoints sensibles y devolver `403`.
- Frontend: navegación, rutas y acciones usan `hasPermission/hasAnyPermission/hasAllPermission`.
- Capturista: solo puede crear precios desde flujo rápido (`x-capture-flow: quick`), validado en API.
- Inflación: solo `superadmin` puede modificar; `admin/viewer` lectura.

## Archivos tocados
- `api/src/utils/permissions.js`
- `api/src/utils/auditLogger.js`
- `api/src/middlewares/authMiddleware.js`
- `api/src/controllers/authController.js`
- `api/src/routes/*.js` (migración de `requireRoles` a permisos)
- `api/src/utils/constants.js`
- `api/scripts/migrateUserRoles.js`
- `api/package.json`
- `web/src/utils/permissions.js`
- `web/src/contexts/AuthContext.jsx`
- `web/src/components/ProtectedRoute.jsx`
- `web/src/layouts/AppLayout.jsx`
- `web/src/App.jsx`
- `web/src/pages/*` (guardas de UI por permisos)
- `web/src/utils/constants.js`

## Pendientes futuros recomendados
1. Persistir auditoría en colección/tabla en lugar de `console.info`.
2. Separar permisos de catálogos por tipo si el negocio lo requiere.
3. Añadir pruebas E2E/API para matrices de permisos.
4. Crear módulo de settings/procesos masivos cuando exista funcionalidad.
