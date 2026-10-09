// Who may see and do what. A role gives a set of permissions; an admin can
// switch single permissions on or off for one person (users/{uid}.perms).
// firestore.rules holds the same presets and enforces the data side
// (revenue, Monthly ACC, Deep Dive, monthly reports); the UI hides what a person cannot use.
// Importing files, the sync and user management stay with the admin role.
//
// Relative imports only: tests run this file directly with Node.

export type Role = "admin" | "executive" | "content" | "finance" | "viewer";
export type Perm = "advanced" | "deepDive" | "revenue" | "download" | "monthlyReport";

export const ROLES: { id: Role; label: string; note: string }[] = [
  { id: "admin", label: "Admin", note: "ทุกอย่าง รวมนำเข้าไฟล์ sync และจัดการผู้ใช้" },
  { id: "executive", label: "ผู้บริหาร", note: "ทุกรายงาน รวมรายได้ และดาวน์โหลด" },
  { id: "content", label: "ทีมคอนเทนต์ / Creative", note: "รายงาน วิเคราะห์เชิงลึก Deep Dive (ไม่เห็นรายได้) และดาวน์โหลด" },
  { id: "finance", label: "บัญชี / การเงิน", note: "รายงานพื้นฐาน รายได้ Monthly ACC และดาวน์โหลด" },
  { id: "viewer", label: "Viewer", note: "รายงานพื้นฐานเท่านั้น (ค่าเริ่มต้นของคนใหม่)" },
];

export const PERMS: { id: Perm; label: string; note: string }[] = [
  { id: "advanced", label: "วิเคราะห์เชิงลึก", note: "การเติบโต คุณภาพคลิป Thumbnail คำแนะนำ" },
  { id: "deepDive", label: "YouTube Deep Dive", note: "Retention, Hook, SEO (แท็บ Revenue ต้องมีสิทธิ์รายได้ด้วย)" },
  { id: "revenue", label: "รายได้", note: "YouTube Revenue, Affiliate, Monthly ACC และตัวเลขรายได้ทุกที่" },
  { id: "download", label: "ดาวน์โหลด / Export", note: "CSV / Excel จากทุกหน้า" },
  { id: "monthlyReport", label: "รายงานประจำเดือน", note: "ดูรายงานสรุปรายเดือนสำหรับประชุม (PDF ดาวน์โหลดได้เฉพาะ admin)" },
];

/** Keep in step with preset() in firestore.rules. */
export const PRESET: Record<Role, Perm[]> = {
  admin: ["advanced", "deepDive", "revenue", "download", "monthlyReport"],
  executive: ["advanced", "deepDive", "revenue", "download", "monthlyReport"],
  content: ["advanced", "deepDive", "download"],
  finance: ["revenue", "download"],
  viewer: [],
};

export const normalizeRole = (v: unknown): Role => (ROLES.some((r) => r.id === v) ? (v as Role) : "viewer");

export type PermOverrides = Partial<Record<Perm, boolean>>;

/** Overrides kept: known permissions with a true / false value only. */
export function cleanOverrides(v: unknown): PermOverrides {
  const out: PermOverrides = {};
  if (v && typeof v === "object") for (const p of PERMS) {
    const x = (v as Record<string, unknown>)[p.id];
    if (typeof x === "boolean") out[p.id] = x;
  }
  return out;
}

/** The role's permissions with the person's own switches on top; admins always have everything. */
export function effectivePerms(role: Role, overrides: PermOverrides = {}): Record<Perm, boolean> {
  const base = new Set(PRESET[role]);
  return Object.fromEntries(PERMS.map((p) => [p.id, role === "admin" || (overrides[p.id] ?? base.has(p.id))])) as Record<Perm, boolean>;
}

export function can(user: { role: Role; perms?: PermOverrides } | null | undefined, perm: Perm): boolean {
  return !!user && effectivePerms(user.role, user.perms)[perm];
}

/** Overrides that differ from the role (what gets stored); undefined for none. */
export function overridesFor(role: Role, wanted: Record<Perm, boolean>): PermOverrides | undefined {
  const base = new Set(PRESET[role]);
  const out: PermOverrides = {};
  for (const p of PERMS) if (wanted[p.id] !== base.has(p.id)) out[p.id] = wanted[p.id];
  return Object.keys(out).length ? out : undefined;
}
