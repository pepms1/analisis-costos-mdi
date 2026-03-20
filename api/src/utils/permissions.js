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

export const ALL_PERMISSIONS = Object.freeze(Object.values(PERMISSIONS));

const basePermissions = {
  [PERMISSIONS.PRICES_VIEW]: false,
  [PERMISSIONS.PRICES_CREATE]: false,
  [PERMISSIONS.PRICES_EDIT]: false,
  [PERMISSIONS.PRICES_DELETE]: false,
  [PERMISSIONS.PRICES_QUICK_CAPTURE]: false,
  [PERMISSIONS.CATALOGS_VIEW]: false,
  [PERMISSIONS.CATALOGS_MANAGE]: false,
  [PERMISSIONS.BUDGETS_VIEW]: false,
  [PERMISSIONS.BUDGETS_MANAGE]: false,
  [PERMISSIONS.INFLATION_VIEW]: false,
  [PERMISSIONS.INFLATION_MANAGE]: false,
  [PERMISSIONS.SETTINGS_VIEW]: false,
  [PERMISSIONS.SETTINGS_MANAGE]: false,
  [PERMISSIONS.PROCESSES_RUN_MASSIVE]: false,
  [PERMISSIONS.USERS_VIEW]: false,
  [PERMISSIONS.USERS_MANAGE]: false,
  [PERMISSIONS.AUDIT_VIEW]: false,
};

const rolePermissions = {
  superadmin: ALL_PERMISSIONS.reduce((acc, permission) => ({ ...acc, [permission]: true }), {}),
  admin: {
    ...basePermissions,
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
    ...basePermissions,
    [PERMISSIONS.PRICES_VIEW]: true,
    [PERMISSIONS.PRICES_CREATE]: true,
    [PERMISSIONS.PRICES_QUICK_CAPTURE]: true,
    [PERMISSIONS.CATALOGS_VIEW]: true,
    [PERMISSIONS.BUDGETS_VIEW]: true,
  },
  viewer: {
    ...basePermissions,
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
