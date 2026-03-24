export function canonicalizeProjectIds(projectIds = []) {
  if (!Array.isArray(projectIds)) return [];

  const normalized = projectIds
    .map((value) => (value == null ? "" : String(value).trim()))
    .filter((value) => value && value !== "null" && value !== "undefined");

  return [...new Set(normalized)];
}

export function normalizeProjectSelection(projectIds, projectId) {
  const canonical = canonicalizeProjectIds(projectIds);
  const legacyId = projectId == null ? "" : String(projectId).trim();

  if (legacyId && legacyId !== "null" && legacyId !== "undefined" && !canonical.includes(legacyId)) {
    canonical.push(legacyId);
  }

  return canonical;
}
