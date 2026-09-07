const fs = require("node:fs");
const XLSX = require("xlsx");

const [masterPath, youtubePath, outputPath = masterPath] = process.argv.slice(2);
if (!masterPath || !youtubePath) {
  throw new Error("Usage: node scripts/merge-youtube-analytics.cjs <master.json> <youtube.xlsx> [output.json]");
}

const MONTHS = {Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};
function parsePublishDate(value) {
  const match = String(value || "").trim().match(/^([A-Z][a-z]{2})\s+(\d{1,2}),\s+(\d{4})$/);
  if (!match || !MONTHS[match[1]]) return null;
  const iso = `${match[3]}-${String(MONTHS[match[1]]).padStart(2,"0")}-${String(Number(match[2])).padStart(2,"0")}`;
  return {iso, display: `${String(Number(match[2])).padStart(2,"0")}/${String(MONTHS[match[1]]).padStart(2,"0")}/${match[3]}`};
}
function number(value) {
  const parsed = Number(String(value ?? "").replaceAll(",", "").replace("%", "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}
function fixed(value, digits = 2) {
  const parsed = number(value);
  return parsed.toFixed(digits).replace(/0+$/, "").replace(/\.$/, "") || "0";
}
function inferProgram(title) {
  const text = String(title || "").toLowerCase();
  if (text.includes("เงินทองของจริง")) return "เงินทองของจริง";
  if (text.includes("ถกไม่เถียง") || text.includes("ทินโชคกมลกิจ") || text.includes("ทิน โชคกมลกิจ")) return "ถกไม่เถียง";
  if (text.includes("kidsfun") || text.includes("kids fun")) return "Kidsfun";
  if (text.includes("hitz") || text.includes("ฮิตซ์")) return "Hitzradio";
  return "ไม่ระบุ";
}
function inferVideoType(title, durationSeconds) {
  const text = String(title || "").toLowerCase();
  if (text.includes("[live]") || text.includes("🔴")) return "YouTube Live";
  if (text.includes("highlight")) return "YouTube Highlight";
  if (text.includes("full ep") || text.includes("full episode")) return "YouTube Full Episode";
  if (number(durationSeconds) <= 180) return "YouTube Shorts";
  if (number(durationSeconds) >= 1200) return "YouTube Full Episode";
  return "YouTube Highlight";
}
function inferTopicType(title) {
  const text = String(title || "").toLowerCase();
  if (/ลูกค้า|โฆษณา|สปอนเซอร์|branded|promotion|โปรโมชัน|ไทยช่วยไทย/.test(text)) return "งานลูกค้า / งานขอ / Branded Content";
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
function newRow(source, published) {
  const id = String(source.Content || "").trim();
  const title = String(source["Video title"] || "").trim();
  const durationSeconds = number(source.Duration);
  return {
    Date: published.display, Program: inferProgram(title), Episode_ID: "", Topic: title,
    Topic_Type: inferTopicType(title), VDO_Type: inferVideoType(title, durationSeconds), Platform: "YouTube", Channel: "TERO Digital",
    Content_ID: id, URL: `https://www.youtube.com/watch?v=${id}`, Publish_Time: "", Duration_Min: fixed(durationSeconds / 60),
    Views: fixed(source.Views), Likes: "", Comments: "", Shares: "", Engagement: "0.00", Engagement_Rate: "0.00%",
    TV_Rating_Total: "", "TV_Rating_15+BKK": "", "TV_Rating_15+URBAN": "", "TV_Rating_15+BKK&URBAN": "", "TV_Rating_15+RURAL": "",
    TV_Audience_Total: "", "TV_Audience_15+BKK": "", "TV_Audience_15+URBAN": "", "TV_Audience_15+BKK&URBAN": "", "TV_Audience_15+RURAL": "",
    Best_of_Month: "", Upload_Count: "1", Revenue: fixed(source["Estimated revenue (THB)"], 3),
    Notes: `Source: ${youtubePath.split(/[\\/]/).at(-1)}; Watch time (hours): ${fixed(source["Watch time (hours)"], 4)}; Subscribers: ${fixed(source.Subscribers)}; Average view duration: ${source["Average view duration"] || ""}; Thumbnail impressions: ${fixed(source["Thumbnail impressions"])}; Thumbnail CTR (%): ${fixed(source["Thumbnail click-through rate (%)"])}; YouTube Analytics snapshot 2026-09-07`,
  };
}

const workbook = XLSX.readFile(youtubePath, {cellDates: false});
const sheet = workbook.Sheets["Table data"];
if (!sheet) throw new Error("Sheet 'Table data' was not found in the YouTube workbook");
const sourceRows = XLSX.utils.sheet_to_json(sheet, {defval: ""}).filter((row) => row.Content && row.Content !== "Total");
const incoming = [];
for (const source of sourceRows) {
  const published = parsePublishDate(source["Video publish time"]);
  if (!published) continue;
  incoming.push(newRow(source, published));
}

const master = JSON.parse(fs.readFileSync(masterPath, "utf8"));
const indexByContentId = new Map();
master.forEach((row, index) => {
  if (row.Platform === "YouTube" && row.Content_ID) indexByContentId.set(String(row.Content_ID), index);
});
let updated = 0, inserted = 0;
for (const row of incoming) {
  const existingIndex = indexByContentId.get(row.Content_ID);
  if (existingIndex == null) {
    indexByContentId.set(row.Content_ID, master.length);
    master.push(row);
    inserted += 1;
    continue;
  }
  const existing = master[existingIndex];
  master[existingIndex] = {
    ...existing,
    ...row,
    Program: row.Program !== "ไม่ระบุ" ? row.Program : existing.Program,
    Topic_Type: existing.Topic_Type && existing.Topic_Type !== "ไม่ระบุ" ? existing.Topic_Type : row.Topic_Type,
    Likes: existing.Likes || "",
    Comments: existing.Comments || "",
    Shares: existing.Shares || "",
    Engagement: existing.Engagement || "0.00",
    Engagement_Rate: existing.Engagement_Rate || "0.00%",
  };
  updated += 1;
}

const youtubeIds = master.filter((row) => row.Platform === "YouTube" && row.Content_ID).map((row) => String(row.Content_ID));
const duplicateContentIds = youtubeIds.length - new Set(youtubeIds).size;
fs.writeFileSync(outputPath, JSON.stringify(master));
console.log(JSON.stringify({masterAfter:master.length,sourceRows:sourceRows.length,accepted:incoming.length,updated,inserted,duplicateContentIds,latest:incoming.map((row) => row.Date).at(0) || ""}, null, 2));
