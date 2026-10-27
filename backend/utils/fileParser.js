const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const XLSX = require("xlsx");
const Tesseract = require("tesseract.js");

const HEADER_ALIASES = {
  section: ["section", "sectionname", "class", "batch"],
  day: ["day", "weekday"],
  time: ["time", "slot", "period"],
  subject: ["subject", "subjectname"],
  faculty: ["faculty", "teacher", "instructor", "professor"],
  room: ["room", "roomnumber", "classroom"],
};

function normalizeToken(value = "") {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

function detectDelimiter(line) {
  if (line.includes("|")) return "|";
  if (line.includes("\t")) return "\t";
  if (line.includes(",")) return ",";
  if (/\s{2,}/.test(line)) return "  ";
  return null;
}

function splitLine(line, delimiter) {
  if (delimiter === "  ") {
    return line.split(/\s{2,}/).map((s) => s.trim());
  }
  return line.split(delimiter).map((s) => s.trim());
}

function isHeaderRow(cells) {
  const normalized = cells.map(normalizeToken);
  return normalized.includes("day") && normalized.includes("time");
}

function mapHeader(cells) {
  const headerMap = {};
  cells.forEach((cell, index) => {
    const token = normalizeToken(cell);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.some((alias) => token === normalizeToken(alias))) {
        headerMap[index] = field;
        break;
      }
    }
  });
  return headerMap;
}

function parseTableText(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let defaultSectionName = null;
  for (const line of lines) {
    const match = line.match(/section\s*[:\-]\s*(.+)/i);
    if (match) {
      defaultSectionName = match[1].trim();
      break;
    }
  }

  let headerIndex = -1;
  let delimiter = null;
  let headerCells = [];

  for (let i = 0; i < lines.length; i += 1) {
    const detected = detectDelimiter(lines[i]);
    if (!detected) continue;
    const cells = splitLine(lines[i], detected);
    if (isHeaderRow(cells)) {
      headerIndex = i;
      delimiter = detected;
      headerCells = cells;
      break;
    }
  }

  if (headerIndex === -1) {
    throw new Error("Could not detect a valid table header. Ensure columns include Day and Time.");
  }

  const headerMap = mapHeader(headerCells);
  const slots = [];

  for (let i = headerIndex + 1; i < lines.length; i += 1) {
    const cells = splitLine(lines[i], delimiter);
    if (cells.length < 2) continue;
    const row = {};
    Object.entries(headerMap).forEach(([idx, field]) => {
      const cellValue = cells[Number(idx)];
      if (cellValue !== undefined && cellValue !== "") {
        row[field] = cellValue;
      }
    });
    if (!row.section && defaultSectionName) {
      row.section = defaultSectionName;
    }
    if (row.day || row.time || row.subject || row.faculty || row.room || row.section) {
      slots.push(row);
    }
  }

  return { slots };
}

function normalizeJsonPayload(payload) {
  if (Array.isArray(payload)) {
    return { slots: payload };
  }
  if (payload?.slots) {
    return { sectionId: payload.sectionId || payload.section, slots: payload.slots };
  }
  if (payload?.timetable?.slots) {
    return { sectionId: payload.timetable.sectionId || payload.sectionId, slots: payload.timetable.slots };
  }
  if (payload?.data?.slots) {
    return { sectionId: payload.data.sectionId || payload.sectionId, slots: payload.data.slots };
  }
  return payload;
}

async function parseJsonInput(jsonInput) {
  if (typeof jsonInput === "string") {
    const parsed = JSON.parse(jsonInput);
    return normalizeJsonPayload(parsed);
  }
  return normalizeJsonPayload(jsonInput);
}

async function parseFileBuffer(buffer, mimeType, fileName = "") {
  const lower = fileName.toLowerCase();
  const isPdf = mimeType === "application/pdf" || lower.endsWith(".pdf");
  const isDocx =
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".docx");
  const isXlsx =
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel" ||
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls");
  const isJson = mimeType === "application/json" || lower.endsWith(".json");

  if (isPdf) {
    const parsed = await pdfParse(buffer);
    return parseTableText(parsed.text || "");
  }

  if (isDocx) {
    const parsed = await mammoth.extractRawText({ buffer });
    return parseTableText(parsed.value || "");
  }

  if (isJson) {
    const jsonText = buffer.toString("utf8");
    return parseJsonInput(jsonText);
  }

  if (isXlsx) {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const csvText = XLSX.utils.sheet_to_csv(sheet);
    return parseTableText(csvText);
  }

  // Fallback for text/csv uploads
  const text = buffer.toString("utf8");
  return parseTableText(text);
}

async function extractTextFromFile(buffer, mimeType, fileName = "") {
  const lower = fileName.toLowerCase();
  const isPdf = mimeType === "application/pdf" || lower.endsWith(".pdf");
  const isDocx =
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".docx");
  const isXlsx =
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel" ||
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls");
  const isImage =
    mimeType === "image/png" ||
    mimeType === "image/jpeg" ||
    mimeType === "image/jpg" ||
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg");

  if (isPdf) {
    const parsed = await pdfParse(buffer);
    return parsed.text || "";
  }

  if (isDocx) {
    const parsed = await mammoth.extractRawText({ buffer });
    return parsed.value || "";
  }

  if (isXlsx) {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_csv(sheet);
  }

  if (isImage) {
    const result = await Tesseract.recognize(buffer, "eng");
    return result?.data?.text || "";
  }

  return buffer.toString("utf8");
}

async function parseFromUrl(url) {
  if (typeof fetch !== "function") {
    throw new Error("Server fetch is not available. Upgrade to Node 18+ or add a fetch polyfill.");
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch URL (${response.status})`);
  }

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json") || url.toLowerCase().endsWith(".json");
  if (isJson) {
    const jsonPayload = await response.json();
    return normalizeJsonPayload(jsonPayload);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const text = await extractTextFromFile(buffer, contentType, url);
  return { text };
}

module.exports = {
  parseFileBuffer,
  parseJsonInput,
  parseFromUrl,
  parseTableText,
  normalizeJsonPayload,
  extractTextFromFile,
};
