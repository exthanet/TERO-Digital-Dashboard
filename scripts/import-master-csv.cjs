const fs = require("node:fs");

const input = process.argv[2];
const output = process.argv[3] || "public/master-data.json";
if (!input) throw new Error("Usage: node scripts/import-master-csv.cjs <input.csv> [output.json]");

const source = fs.readFileSync(input, "utf8").replace(/^\uFEFF/, "");

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

const rows = parseCsv(source);
fs.writeFileSync(output, JSON.stringify(rows));
console.log(JSON.stringify({ input, output, rows: rows.length }));
