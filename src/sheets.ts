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
    this.sheets.set(name, cloneRectangularRows(name, rows));
  }

  appendRows(name: SheetName, rows: unknown[][]): void {
    const rowsToAppend = cloneRectangularRows(name, rows);
    const existing = this.getRows(name);
    this.sheets.set(name, [...existing, ...rowsToAppend]);
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
    const rowsToWrite = cloneRectangularRows(name, rows);
    const sheet = this.mustGetSheet(name);
    sheet.clearContents();
    if (rowsToWrite.length > 0) {
      sheet.getRange(1, 1, rowsToWrite.length, rowsToWrite[0].length).setValues(rowsToWrite);
    }
  }

  appendRows(name: SheetName, rows: unknown[][]): void {
    const rowsToAppend = cloneRectangularRows(name, rows);
    if (rowsToAppend.length === 0) {
      return;
    }
    const sheet = this.mustGetSheet(name);
    const startRow = Math.max(sheet.getLastRow(), 0) + 1;
    sheet.getRange(startRow, 1, rowsToAppend.length, rowsToAppend[0].length).setValues(rowsToAppend);
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
    const expectedHeader = [...schema.columns];
    if (!headersMatchExpectedOrder(header, expectedHeader)) {
      throw new Error(
        `Sheet "${schema.name}" header must match required column order: ${expectedHeader.join(", ")}`,
      );
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

function cloneRectangularRows(name: SheetName, rows: unknown[][]): unknown[][] {
  if (rows.length === 0) {
    return [];
  }
  const columnCount = rows[0].length;
  const raggedRowIndex = rows.findIndex((row) => row.length !== columnCount);
  if (raggedRowIndex !== -1) {
    throw new Error(`Rows for sheet "${name}" must be rectangular`);
  }
  return rows.map((row) => [...row]);
}

function headersMatchExpectedOrder(header: string[], expectedHeader: string[]): boolean {
  return expectedHeader.every((column, index) => header[index] === column);
}
