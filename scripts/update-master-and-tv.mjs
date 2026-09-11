import fs from "node:fs";

const masterCsvPath = "C:/Users/terodigitalOffice/Downloads/Master Data (01_01_2026 - 28_08_2026).xlsm - Master Data (4).csv";
const oneTvCsvPath = "C:/Users/terodigitalOffice/Downloads/ถกไม่เถียงONE-คู่แข่ง - ถกไม่เถียงONE-คู่แข่ง.csv";
const gmmTvCsvPath = "C:/Users/terodigitalOffice/Downloads/ถกไม่เถียงGMM25-คู่แข่ง - ถกไม่เถียงGMM25-คู่แข่ง.csv";
const targetJsonPath = "public/master-data.json";

function parseCsv(text) {
  const table = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n") {
      row.push(value.replace(/\r$/, ""));
      table.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  if (value || row.length) {
    row.push(value.replace(/\r$/, ""));
    table.push(row);
  }

  const headers = table.shift() || [];
  return table
    .filter((cells) => cells.some((cell) => cell !== ""))
    .map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""])));
}

const thaiMonths = {"ม.ค.":1,"ก.พ.":2,"มี.ค.":3,"เม.ย.":4,"พ.ค.":5,"มิ.ย.":6,"ก.ค.":7,"ส.ค.":8,"ก.ย.":9,"ต.ค.":10,"พ.ย.":11,"ธ.ค.":12};
function parseThaiDate(value) {
  const match = String(value || "").match(/(\d{1,2})\s+([^\s]+)\s+(20\d{2})/);
  if (!match || !thaiMonths[match[2]]) return null;
  return `${match[3]}-${String(thaiMonths[match[2]]).padStart(2,"0")}-${String(Number(match[1])).padStart(2,"0")}`;
}
function displayDate(iso) { const [year, month, day] = iso.split("-"); return `${day}/${month}/${year}`; }
function number(value) { const parsed = Number(String(value || "").replaceAll(",", "").replace(/[^\d.-]/g, "")); return Number.isFinite(parsed) ? parsed : 0; }
function fixed(value, digits = 3) { return value ? value.toFixed(digits).replace(/0+$/, "").replace(/\.$/, "") : ""; }
function audience(rating) { return rating ? Math.round(rating * 700000) : 0; }

console.log("1. Reading current public/master-data.json...");
const currentMaster = JSON.parse(fs.readFileSync(targetJsonPath, "utf8"));
console.log(`Current master rows: ${currentMaster.length}`);

console.log("2. Parsing Master Data (4).csv...");
const masterCsvRows = parseCsv(fs.readFileSync(masterCsvPath, "utf8").replace(/^\uFEFF/, ""));
console.log(`Parsed Master Data (4).csv rows: ${masterCsvRows.length}`);

// Map current rows by key: Date + Platform + (Content_ID || URL || Topic)
const currentMap = new Map();
currentMaster.forEach((r, idx) => {
  const key = `${r.Date || ""}|${r.Platform || ""}|${(r.Content_ID || r.URL || r.Topic || "").trim()}`;
  currentMap.set(key, idx);
});

let updatedMasterCount = 0;
let newMasterCount = 0;
const mergedMaster = [...currentMaster];

masterCsvRows.forEach((row) => {
  const key = `${row.Date || ""}|${row.Platform || ""}|${(row.Content_ID || row.URL || row.Topic || "").trim()}`;
  if (currentMap.has(key)) {
    const idx = currentMap.get(key);
    mergedMaster[idx] = { ...mergedMaster[idx], ...row };
    updatedMasterCount++;
  } else {
    mergedMaster.push(row);
    currentMap.set(key, mergedMaster.length - 1);
    newMasterCount++;
  }
});
console.log(`Master Data update result -> Updated: ${updatedMasterCount}, New inserted: ${newMasterCount}, Total: ${mergedMaster.length}`);

console.log("3. Processing TV Ratings (ONE31 & GMM25)...");
function parseCsvTable(text) {
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
  return rows.filter((cells) => cells.some((cell) => cell !== ""));
}

const oneRows = parseCsvTable(fs.readFileSync(oneTvCsvPath, "utf8").replace(/^\uFEFF/, ""));
const gmmRows = parseCsvTable(fs.readFileSync(gmmTvCsvPath, "utf8").replace(/^\uFEFF/, ""));

const gmmByDate = new Map();
for (const cells of gmmRows.slice(1)) {
  const date = parseThaiDate(cells[0]);
  if (date && cells[3] && number(cells[4])) gmmByDate.set(date, cells);
}

const tvIncoming = [];
for (const cells of oneRows.slice(1)) {
  const date = parseThaiDate(cells[0]);
  const topic = String(cells[3] || "").trim();
  const oneRating = number(cells[4]);
  if (!date || !topic || !oneRating) continue;
  const gmmCells = gmmByDate.get(date);
  const gmmRatingFromOne = number(cells[5]);
  const gmmRating = gmmCells ? number(gmmCells[4]) : gmmRatingFromOne;
  const bkk = number(cells[6]), urban = number(cells[7]), bkkUrban = number(cells[8]), rural = number(cells[9]);
  const viewership = number(cells[10]);

  tvIncoming.push({
    Date: displayDate(date),
    Program: "ถกไม่เถียง",
    Episode_ID: `TKT-${date.replaceAll("-", "")}`,
    Topic: topic,
    Topic_Type: String(cells[1] || "").trim(),
    VDO_Type: "TV Episode",
    Platform: "TV",
    Channel: "ONE31",
    Content_ID: "",
    URL: "",
    Publish_Time: "",
    Duration_Min: fixed(number(cells[2]), 2),
    Views: fixed(audience(oneRating), 2),
    Likes: "",
    Comments: "",
    Shares: "",
    Engagement: "0.00",
    Engagement_Rate: "0.00%",
    TV_Rating_Total: fixed(oneRating),
    "TV_Rating_15+BKK": fixed(bkk),
    "TV_Rating_15+URBAN": fixed(urban),
    "TV_Rating_15+BKK&URBAN": fixed(bkkUrban),
    "TV_Rating_15+RURAL": fixed(rural),
    TV_Audience_Total: String(audience(oneRating)),
    "TV_Audience_15+BKK": String(audience(bkk)),
    "TV_Audience_15+URBAN": String(audience(urban)),
    "TV_Audience_15+BKK&URBAN": String(audience(bkkUrban)),
    "TV_Audience_15+RURAL": String(audience(rural)),
    Best_of_Month: "",
    Upload_Count: "1",
    Revenue: "",
    Notes: `Source: ONE31/GMM25 TV Rating CSV; Viewership (15+): ${viewership || ""}; GMM Rating: ${fixed(gmmRating)}; GMM Audience: ${audience(gmmRating)}`,
  });
}

console.log(`Parsed TV incoming episodes: ${tvIncoming.length}`);
const tvIncomingKeys = new Set(tvIncoming.map((row) => `${row.Date}|${row.Program}|${row.Platform}`));
const keptMaster = mergedMaster.filter((row) => !tvIncomingKeys.has(`${row.Date}|${row.Program}|${row.Platform}`));
const finalMaster = [...keptMaster, ...tvIncoming];

console.log(`Final Master rows: ${finalMaster.length}`);
fs.writeFileSync(targetJsonPath, JSON.stringify(finalMaster));
console.log("Successfully wrote updated master data to " + targetJsonPath);
