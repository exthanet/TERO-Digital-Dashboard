// รายงานประจำเดือน → admin's own page order, hidden pages and text (titles and a note
// per page), kept with the month's report (monthlyReports/{YYYY-MM}.layout). Numbers
// are never edited: only the order, what is shown, the titles and the extra notes.
//
// Relative imports only: tests run this file directly with Node.

export interface PageText {
  /** Replaces the page title (not on the cover). */
  title?: string;
  /** Extra text shown at the bottom of the page. */
  note?: string;
}

export interface ReportLayout {
  /** Page ids in the admin's order; pages not listed keep their place next to their neighbours. */
  order: string[];
  hidden: string[];
  texts: Record<string, PageText>;
  editedByName?: string;
  editedAt?: string;
}

export const EMPTY_LAYOUT: ReportLayout = { order: [], hidden: [], texts: {} };

/** A stable id per page: "cover", the title, "title#2" for a repeated title, "page-N" without one. */
export function pageIds(pages: { title?: string; cover?: boolean }[]): string[] {
  const seen = new Map<string, number>();
  return pages.map((p, i) => {
    const base = p.cover && !p.title ? "cover" : p.title?.trim() || `page-${i + 1}`;
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}#${n}`;
  });
}

/**
 * The pages in the admin's order. Ids no longer in the report are dropped; pages the
 * layout does not know (added in a later version) go right after the page before them
 * in the default order, or first.
 */
export function orderedIds(ids: string[], layout: ReportLayout | null | undefined): string[] {
  if (!layout?.order?.length) return [...ids];
  const known = new Set(ids);
  const out = layout.order.filter((id, i, a) => known.has(id) && a.indexOf(id) === i);
  ids.forEach((id, i) => {
    if (out.includes(id)) return;
    let at = 0;
    for (let j = i - 1; j >= 0; j--) {
      const k = out.indexOf(ids[j]);
      if (k >= 0) {
        at = k + 1;
        break;
      }
    }
    out.splice(at, 0, id);
  });
  return out;
}

/** Move one page up (-1) or down (+1); returns the full new order. */
export function movePage(order: string[], id: string, dir: -1 | 1): string[] {
  const i = order.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return order;
  const out = [...order];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

/** Text with surrounding space trimmed; empty texts are left out, so "no change" stays small. */
export function cleanLayout(l: ReportLayout, ids: string[]): ReportLayout {
  const texts: Record<string, PageText> = {};
  for (const [id, t] of Object.entries(l.texts || {})) {
    if (!ids.includes(id)) continue;
    const title = t.title?.trim();
    const note = t.note?.trim();
    if (title || note) texts[id] = { ...(title ? { title: title.slice(0, 200) } : {}), ...(note ? { note: note.slice(0, 2000) } : {}) };
  }
  return { order: orderedIds(ids, l), hidden: (l.hidden || []).filter((id) => ids.includes(id)), texts };
}
