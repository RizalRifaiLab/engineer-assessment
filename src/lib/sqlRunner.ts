import alasql from "alasql";
import type { SqlSampleTable } from "./types";

/**
 * Runs a candidate's SQL query against the question's sample data, entirely in
 * the browser via AlaSQL. Each call seeds a fresh in-memory database so
 * re-running the same query never accumulates duplicate rows.
 */

export interface SqlRunResult {
  ok: boolean;
  columns: string[];
  rows: Record<string, string | number | null>[];
  error?: string;
}

/** Quote an identifier so reserved words (e.g. `total`) still work. */
function ident(name: string): string {
  return "`" + name.replace(/`/g, "") + "`";
}

/** SQL literal for a seed cell. */
function cell(v: string | number | null): string {
  if (v === null) return "NULL";
  if (typeof v === "number") return String(v);
  return "'" + v.replace(/'/g, "''") + "'";
}

export function runSqlQuery(
  sampleData: SqlSampleTable[] | undefined,
  query: string
): SqlRunResult {
  const sql = query.trim();
  if (!sql) return { ok: false, columns: [], rows: [], error: "Write a query first." };
  if (!sampleData || sampleData.length === 0) {
    return { ok: false, columns: [], rows: [], error: "No sample data for this question." };
  }

  try {
    const db = new alasql.Database();
    for (const t of sampleData) {
      const cols = t.columns
        .map((c) => `${ident(c.name)} ${c.type}`)
        .join(", ");
      db.exec(`CREATE TABLE ${ident(t.name)} (${cols})`);
      for (const row of t.rows) {
        db.exec(`INSERT INTO ${ident(t.name)} VALUES (${row.map(cell).join(", ")})`);
      }
    }

    const res = db.exec(sql);
    const rows = (Array.isArray(res) ? res : [res]) as Record<
      string,
      string | number | null
    >[];
    const columns = rows.length > 0 ? Object.keys(rows[0] ?? {}) : [];
    return { ok: true, columns, rows };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // AlaSQL parse errors are verbose; collapse to the first line for display.
    return { ok: false, columns: [], rows: [], error: message.split("\n")[0] };
  }
}
