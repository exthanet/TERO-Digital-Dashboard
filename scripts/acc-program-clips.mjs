// ACC report: which clips make up each show line of a month (ถกไม่เถียง, เงินทองของจริง and the
// rest of TERO DIGITAL), one sheet per line, so the team can check the split. On this PC.
//
//   node scripts/acc-program-clips.mjs "C:\Users\...\ACC Report\2026\09"
//
// The month comes from the folder (...\YYYY\MM). Clips are put in a line exactly as Monthly ACC
// does (clipProgram: masterData's Program first, then the title). Numbers are YouTube
// Analytics' own per clip, for the month: views, Ads, Premium, Estimated partner revenue.
// The rest of TERO DIGITAL also lists clips that earned but are missing from the uploads
// playlist (the API's top 200 of the channel), and one line for whatever is left (small clips
// outside the playlist), so each sheet adds up to its line in Monthly ACC.
// Writes "ACC-รายการ-YYYY-MM.xlsx" in the folder. Reads Firestore (masterData, the CMS sign-in)
// and YouTube; writes nothing else.
//
// Real revenue: the file stays on this PC, never in the repo. The console prints shares only.
import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { Firestore, getAccessToken, decodeFields } from "../lib/integrations/firestoreRest.ts";
import { loadCmsAccount, accessTokenFor, analyticsQuery, batchedQuery } from "../lib/integrations/youtubeAnalytics.ts";
import { channelUploads } from "../lib/integrations/accMonthlyCollect.ts";
import { ACC_CHANNELS, TERO_DIGITAL, clipProgram, monthEnd } from "../lib/dashboard/accMonthly.ts";
import { postId } from "../lib/dashboard/postKey.ts";

const dir = process.argv[2];
if (!dir || !fs.existsSync(dir)) {
  console.error('ใช้: node scripts/acc-program-clips.mjs "<โฟลเดอร์เดือน เช่น ...\\ACC Report\\2026\\09>"');
  process.exit(1);
}
const mm = path.basename(path.resolve(dir));
const yyyy = path.basename(path.dirname(path.resolve(dir)));
if (!/^\d{2}$/.test(mm) || !/^\d{4}$/.test(yyyy)) {
  console.error("ชื่อโฟลเดอร์ต้องเป็น ...\\YYYY\\MM");
  process.exit(1);
}
const month = `${yyyy}-${mm}`;
const out = path.join(dir, `ACC-รายการ-${month}.xlsx`);

for (const line of fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8").split(/\r?\n/) : []) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || fs.readFileSync(".secrets/firebase-sync.json", "utf8"));
const db = new Firestore(JSON.parse(fs.readFileSync(".firebaserc", "utf8")).projects.default, await getAccessToken(sa));
const cms = await loadCmsAccount(db);
if (!cms) throw new Error("ยังไม่ได้เชื่อม YouTube CMS (syncSecrets/youtube_cms)");
const token = await accessTokenFor(cms.refreshToken, process.env.YT_OAUTH_CLIENT_ID, process.env.YT_OAUTH_CLIENT_SECRET);

const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const startDate = `${month}-01`;
const endDate = monthEnd(month) < today ? monthEnd(month) : today;
const programs = [...new Set(ACC_CHANNELS.filter((c) => c.program && c.id === TERO_DIGITAL).map((c) => c.program))];
const REST = "TERO Digital";

// masterData's Program per YouTube clip, as the sync reads it.
const programOf = new Map();
for (const d of await db.listRaw("masterData")) {
  const x = decodeFields(d.fields || {});
  for (const r of Array.isArray(x.rows) ? x.rows : []) {
    if (r.Platform !== "YouTube") continue;
    const id = postId("YouTube", r.URL) || postId("YouTube", r.Content_ID);
    if (id) programOf.set(id, r.Program || "");
  }
}
const uploads = await channelUploads(token, TERO_DIGITAL);
console.log(`${month} (ถึง ${endDate}) · uploads playlist ${uploads.length} คลิป · กำลังดึงตัวเลขรายคลิป…`);

// Views and money in separate requests (asked together the CMS answers "internal error").
const q = (params) => analyticsQuery(token, cms.ownerId, { startDate, endDate, ...params });
const perVideo = async (ids, metrics) => {
  const r = await batchedQuery(ids, 200, (batch) => q({ dimensions: "video", filters: `video==${batch.join(",")}`, metrics, maxResults: "200" }));
  return new Map(r.rows.map((row) => [String(row[0]), row.slice(1).map(Number)]));
};
const ids = uploads.map((u) => u.id);
const views = await perVideo(ids, "views");
const money = await perVideo(ids, "estimatedAdRevenue,estimatedRedPartnerRevenue,estimatedRevenue");

// Earning clips the uploads playlist does not reach (it stops near 20,000 clips).
const uploadIds = new Set(ids);
const top = await q({ filters: `channel==${TERO_DIGITAL}`, dimensions: "video", metrics: "estimatedAdRevenue,estimatedRedPartnerRevenue,estimatedRevenue", sort: "-estimatedRevenue", maxResults: "200" });
const outside = top.rows.filter((r) => !uploadIds.has(String(r[0])));
const outsideInfo = new Map();
for (let i = 0; i < outside.length; i += 50) {
  const batch = outside.slice(i, i + 50).map((r) => r[0]).join(",");
  const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${batch}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(60_000) });
  const body = await res.json();
  for (const it of body.items || []) outsideInfo.set(it.id, { title: it.snippet?.title || "", publishedAt: it.snippet?.publishedAt || "" });
}
if (outside.length) {
  const v = await perVideo(outside.map((r) => String(r[0])), "views");
  for (const [k, x] of v) views.set(k, x);
  for (const r of outside) money.set(String(r[0]), r.slice(1).map(Number));
}
const channel = (await q({ filters: `channel==${TERO_DIGITAL}`, metrics: "views" })).rows[0]?.map(Number) || [0];
const channelMoney = (await q({ filters: `channel==${TERO_DIGITAL}`, metrics: "estimatedAdRevenue,estimatedRedPartnerRevenue,estimatedRevenue" })).rows[0]?.map(Number) || [0, 0, 0];

// One row per clip with numbers this month, in its line.
const BY = { masterData: "Program ใน masterData", title: "ชื่อคลิป", outside: "ไม่อยู่ใน uploads playlist" };
const lines = new Map([...programs, REST].map((p) => [p, []]));
const clip = (id, title, publishedAt, line, by, md) => {
  const [ads = 0, premium = 0, total = 0] = money.get(id) || [];
  const [v = 0] = views.get(id) || [];
  if (!v && !total) return;
  lines.get(line).push({ id, title, publishedAt: publishedAt.slice(0, 10), by, md, views: v, ads, premium, total });
};
for (const u of uploads) {
  const c = clipProgram(u, programOf, programs);
  // In the rest of the channel "title" means: not in masterData, and no show's name in the title.
  const by = c.program || c.by === "masterData" ? BY[c.by] : "ไม่อยู่ใน masterData · ชื่อไม่มีชื่อรายการ";
  clip(u.id, u.title, u.publishedAt, c.program || REST, by, programOf.get(u.id) ?? "");
}
for (const r of outside) {
  const id = String(r[0]);
  const info = outsideInfo.get(id) || { title: "", publishedAt: "" };
  clip(id, info.title, info.publishedAt, REST, BY.outside, programOf.get(id) ?? "");
}

const wb = new ExcelJS.Workbook();
const sum = (rows, k) => rows.reduce((a, r) => a + r[k], 0);
const shares = [];
for (const [line, rows] of lines) {
  rows.sort((a, b) => b.total - a.total || b.views - a.views);
  const ws = wb.addWorksheet(line);
  ws.columns = [
    { header: "ลิงก์", key: "url", width: 16 },
    { header: "ชื่อคลิป", key: "title", width: 70 },
    { header: "วันที่ลง", key: "publishedAt", width: 12 },
    { header: "จัดเข้ารายการด้วย", key: "by", width: 24 },
    { header: "Program ใน masterData", key: "md", width: 20 },
    { header: "วิว", key: "views", width: 12 },
    { header: "Ads (USD)", key: "ads", width: 12 },
    { header: "Premium (USD)", key: "premium", width: 14 },
    { header: "Estimated partner revenue (USD)", key: "total", width: 18 },
  ];
  for (const r of rows) {
    const row = ws.addRow({ ...r, url: { text: r.id, hyperlink: `https://youtu.be/${r.id}` } });
    row.getCell("url").font = { color: { argb: "FF1155CC" }, underline: true };
  }
  if (line === REST) {
    // Whatever the clips above do not cover: the channel minus every listed clip of every line.
    const listed = [...lines.values()].flat();
    const left = (i, k) => Math.max(0, Math.round((channelMoney[i] - sum(listed, k)) * 1e6) / 1e6);
    ws.addRow({ title: "คลิปอื่นที่ไม่อยู่ใน uploads playlist (รวมกัน)", by: BY.outside, views: Math.max(0, channel[0] - sum(listed, "views")), ads: left(0, "ads"), premium: left(1, "premium"), total: left(2, "total") });
  }
  const n = ws.rowCount;
  const total = ws.addRow({ title: `รวม ${line}`, views: { formula: `SUM(F2:F${n})` }, ads: { formula: `SUM(G2:G${n})` }, premium: { formula: `SUM(H2:H${n})` }, total: { formula: `SUM(I2:I${n})` } });
  total.font = { bold: true };
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: "A1", to: `I${n}` };
  ws.getColumn("views").numFmt = "#,##0";
  for (const k of ["ads", "premium", "total"]) ws.getColumn(k).numFmt = "#,##0.00";
  const lineTotal = line === REST ? channelMoney[2] - [...lines].filter(([p]) => p !== REST).reduce((a, [, rs]) => a + sum(rs, "total"), 0) : sum(rows, "total");
  const count = (by) => rows.filter((r) => r.by === by).length;
  const detail = line === REST
    ? `Program อื่น ${count(BY.masterData)} · ไม่อยู่ใน masterData ${rows.length - count(BY.masterData) - count(BY.outside)} · นอก playlist ${count(BY.outside)}`
    : `Program ${count(BY.masterData)} · ชื่อ ${count(BY.title)}`;
  shares.push(`${line} ${rows.length} คลิป (${detail}) = ${((lineTotal / channelMoney[2]) * 100).toFixed(1)}% ของช่อง`);
}
const note = wb.addWorksheet("หมายเหตุ");
note.columns = [{ width: 24 }, { width: 100 }];
for (const r of [
  ["เดือน", `${month} (ข้อมูลถึง ${endDate}) · ดึงเมื่อ ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}`],
  ["ที่มา", "YouTube Analytics API (CMS) รายคลิป · ช่อง TERO DIGITAL"],
  ["จัดเข้ารายการ", "Program ใน masterData ก่อน ถ้าคลิปไม่อยู่ใน masterData ดูชื่อรายการในชื่อคลิป (กฎเดียวกับ Monthly ACC)"],
  ["คลิปอยู่ผิดรายการ", "แก้ Program ของคลิปนั้นใน masterData แล้ว sync ครั้งถัดไปยอด Monthly ACC จะย้ายตาม"],
  ["ยอดรวมแต่ละแท็บ", "ควรเท่ากับบรรทัดเดียวกันใน Monthly ACC (ต่างเล็กน้อยได้จากการปัดเศษของ YouTube)"],
]) note.addRow(r);
note.getColumn(1).font = { bold: true };

try {
  await wb.xlsx.writeFile(out);
} catch (e) {
  console.error(`เขียนไฟล์ไม่ได้ (เปิดอยู่ใน Excel หรือเปล่า?): ${e.message}`);
  process.exit(1);
}
console.log(shares.join("\n"));
console.log(`บันทึกที่: ${out}`);
