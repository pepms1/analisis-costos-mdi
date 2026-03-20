export const PERMISSIONS = {
  PRICES_VIEW: "prices.view",
  PRICES_CREATE: "prices.create",
  PRICES_EDIT: "prices.edit",
  PRICES_DELETE: "prices.delete",
  PRICES_QUICK_CAPTURE: "prices.quick_capture",
  CATALOGS_VIEW: "catalogs.view",
  CATALOGS_MANAGE: "catalogs.manage",
  BUDGETS_VIEW: "budgets.view",
  BUDGETS_MANAGE: "budgets.manage",
  INFLATION_VIEW: "inflation.view",
  INFLATION_MANAGE: "inflation.manage",
  SETTINGS_VIEW: "settings.view",
  SETTINGS_MANAGE: "settings.manage",
  PROCESSES_RUN_MASSIVE: "processes.run_massive",
  USERS_VIEW: "users.view",
  USERS_MANAGE: "users.manage",
  AUDIT_VIEW: "audit.view",
};

const ALL = Object.values(PERMISSIONS);
const base = Object.fromEntries(ALL.map((permission) => [permission, false]));

const rolePermissions = {
  superadmin: Object.fromEntries(ALL.map((permission) => [permission, true])),
  admin: {
    ...base,
    [PERMISSIONS.PRICES_VIEW]: true,
    [PERMISSIONS.PRICES_CREATE]: true,
    [PERMISSIONS.PRICES_EDIT]: true,
    [PERMISSIONS.PRICES_DELETE]: true,
    [PERMISSIONS.PRICES_QUICK_CAPTURE]: true,
    [PERMISSIONS.CATALOGS_VIEW]: true,
    [PERMISSIONS.CATALOGS_MANAGE]: true,
    [PERMISSIONS.BUDGETS_VIEW]: true,
    [PERMISSIONS.BUDGETS_MANAGE]: true,
    [PERMISSIONS.INFLATION_VIEW]: true,
    [PERMISSIONS.SETTINGS_VIEW]: true,
    [PERMISSIONS.USERS_VIEW]: true,
    [PERMISSIONS.AUDIT_VIEW]: true,
  },
  capturista: {
    ...base,
    [PERMISSIONS.PRICES_VIEW]: true,
    [PERMISSIONS.PRICES_CREATE]: true,
    [PERMISSIONS.PRICES_QUICK_CAPTURE]: true,
    [PERMISSIONS.CATALOGS_VIEW]: true,
    [PERMISSIONS.BUDGETS_VIEW]: true,
  },
  viewer: {
    ...base,
    [PERMISSIONS.PRICES_VIEW]: true,
    [PERMISSIONS.CATALOGS_VIEW]: true,
    [PERMISSIONS.BUDGETS_VIEW]: true,
    [PERMISSIONS.INFLATION_VIEW]: true,
  },
};

export function getRolePermissions(role) {
  return rolePermissions[role] || rolePermissions.viewer;
}

export function hasPermission(user, permission) {
  if (!user) return false;
  const permissions = user.permissions || getRolePermissions(user.role);
  return Boolean(permissions?.[permission]);
}

export function hasAnyPermission(user, permissions = []) {
  return permissions.some((permission) => hasPermission(user, permission));
}

export function hasAllPermissions(user, permissions = []) {
  return permissions.every((permission) => hasPermission(user, permission));
}
