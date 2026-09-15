/**
 * Activities are the user's own vocabulary: the chips in session config and the
 * grouping key of the ledger. Pure rules about them live here.
 */

/**
 * The key an activity is stored and looked up by. Lowercased and trimmed, so 'Gym '
 * and 'gym' are the same activity — a duplicate name is a duplicate activity.
 */
export function activityKeyOf(label: string): string {
  return label.trim().toLowerCase();
}
