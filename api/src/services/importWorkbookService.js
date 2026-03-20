import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { AppError } from "../utils/AppError.js";

const STORAGE_DIR = path.resolve(process.cwd(), "api/.import_uploads");

const PYTHON_PARSER = String.raw`
import sys, os, json, csv, io, zipfile
import xml.etree.ElementTree as ET

FILE_PATH = sys.argv[1]
MODE = sys.argv[2]
SHEET = sys.argv[3] if len(sys.argv) > 3 else None
LIMIT_ARG = sys.argv[4] if len(sys.argv) > 4 else ""


def normalize_text(value):
    if value is None:
        return ""
    return str(value).strip()


def to_col_index(cell_ref):
    letters = ""
    for ch in cell_ref:
        if ch.isalpha():
            letters += ch
        else:
            break
    idx = 0
    for ch in letters:
        idx = idx * 26 + (ord(ch.upper()) - 64)
    return max(0, idx - 1)


def parse_shared_strings(zf):
    try:
        raw = zf.read("xl/sharedStrings.xml")
    except KeyError:
        return []
    root = ET.fromstring(raw)
    ns = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    items = []
    for si in root.findall("a:si", ns):
        text_parts = []
        for t in si.findall(".//a:t", ns):
            text_parts.append(t.text or "")
        items.append("".join(text_parts))
    return items


def parse_sheets(zf):
    workbook = ET.fromstring(zf.read("xl/workbook.xml"))
    rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))

    wb_ns = {
        "a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
        "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    }
    rel_ns = {"a": "http://schemas.openxmlformats.org/package/2006/relationships"}

    rel_map = {}
    for rel in rels.findall("a:Relationship", rel_ns):
        rel_id = rel.attrib.get("Id")
        target = rel.attrib.get("Target", "")
        if rel_id and target:
            rel_map[rel_id] = target

    sheets = []
    for sheet in workbook.findall("a:sheets/a:sheet", wb_ns):
        rel_id = sheet.attrib.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
        target = rel_map.get(rel_id, "")
        if target and not target.startswith("xl/"):
            target = f"xl/{target}"
        sheets.append({
            "name": sheet.attrib.get("name", "Hoja"),
            "path": target,
        })
    return sheets


def parse_worksheet_rows(zf, sheet_path, shared_strings, limit=None):
    ns = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    root = ET.fromstring(zf.read(sheet_path))
    row_entries = []

    for row in root.findall(".//a:sheetData/a:row", ns):
        row_number = int(row.attrib.get("r", len(row_entries) + 1))
        row_values = {}
        max_col = 0

        for cell in row.findall("a:c", ns):
            cell_ref = cell.attrib.get("r", "A1")
            col = to_col_index(cell_ref)
            max_col = max(max_col, col)
            cell_type = cell.attrib.get("t")
            value = ""

            if cell_type == "inlineStr":
                text_node = cell.find("a:is/a:t", ns)
                value = text_node.text if text_node is not None else ""
            else:
                value_node = cell.find("a:v", ns)
                raw_value = value_node.text if value_node is not None else ""
                if cell_type == "s" and raw_value != "":
                    try:
                        value = shared_strings[int(raw_value)]
                    except Exception:
                        value = raw_value
                else:
                    value = raw_value

            row_values[col] = normalize_text(value)

        expanded = [""] * (max_col + 1)
        for c, v in row_values.items():
            if c < len(expanded):
                expanded[c] = v

        row_entries.append({"rowNumber": row_number, "values": expanded})

        if limit is not None and len(row_entries) >= limit:
            break

    return row_entries


def count_non_empty(row_entries):
    total = 0
    for entry in row_entries:
        row = entry.get("values", [])
        if any(normalize_text(v) != "" for v in row):
            total += 1
    return total


def parse_csv_rows(file_path, limit=None):
    with open(file_path, "rb") as f:
        blob = f.read()

    if b"\x00" in blob:
        raise ValueError("Archivo binario no soportado para este parser")

    try:
        text = blob.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = blob.decode("latin-1")

    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
    except Exception:
        class _Simple(csv.Dialect):
            delimiter = ','
            quotechar = '"'
            doublequote = True
            skipinitialspace = False
            lineterminator = '\n'
            quoting = csv.QUOTE_MINIMAL
        dialect = _Simple

    reader = csv.reader(io.StringIO(text), dialect)
    rows = []
    for index, row in enumerate(reader):
        rows.append({"rowNumber": index + 1, "values": [normalize_text(v) for v in row]})
        if limit is not None and len(rows) >= limit:
            break
    return rows


def parse_xlsx(file_path, limit=None):
    with zipfile.ZipFile(file_path, "r") as zf:
        shared = parse_shared_strings(zf)
        sheets = parse_sheets(zf)

        out = []
        for sheet in sheets:
            row_entries = parse_worksheet_rows(zf, sheet["path"], shared, limit=limit)
            out.append({
                "name": sheet["name"],
                "rowEntries": row_entries,
                "rows": [entry["values"] for entry in row_entries],
                "rowCount": count_non_empty(row_entries),
            })
        return out


def parse_any(file_path, limit=None):
    ext = os.path.splitext(file_path.lower())[1]
    if ext == ".xlsx":
        return parse_xlsx(file_path, limit=limit)

    row_entries = parse_csv_rows(file_path, limit=limit)
    return [{"name": "Datos", "rowEntries": row_entries, "rows": [entry["values"] for entry in row_entries], "rowCount": count_non_empty(row_entries)}]


try:
    parsed_limit = int(LIMIT_ARG) if LIMIT_ARG else None
    sheets = parse_any(FILE_PATH, limit=parsed_limit)
except Exception as exc:
    print(json.dumps({"ok": False, "error": str(exc)}))
    sys.exit(0)

if MODE == "sheets":
    print(json.dumps({"ok": True, "sheets": [{"name": s["name"], "rowCount": s["rowCount"]} for s in sheets]}))
    sys.exit(0)

selected = None
for s in sheets:
    if s["name"] == SHEET:
        selected = s
        break

if selected is None and sheets:
    selected = sheets[0]

if selected is None:
    print(json.dumps({"ok": True, "sheet": None, "rows": [], "rowEntries": []}))
elif MODE == "rows":
    print(json.dumps({"ok": True, "sheet": selected["name"], "rowEntries": selected["rowEntries"], "rowCount": selected["rowCount"]}))
else:
    print(json.dumps({"ok": True, "sheet": selected["name"], "rows": selected["rows"][:30], "rowCount": selected["rowCount"]}))
`;

async function ensureStorageDir() {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
}

function runParser(filePath, mode, sheetName = "", limit = null) {
  const args = ["-c", PYTHON_PARSER, filePath, mode, sheetName];
  if (limit !== null && limit !== undefined) {
    args.push(String(limit));
  }

  const result = spawnSync("python", args, {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });

  if (result.error) {
    throw new AppError("No fue posible procesar el archivo cargado", 500);
  }

  const output = (result.stdout || "").trim();
  if (!output) {
    throw new AppError("No se obtuvo respuesta del parser de Excel", 500);
  }

  const parsed = JSON.parse(output);

  if (!parsed.ok) {
    throw new AppError(`Error al leer archivo: ${parsed.error || "formato inválido"}`, 400);
  }

  return parsed;
}

export async function storeImportFile({ fileName, fileBase64 }) {
  await ensureStorageDir();

  const extension = path.extname(fileName || "").toLowerCase();
  const allowed = [".xlsx", ".xls", ".csv"];

  if (!allowed.includes(extension)) {
    throw new AppError("Formato no soportado. Usa .xlsx, .xls o .csv", 400);
  }

  const buffer = Buffer.from(fileBase64, "base64");
  if (!buffer.length) {
    throw new AppError("Archivo vacío", 400);
  }

  if (buffer.length > 15 * 1024 * 1024) {
    throw new AppError("El archivo excede el límite de 15MB", 400);
  }

  const storageName = `${Date.now()}-${randomUUID()}${extension}`;
  const fullPath = path.join(STORAGE_DIR, storageName);

  await fs.writeFile(fullPath, buffer);

  return {
    fullPath,
    storageName,
    extension,
    sizeBytes: buffer.length,
  };
}

export function getWorkbookSheets(filePath) {
  return runParser(filePath, "sheets").sheets || [];
}

export function getWorkbookPreview(filePath, sheetName) {
  return runParser(filePath, "preview", sheetName);
}

export function getWorkbookSheetRows(filePath, sheetName) {
  const payload = runParser(filePath, "rows", sheetName);
  return {
    sheet: payload.sheet,
    rowCount: payload.rowCount,
    rowEntries: payload.rowEntries || [],
  };
}

export function resolveStoredFilePath(storageName) {
  return path.join(STORAGE_DIR, storageName);
}
