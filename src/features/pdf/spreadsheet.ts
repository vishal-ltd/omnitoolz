import { extensionOf } from "@/lib/utils";

export type Cell = string | number | boolean | null;

export interface SheetData {
  name: string;
  rows: Cell[][];
}

const MAX_CELLS = 500_000;

function parseXml(source: string, label: string): XMLDocument {
  const document = new DOMParser().parseFromString(source, "application/xml");
  if (document.getElementsByTagName("parsererror").length > 0) {
    throw new Error(`“${label}” contains malformed spreadsheet XML.`);
  }
  return document;
}

function elements(root: ParentNode, localName: string): Element[] {
  return Array.from(root.querySelectorAll("*"))
    .filter((element) => element.localName === localName);
}

function relationshipId(sheet: Element): string | null {
  return sheet.getAttribute("r:id") ?? sheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
}

function zipPath(target: string): string {
  const parts = (target.startsWith("/") ? target.slice(1) : `xl/${target}`).split("/");
  const normalized: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") normalized.pop();
    else normalized.push(part);
  }
  return normalized.join("/");
}

function columnIndex(reference: string): number {
  const letters = /^[A-Z]+/i.exec(reference)?.[0].toUpperCase() ?? "A";
  let value = 0;
  for (const letter of letters) value = value * 26 + letter.charCodeAt(0) - 64;
  return Math.max(0, value - 1);
}

function parseCsv(source: string): Cell[][] {
  const rows: Cell[][] = [];
  let row: Cell[] = [];
  let value = "";
  let quoted = false;

  const pushValue = () => {
    row.push(value);
    value = "";
  };
  const pushRow = () => {
    pushValue();
    rows.push(row);
    row = [];
    if (rows.length * Math.max(1, rows[rows.length - 1].length) > MAX_CELLS) {
      throw new Error("This spreadsheet is too large to render safely in the browser.");
    }
  };

  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        value += '"';
        index++;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      pushValue();
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index++;
      pushRow();
    } else {
      value += character;
    }
  }
  if (value || row.length > 0 || source.endsWith(",")) pushRow();
  return rows;
}

async function parseXlsx(bytes: Uint8Array): Promise<SheetData[]> {
  const { unzipSync } = await import("fflate");
  const zip = unzipSync(bytes);
  const decoder = new TextDecoder();
  const read = (path: string): string => {
    const entry = zip[path];
    if (!entry) throw new Error(`The workbook is missing ${path}.`);
    return decoder.decode(entry);
  };

  const workbook = parseXml(read("xl/workbook.xml"), "workbook.xml");
  const relationships = parseXml(read("xl/_rels/workbook.xml.rels"), "workbook relationships");
  const relationTargets = new Map(
    elements(relationships, "Relationship")
      .map((relation) => [relation.getAttribute("Id"), relation.getAttribute("Target")])
      .filter((entry): entry is [string, string] => Boolean(entry[0] && entry[1])),
  );

  let sharedStrings: string[] = [];
  if (zip["xl/sharedStrings.xml"]) {
    const shared = parseXml(read("xl/sharedStrings.xml"), "sharedStrings.xml");
    sharedStrings = elements(shared, "si").map((item) => item.textContent ?? "");
  }

  const sheets = elements(workbook, "sheet");
  if (sheets.length === 0) throw new Error("The workbook contains no worksheets.");
  const result: SheetData[] = [];
  let cellCount = 0;

  for (const sheet of sheets) {
    const id = relationshipId(sheet);
    const target = id ? relationTargets.get(id) : null;
    if (!target) continue;
    const document = parseXml(read(zipPath(target)), target);
    const rows: Cell[][] = [];
    for (const rowElement of elements(document, "row")) {
      const row: Cell[] = [];
      for (const cellElement of Array.from(rowElement.children).filter((child) => child.localName === "c")) {
        const reference = cellElement.getAttribute("r") ?? "A1";
        const index = columnIndex(reference);
        while (row.length <= index) row.push("");
        const type = cellElement.getAttribute("t");
        const valueElement = Array.from(cellElement.children).find((child) => child.localName === "v");
        const inlineElement = Array.from(cellElement.children).find((child) => child.localName === "is");
        const raw = valueElement?.textContent ?? inlineElement?.textContent ?? "";
        let value: Cell = raw;
        if (type === "s") value = sharedStrings[Number(raw)] ?? "";
        else if (type === "b") value = raw === "1";
        else if (!type && raw !== "" && Number.isFinite(Number(raw))) value = Number(raw);
        row[index] = value;
        cellCount++;
        if (cellCount > MAX_CELLS) throw new Error("This spreadsheet is too large to render safely in the browser.");
      }
      rows.push(row);
    }
    result.push({ name: sheet.getAttribute("name") ?? `Sheet ${result.length + 1}`, rows });
  }
  return result;
}

export async function readSpreadsheet(file: File): Promise<SheetData[]> {
  const extension = extensionOf(file.name);
  if (extension === "csv") {
    return [{ name: "Sheet 1", rows: parseCsv(new TextDecoder().decode(await file.arrayBuffer())) }];
  }
  if (extension !== "xlsx") {
    throw new Error("Legacy .xls files are not supported. Save the workbook as .xlsx or .csv and try again.");
  }
  return parseXlsx(new Uint8Array(await file.arrayBuffer()));
}
