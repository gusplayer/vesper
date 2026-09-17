/**
 * The Android selection token. Where iOS stores an opaque FamilyActivitySelection,
 * Android stores a JSON array of package names in the same `Mode.selectionToken`
 * column, so the stores and the plan never know which platform wrote it. Pure.
 */

/** The package names inside a token. Empty for null, blank, malformed or non-array tokens. */
export function packageNamesFromToken(token: string | null): string[] {
  if (token === null || token.trim() === '') {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(token);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  const names = parsed.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
  return Array.from(new Set(names));
}

/** A token for a list of package names, or null when there is nothing to store. */
export function tokenFromPackageNames(packageNames: readonly string[]): string | null {
  const unique = Array.from(new Set(packageNames.filter((name) => name.trim() !== '')));
  return unique.length === 0 ? null : JSON.stringify(unique);
}
