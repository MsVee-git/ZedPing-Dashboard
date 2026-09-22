import * as XLSX from "xlsx";

export const CONTACT_COLUMN_HINTS = {
  phone: ["phone", "phone number", "mobile", "mobile number", "whatsapp", "whatsapp number", "contact", "contact number"],
  name: ["name", "full name"],
  email: ["email", "email address"],
};

export function suggestContactMapping(headers) {
  return Object.fromEntries(Object.entries(CONTACT_COLUMN_HINTS).map(([key, values]) => {
    const index = headers.findIndex((header) => values.includes(String(header || "").trim().toLowerCase()));
    return [key, index < 0 ? null : index];
  }));
}

function preserveCellValue(value) {
  if (typeof value === "number") {
    // Keep only safely representable numeric values. A scientific/unsafe value
    // becomes a string the server deliberately rejects rather than guessing.
    return Number.isSafeInteger(value) && !/e/i.test(String(value)) ? String(value) : Number(value).toExponential();
  }
  return value == null ? "" : String(value).trim();
}

export function matrixToContactImport(matrix) {
  if (!Array.isArray(matrix) || !matrix.length) throw new Error("This file is empty.");
  const headers = (matrix[0] || []).map((value) => String(value || "").trim() || "Untitled column");
  const rows = matrix.slice(1)
    .map((row) => Array.isArray(row) ? row.map(preserveCellValue) : [])
    .filter((row) => row.some((value) => String(value || "").trim()));
  return { headers, rows };
}

function parseDelimitedLine(line, delimiter) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      cells.push(cell); cell = "";
    } else cell += character;
  }
  cells.push(cell);
  return cells;
}

export function parsePastedContacts(text) {
  const lines = String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) throw new Error("Paste at least a header row and one contact row.");
  const first = lines[0];
  const delimiter = first.includes("\t") ? "\t" : first.includes(",") ? "," : first.includes(";") ? ";" : null;
  const matrix = delimiter ? lines.map((line) => parseDelimitedLine(line, delimiter)) : lines.map((line) => [line]);
  return matrixToContactImport(matrix);
}

export async function parseContactFile(file) {
  const name = String(file?.name || "").toLowerCase();
  if (name.endsWith(".txt")) return parsePastedContacts(await file.text());
  const bytes = await file.arrayBuffer();
  const workbook = XLSX.read(bytes, { type: "array", raw: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("This file has no worksheet.");
  return matrixToContactImport(XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true }));
}
