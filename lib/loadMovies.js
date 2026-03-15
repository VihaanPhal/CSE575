import { readFileSync } from "fs";
import { join } from "path";
import { parse } from "csv-parse/sync";

const csvPath = join(process.cwd(), "data", "movie_titles.csv");

let indexMap = new Map();
let nameMap = new Map();

try {
  const raw = readFileSync(csvPath, "latin1");
  const records = parse(raw, { columns: false, relax_column_count: true });

  for (const row of records) {
    const index = parseInt(row[0], 10);
    const year = row[1] === "NULL" || !row[1] ? "Unknown" : row[1].trim();
    const name = row.slice(2).join(",").trim();

    const entry = { index, name, year };
    indexMap.set(index, entry);
    nameMap.set(name.toLowerCase(), entry);
  }
} catch {
  // CSV not present — maps stay empty
}

export { indexMap, nameMap };

export function getStats() {
  return { totalRecords: indexMap.size };
}
