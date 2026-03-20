export function logAuthorizationEvent({ user, action, module, result, meta = {} }) {
  const entry = {
    userId: user?.id || user?._id || "anonymous",
    role: user?.role || "unknown",
    action,
    module,
    timestamp: new Date().toISOString(),
    result,
    meta,
  };

  console.info("[AUDIT]", JSON.stringify(entry));
}
