/** Import / export CSV (contacts, rapports) sans dependance externe. */

export type CsvColumn<T> = { key: keyof T | string; label: string; get?: (row: T) => unknown };

function escapeCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[";\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[], delimiter = ";"): string {
  const header = columns.map((column) => escapeCell(column.label)).join(delimiter);
  const body = rows.map((row) =>
    columns
      .map((column) =>
        escapeCell(column.get ? column.get(row) : (row as Record<string, unknown>)[column.key as string])
      )
      .join(delimiter)
  );
  return `\uFEFF${[header, ...body].join("\r\n")}`;
}

/** Parseur CSV tolerant (separateur ; ou , detection automatique, champs quotes). */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const firstLine = text.split("\n")[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}
