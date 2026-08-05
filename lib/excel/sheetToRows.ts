import type { Worksheet } from "exceljs";

// exceljs has no sheet_to_json equivalent. Replicates the xlsx behavior both
// upload routes relied on (XLSX.utils.sheet_to_json(sheet, { defval: null })):
// row 1 is the header row, every subsequent row becomes a
// { headerText: cellValue } record, and missing cells resolve to null
// (not undefined) so `row["Some Column"]` checks behave identically.
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
      record[header] = row.getCell(colNumber).value ?? null;
    });
    rows.push(record);
  });
  return rows;
}
