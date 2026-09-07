const fs = require("node:fs");

const [masterPath, facebookPath, instagramPath, outputPath = masterPath] = process.argv.slice(2);
if (!masterPath || !facebookPath || !instagramPath) {
  throw new Error("Usage: node scripts/merge-metricool-posts.cjs <master.json> <facebook.csv> <instagram.csv> [output.json]");
}

function parseCsv(text) {
  const rows = [];
  let row = [], value = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { value += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else value += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") { row.push(value); value = ""; }
    else if (character === "\n") { row.push(value.replace(/\r$/, "")); rows.push(row); row = []; value = ""; }
    else value += character;
  }
  if (value || row.length) { row.push(value.replace(/\r$/, "")); rows.push(row); }
  const nonEmpty = rows.filter((cells) => cells.some((cell) => cell !== ""));
  const headers = nonEmpty[0] || [];
  return nonEmpty.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""])));
}

function number(value) {
  const parsed = Number(String(value ?? "").replaceAll(",", "").replace("%", "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}
function whole(value) { return String(Math.round(number(value))); }
function percent(value) { return `${number(value).toFixed(2)}%`; }
function normalizeUrl(value) { return String(value || "").trim().replace(/\/$/, "").toLowerCase(); }
function splitTimestamp(value) {
  const match = String(value || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!match) return null;
  return { iso: `${match[1]}-${match[2]}-${match[3]}`, date: `${match[3]}/${match[2]}/${match[1]}`, time: match[4] ? `${match[4]}:${match[5]}` : "" };
}
function firstLine(value, fallback) {
  const line = String(value || "").split(/\r?\n/).map((part) => part.trim()).find((part) => part && part !== ".");
  return line || fallback;
}
function inferProgram(content) {
  const text = String(content || "").toLowerCase();
  if (text.includes("ถกไม่เถียง") || text.includes("ทินโชคกมลกิจ") || text.includes("ทิน โชคกมลกิจ")) return "ถกไม่เถียง";
  if (text.includes("เงินทองของจริง")) return "เงินทองของจริง";
  if (text.includes("kids fun") || text.includes("kidsfun")) return "Kidsfun";
  if (text.includes("hitz") || text.includes("ฮิตซ์")) return "Hitzradio";
  return "ไม่ระบุ";
}
function inferTopicType(content) {
  const text = String(content || "").toLowerCase();
  if (/ลูกค้า|โฆษณา|สปอนเซอร์|branded|promotion|โปรโมชัน/.test(text)) return "งานลูกค้า / งานขอ / Branded Content";
  if (/กัมพูชา|เขมร|ฮุน เซน|ฮุนเซน|ชายแดนไทย/.test(text)) return "ข่าวไทย–กัมพูชา";
  if (/อิหร่าน|สหรัฐ|ต่างประเทศ|ทรัมป์|รัสเซีย|ยูเครน|จีน|ญี่ปุ่น/.test(text)) return "ข่าวต่างประเทศ / อิหร่าน–สหรัฐ";
  if (/ตำรวจ|อาชญากรรม|สแกมเมอร์|ฆาตกรรม|ยิง|คดี|โกง|จับกุม|ยาเสพติด/.test(text)) return "ข่าวตำรวจ / อาชญากรรม / สแกมเมอร์";
  if (/ผู้ว่า\s*กทม|บิ๊กโจ๊ก|การเมืองท้องถิ่น/.test(text)) return "ข่าวบุคคล / การเมืองท้องถิ่น";
  if (/รัฐบาล|นายก|สภา|สว\.?|สส\.?|กกต|พรรค|การเมือง|อนุทิน|เลือกตั้ง|รัฐมนตรี|ฮั้ว/.test(text)) return "ข่าวการเมือง";
  if (/ประวัติศาสตร์|โบราณ|อดีต/.test(text)) return "ประวัติศาสตร์";
  if (/พระเครื่อง|วัตถุมงคล|เกจิ/.test(text)) return "พระเครื่อง";
  if (/ไวรัล|viral|กระแส|โซเชียล|ดราม่า/.test(text)) return "ข่าวกระแส / Viral";
  if (/ชาวบ้าน|ชุมชน|ร้องทุกข์/.test(text)) return "ข่าวชาวบ้าน";
  return "ไม่ระบุ";
}
function facebookId(url) {
  const match = String(url || "").match(/\/(?:posts|videos)\/(\d+)/i);
  return `FB-${match?.[1] || Buffer.from(String(url || "")).toString("base64url").slice(0, 18)}`;
}

function baseRow({date, time, program, topic, topicType, vdoType, platform, contentId, url, views, likes, comments, shares, engagement, engagementRate, notes}) {
  return {
    Date: date, Program: program, Episode_ID: "", Topic: topic, Topic_Type: topicType,
    VDO_Type: vdoType, Platform: platform, Channel: "-", Content_ID: contentId, URL: url,
    Publish_Time: time, Duration_Min: "0.00", Views: whole(views), Likes: whole(likes), Comments: whole(comments),
    Shares: whole(shares), Engagement: whole(engagement), Engagement_Rate: percent(engagementRate),
    TV_Rating_Total: "", "TV_Rating_15+BKK": "", "TV_Rating_15+URBAN": "", "TV_Rating_15+BKK&URBAN": "", "TV_Rating_15+RURAL": "",
    TV_Audience_Total: "", "TV_Audience_15+BKK": "", "TV_Audience_15+URBAN": "", "TV_Audience_15+BKK&URBAN": "", "TV_Audience_15+RURAL": "",
    Best_of_Month: "", Upload_Count: "1", Revenue: "0", Notes: notes,
  };
}

const facebookRows = parseCsv(fs.readFileSync(facebookPath, "utf8").replace(/^\uFEFF/, ""));
const instagramRows = parseCsv(fs.readFileSync(instagramPath, "utf8").replace(/^\uFEFF/, ""));
const incoming = [];

for (const source of facebookRows) {
  const timestamp = splitTimestamp(source.Date);
  if (!timestamp || !source.PostLink) continue;
  const isVideo = number(source.VideoViews) > 0 || String(source.Type).toLowerCase() === "video";
  const views = isVideo ? number(source.VideoViews) : number(source.Impressions);
  const engagement = number(source.Reactions) + number(source.Comments) + number(source.Shared);
  const fallback = `Facebook ${source.Type || "post"} ไม่มีข้อความ (${timestamp.iso} ${timestamp.time})`;
  incoming.push(baseRow({
    date: timestamp.date, time: timestamp.time, program: inferProgram(source.Content),
    topic: firstLine(source.Content, fallback), topicType: inferTopicType(source.Content),
    vdoType: "Facebook Post", platform: "Facebook", contentId: facebookId(source.PostLink), url: source.PostLink,
    views, likes: source.Reactions, comments: source.Comments, shares: source.Shared, engagement,
    engagementRate: source.Engagement,
    notes: `Source: ${facebookPath.split(/[\\/]/).at(-1)}; Type=${source.Type || ""}; Views=${isVideo ? "VideoViews" : "Impressions"}; Reach=${whole(source.Reach)}; Clicks=${whole(source.Clicks)}; Metricool snapshot through 2026-09-05`,
  }));
}

for (const source of instagramRows) {
  const timestamp = splitTimestamp(source.Timestamp);
  if (!timestamp || !source.URL) continue;
  const saved = number(source.Saved);
  const engagement = source.Interactions === "" ? number(source.Likes) + saved + number(source.Comments) + number(source.Shares) : number(source.Interactions);
  const fallback = `Instagram ${source.type || "post"} ไม่มีข้อความ (${timestamp.iso} ${timestamp.time})`;
  incoming.push(baseRow({
    date: timestamp.date, time: timestamp.time, program: inferProgram(source.Content),
    topic: firstLine(source.Content, fallback), topicType: inferTopicType(source.Content),
    vdoType: "Instagram Post", platform: "Instagram", contentId: `IG-${source.Id}`, url: source.URL,
    views: source.Views, likes: source.Likes, comments: source.Comments, shares: source.Shares,
    engagement, engagementRate: source.Engagement,
    notes: `Source: ${instagramPath.split(/[\\/]/).at(-1)}; Type=${source.type || ""}; Reach=${whole(source["Reach (Organic)"])}; Saved=${whole(source.Saved)}; Follows=${whole(source.Follows)}; Metricool snapshot through 2026-09-05`,
  }));
}

const master = JSON.parse(fs.readFileSync(masterPath, "utf8"));
const indexByUrl = new Map(master.map((row, index) => [normalizeUrl(row.URL), index]).filter(([url]) => url));
const stats = { Facebook: {source: 0, updated: 0, inserted: 0}, Instagram: {source: 0, updated: 0, inserted: 0} };
for (const row of incoming) {
  const platformStats = stats[row.Platform];
  platformStats.source += 1;
  const existingIndex = indexByUrl.get(normalizeUrl(row.URL));
  if (existingIndex == null) {
    indexByUrl.set(normalizeUrl(row.URL), master.length);
    master.push(row);
    platformStats.inserted += 1;
  } else {
    const existing = master[existingIndex];
    master[existingIndex] = {
      ...existing,
      ...row,
      Program: existing.Program && existing.Program !== "ไม่ระบุ" ? existing.Program : row.Program,
      Topic: existing.Topic || row.Topic,
      Topic_Type: existing.Topic_Type && existing.Topic_Type !== "ไม่ระบุ" ? existing.Topic_Type : row.Topic_Type,
    };
    platformStats.updated += 1;
  }
}

const duplicateUrls = master.length - new Set(master.map((row) => normalizeUrl(row.URL)).filter(Boolean)).size - master.filter((row) => !normalizeUrl(row.URL)).length;
fs.writeFileSync(outputPath, JSON.stringify(master));
console.log(JSON.stringify({masterAfter: master.length, ...stats, duplicateUrls, latestFacebook: facebookRows[0]?.Date || "", latestInstagram: instagramRows[0]?.Timestamp || ""}, null, 2));
