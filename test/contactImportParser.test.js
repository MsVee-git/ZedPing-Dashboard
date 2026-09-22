import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { matrixToContactImport, parseContactFile, parsePastedContacts, suggestContactMapping } from "../src/lib/contactImportParser.js";

test("recognises forgiving contact headings", () => {
  for (const heading of ["Phone", "Phone Number", "Mobile", "Mobile Number", "WhatsApp", "WhatsApp Number", "Contact", "Contact Number"]) {
    assert.equal(suggestContactMapping([heading]).phone, 0);
  }
});

test("uses raw CSV and XLS/XLSX matrix values without relying on a visible plus sign", () => {
  const rows = [["Phone", "Name"], [978748066, "Jane"], [260978748066, "John"]];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const parsed = matrixToContactImport(XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" }));
  assert.deepEqual(parsed.rows, [["978748066", "Jane"], ["260978748066", "John"]]);
});

test("parses CSV, XLS, XLSX and TXT into the same safe contact matrix", async () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Phone", "Name"], [978748066, "Jane"]]), "Contacts");
  const file = (name, bytes) => ({ name, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });
  for (const type of ["xls", "xlsx"]) {
    const bytes = XLSX.write(workbook, { type: "array", bookType: type });
    const parsed = await parseContactFile(file(`contacts.${type}`, new Uint8Array(bytes)));
    assert.deepEqual(parsed.rows[0], ["978748066", "Jane"]);
  }
  const csv = await parseContactFile(file("contacts.csv", new TextEncoder().encode("Phone,Name\n0978748066,Jane")));
  assert.deepEqual(csv.rows[0], ["0978748066", "Jane"]);
  const txt = await parseContactFile({ name: "contacts.txt", text: async () => "Phone\tName\n260978748066\tJane" });
  assert.deepEqual(txt.rows[0], ["260978748066", "Jane"]);
});

test("supports tabular paste and TXT-style delimiters through one mapping pipeline", () => {
  const tabbed = parsePastedContacts("Mobile Number\tName\n0978748066\tJane");
  assert.equal(tabbed.headers[0], "Mobile Number");
  assert.deepEqual(tabbed.rows[0], ["0978748066", "Jane"]);
  const comma = parsePastedContacts("Phone,Name\n978748066,John");
  assert.deepEqual(comma.rows[0], ["978748066", "John"]);
});

test("does not turn unsafe numeric or scientific spreadsheet representations into digits", () => {
  const parsed = matrixToContactImport([["Phone"], ["2.60978748066E+11"], [Number.MAX_SAFE_INTEGER + 1]]);
  assert.equal(parsed.rows[0][0], "2.60978748066E+11");
  assert.match(parsed.rows[1][0], /e\+/i);
});
