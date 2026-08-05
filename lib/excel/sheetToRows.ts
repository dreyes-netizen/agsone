import type { Worksheet } from "exceljs";

// exceljs has no sheet_to_json equivalent. Replicates the xlsx behavior both
// upload routes relied on (XLSX.utils.sheet_to_json(sheet, { defval: null })):
// row 1 is the header row, every subsequent row becomes a
// { headerText: cellValue } record, and missing cells resolve to null
// (not undefined) so `row["Some Column"]` checks behave identically.

// Unlike xlsx's sheet_to_json (which always handed back plain scalars),
// exceljs's cell.value is an object for formula/hyperlink/rich-text/error
// cells, so callers doing e.g. Number(row["Days Present"]) or
// row["Email"].trim() would silently get NaN or throw — unwrap those shapes
// here so every field is a plain scalar (or null) regardless of cell kind.
function normalizeCellValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object") return value;

  if (value instanceof Date) return value;

  if ("error" in value) return null;
  if ("result" in value) {
    return normalizeCellValue((value as { result: unknown }).result);
  }
  if ("text" in value) return (value as { text: unknown }).text ?? null;
  if ("richText" in value) {
    const parts = (value as { richText: { text?: string }[] }).richText;
    return parts.map((part) => part.text ?? "").join("");
  }

  return value;
}

export function sheetToRows(worksheet: Worksheet): Record<string, unknown>[] {
  const headers: string[] = [];
  worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? "").trim();
  });

  const rows: Record<string, unknown>[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: Record<string, unknown> = {};
    headers.forEach((header, colNumber) => {
      if (!header) return;
      record[header] = normalizeCellValue(row.getCell(colNumber).value) ?? null;
    });
    rows.push(record);
  });
  return rows;
}
