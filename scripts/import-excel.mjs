// Import danh sách nhân sự từ Excel (sheet "Chốt") -> data/employees.json
//   npm run import                                  # file & sheet mặc định
//   npm run import "đường-dẫn.xlsx" "TênSheet"      # tuỳ chọn
// Logic map cột nằm ở lib/import-core.mjs (dùng chung với trang admin upload).

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { parseEmployees, DEFAULT_SHEET } from "../lib/import-core.mjs";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const FILE = process.argv[2] || "Danh sách Sales phục vụ sinh nhật 5 năm (1).xlsx";
const SHEET = process.argv[3] || DEFAULT_SHEET;

// KHÔNG cellDates: ngày ở dạng serial -> parse không lệch timezone
const wb = XLSX.readFile(path.resolve(FILE));
const { employees, sheet, skippedInactive } = parseEmployees(XLSX, wb, { sheet: SHEET });

const dest = path.join(process.cwd(), "data", "employees.json");
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(employees, null, 1), "utf8");
console.log(`✓ Import ${employees.length} nhân sự từ "${FILE}" [sheet ${sheet}] -> ${dest}`);
if (skippedInactive) console.log(`  (bỏ qua ${skippedInactive} người không Active)`);
