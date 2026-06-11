/**
 * Tiny RFC-4180-ish CSV parser. Handles:
 *   - quoted fields with embedded commas, newlines, and "" escapes
 *   - CRLF or LF line endings
 *   - leading BOM
 * Returns a list of rows (string[][]).
 *
 * No dependencies — Mindbody / Excel exports are well-formed enough that this
 * is sufficient. We parse client-side for instant feedback, then re-run
 * parsing server-side on submit (defense-in-depth).
 */
export function parseCSV(input: string): string[][] {
  let text = input;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let i = 0;
  let inQuotes = false;
  const n = text.length;

  while (i < n) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += c;
      i += 1;
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ",") {
      row.push(cell);
      cell = "";
      i += 1;
      continue;
    }
    if (c === "\r") {
      // Treat \r or \r\n as a single line break.
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i += text[i + 1] === "\n" ? 2 : 1;
      continue;
    }
    if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i += 1;
      continue;
    }
    cell += c;
    i += 1;
  }

  // Flush the trailing cell/row, but ignore a single empty trailing line.
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  // Drop any fully-empty rows (e.g., trailing blank lines).
  return rows.filter((r) => r.some((v) => v.trim().length > 0));
}

/**
 * Convenience helper: parses a CSV blob and returns headers + records (each
 * record is an object keyed by header).
 */
export type CsvParsed = {
  headers: string[];
  records: Record<string, string>[];
};

export function parseCsvWithHeaders(input: string): CsvParsed {
  const rows = parseCSV(input);
  if (rows.length === 0) return { headers: [], records: [] };
  const headers = rows[0].map((h) => h.trim());
  const records = rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? "").trim();
    });
    return obj;
  });
  return { headers, records };
}

/**
 * Generate a CSV blob from rows of objects.
 */
export function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const out = [headers.map(escape).join(",")];
  for (const r of rows) {
    out.push(headers.map((h) => escape(r[h])).join(","));
  }
  return out.join("\n");
}
