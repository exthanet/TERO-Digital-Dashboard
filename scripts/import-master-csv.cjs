const fs = require("node:fs");
const XLSX = require("xlsx");

const input = process.argv[2];
const output = process.argv[3] || "public/master-data.json";
if (!input) throw new Error("Usage: node scripts/import-master-csv.cjs <input.csv> [output.json]");

const workbook = XLSX.readFile(input, { raw: false });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
fs.writeFileSync(output, JSON.stringify(rows));
console.log(JSON.stringify({ input, output, rows: rows.length }));
