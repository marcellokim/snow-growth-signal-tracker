import { REQUIRED_SHEETS, type SheetName, type TableRow } from "./domain";

export interface SheetGateway {
  getSheetNames(): string[];
  createSheet(name: SheetName): void;
  getRows(name: SheetName): unknown[][];
  replaceRows(name: SheetName, rows: unknown[][]): void;
  appendRows(name: SheetName, rows: unknown[][]): void;
}

export class InMemorySheetGateway implements SheetGateway {
  private readonly sheets = new Map<string, unknown[][]>();

  getSheetNames(): string[] {
    return [...this.sheets.keys()];
  }

  createSheet(name: SheetName): void {
    if (!this.sheets.has(name)) {
      this.sheets.set(name, []);
    }
  }

  getRows(name: SheetName): unknown[][] {
    return this.sheets.get(name)?.map((row) => [...row]) ?? [];
  }

  replaceRows(name: SheetName, rows: unknown[][]): void {
    this.sheets.set(name, rows.map((row) => [...row]));
  }

  appendRows(name: SheetName, rows: unknown[][]): void {
    const existing = this.getRows(name);
    this.sheets.set(name, [...existing, ...rows.map((row) => [...row])]);
  }
}

export class AppsScriptSheetGateway implements SheetGateway {
  constructor(private readonly spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet) {}

  getSheetNames(): string[] {
    return this.spreadsheet.getSheets().map((sheet) => sheet.getName());
  }

  createSheet(name: SheetName): void {
    if (!this.spreadsheet.getSheetByName(name)) {
      this.spreadsheet.insertSheet(name);
    }
  }

  getRows(name: SheetName): unknown[][] {
    const sheet = this.mustGetSheet(name);
    const range = sheet.getDataRange();
    const values = range.getValues();
    return values.length === 1 && values[0].length === 1 && values[0][0] === "" ? [] : values;
  }

  replaceRows(name: SheetName, rows: unknown[][]): void {
    const sheet = this.mustGetSheet(name);
    sheet.clearContents();
    if (rows.length > 0) {
      sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
    }
  }

  appendRows(name: SheetName, rows: unknown[][]): void {
    if (rows.length === 0) {
      return;
    }
    const sheet = this.mustGetSheet(name);
    const startRow = Math.max(sheet.getLastRow(), 0) + 1;
    sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
  }

  private mustGetSheet(name: SheetName): GoogleAppsScript.Spreadsheet.Sheet {
    const sheet = this.spreadsheet.getSheetByName(name);
    if (!sheet) {
      throw new Error(`Missing sheet: ${name}`);
    }
    return sheet;
  }
}

export function ensureWorkbookSchema(gateway: SheetGateway): void {
  for (const schema of REQUIRED_SHEETS) {
    if (!gateway.getSheetNames().includes(schema.name)) {
      gateway.createSheet(schema.name);
    }
    const rows = gateway.getRows(schema.name);
    if (rows.length === 0) {
      gateway.replaceRows(schema.name, [[...schema.columns]]);
      continue;
    }
    const header = rows[0].map(String);
    const missing = schema.columns.filter((column) => !header.includes(column));
    if (missing.length > 0) {
      throw new Error(`Sheet "${schema.name}" is missing columns: ${missing.join(", ")}`);
    }
  }
}

export function rowsToObjects<T extends TableRow>(headers: string[], rows: unknown[][]): T[] {
  return rows.map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])),
  ) as T[];
}

export function objectsToRows(headers: readonly string[], rows: readonly TableRow[]): unknown[][] {
  return rows.map((row) => headers.map((header) => row[header] ?? ""));
}
