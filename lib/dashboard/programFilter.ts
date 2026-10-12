// The รายการ filter picks one, several or every program. It stays one string so the
// rest of the dashboard keeps working unchanged: "ALL", one name, or several names
// joined by PROGRAM_SEP.
//
// Relative imports only: tests run this file directly with Node.

export const PROGRAM_SEP = "|";

/** The picked programs; null = every program. */
export function programList(value: string): string[] | null {
  if (!value || value === "ALL") return null;
  return value.split(PROGRAM_SEP).filter(Boolean);
}

export function programMatches(value: string, program: string): boolean {
  const list = programList(value);
  return !list || list.includes(program);
}

/** Back to a filter value: none picked or all of them picked = "ALL". */
export function programValue(picked: string[], options: string[]): string {
  const keep = options.filter((o) => picked.includes(o));
  return !keep.length || keep.length === options.length ? "ALL" : keep.join(PROGRAM_SEP);
}

/** "ทั้งหมด", or the names: "ถกไม่เถียง, Kidsfun". */
export function programLabel(value: string): string {
  const list = programList(value);
  if (!list) return "ทั้งหมด";
  return list.join(", ");
}
