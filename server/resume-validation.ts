import { inflateRawSync } from "node:zlib";

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
export const PDF_CONTENT_TYPE = "application/pdf";
export const DOCX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type ResumeValidation = { ok: true; type: "pdf" | "docx" } | { ok: false; error: string };

type ZipEntry = { name: string; method: number; checksum: number; compressedSize: number; uncompressedSize: number; offset: number };

function crc32(bytes: Buffer) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipEntries(bytes: Buffer): Map<string, ZipEntry> | null {
  const minimum = Math.max(0, bytes.length - 65557);
  let eocd = -1;
  for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
    if (bytes.readUInt32LE(offset) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) return null;

  const diskNumber = bytes.readUInt16LE(eocd + 4);
  const centralDisk = bytes.readUInt16LE(eocd + 6);
  const diskEntries = bytes.readUInt16LE(eocd + 8);
  const totalEntries = bytes.readUInt16LE(eocd + 10);
  const centralSize = bytes.readUInt32LE(eocd + 12);
  const centralOffset = bytes.readUInt32LE(eocd + 16);
  const commentSize = bytes.readUInt16LE(eocd + 20);
  if (diskNumber || centralDisk || diskEntries !== totalEntries || totalEntries > 2048 || centralSize > bytes.length || centralOffset + centralSize > eocd || eocd + 22 + commentSize > bytes.length) return null;

  const entries = new Map<string, ZipEntry>();
  let offset = centralOffset;
  for (let index = 0; index < totalEntries; index += 1) {
    if (offset + 46 > bytes.length || bytes.readUInt32LE(offset) !== 0x02014b50) return null;
    const flags = bytes.readUInt16LE(offset + 8);
    const method = bytes.readUInt16LE(offset + 10);
    const checksum = bytes.readUInt32LE(offset + 16);
    const compressedSize = bytes.readUInt32LE(offset + 20);
    const uncompressedSize = bytes.readUInt32LE(offset + 24);
    const nameSize = bytes.readUInt16LE(offset + 28);
    const extraSize = bytes.readUInt16LE(offset + 30);
    const entryCommentSize = bytes.readUInt16LE(offset + 32);
    const localOffset = bytes.readUInt32LE(offset + 42);
    const end = offset + 46 + nameSize + extraSize + entryCommentSize;
    if (end > bytes.length || (flags & 1) !== 0 || (method !== 0 && method !== 8) || compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) return null;
    const name = bytes.toString("utf8", offset + 46, offset + 46 + nameSize);
    if (!name || name.includes("..") || name.startsWith("/") || entries.has(name)) return null;
    entries.set(name, { name, method, checksum, compressedSize, uncompressedSize, offset: localOffset });
    offset = end;
  }
  return offset === centralOffset + centralSize ? entries : null;
}

function readZipEntry(bytes: Buffer, entry: ZipEntry): Buffer | null {
  const offset = entry.offset;
  if (offset + 30 > bytes.length || bytes.readUInt32LE(offset) !== 0x04034b50) return null;
  const flags = bytes.readUInt16LE(offset + 6);
  const method = bytes.readUInt16LE(offset + 8);
  const nameSize = bytes.readUInt16LE(offset + 26);
  const extraSize = bytes.readUInt16LE(offset + 28);
  if ((flags & 1) !== 0 || method !== entry.method) return null;
  const dataStart = offset + 30 + nameSize + extraSize;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > bytes.length || bytes.toString("utf8", offset + 30, offset + 30 + nameSize) !== entry.name) return null;
  const compressed = bytes.subarray(dataStart, dataEnd);
  try {
    const content = entry.method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed, { maxOutputLength: 10 * 1024 * 1024 });
    return content.length === entry.uncompressedSize && crc32(content) === entry.checksum ? content : null;
  } catch {
    return null;
  }
}

function isDocx(bytes: Buffer) {
  const entries = zipEntries(bytes);
  if (!entries) return false;
  const required = ["[Content_Types].xml", "_rels/.rels", "word/document.xml"];
  if (required.some((name) => !entries.has(name))) return false;
  const typesEntry = entries.get("[Content_Types].xml")!;
  const relsEntry = entries.get("_rels/.rels")!;
  const documentEntry = entries.get("word/document.xml")!;
  if (typesEntry.uncompressedSize > 256 * 1024 || relsEntry.uncompressedSize > 256 * 1024 || documentEntry.uncompressedSize > 10 * 1024 * 1024) return false;
  const types = readZipEntry(bytes, typesEntry)?.toString("utf8");
  const rels = readZipEntry(bytes, relsEntry)?.toString("utf8");
  const document = readZipEntry(bytes, documentEntry)?.toString("utf8");
  return Boolean(types && rels && document
    && /<Types(?:\s|>)/.test(types)
    && /PartName=["']\/word\/document\.xml["']/.test(types)
    && /ContentType=["']application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document\.main\+xml["']/.test(types)
    && /<Relationships(?:\s|>)/.test(rels)
    && /relationships\/officeDocument/.test(rels)
    && /Target=["']word\/document\.xml["']/.test(rels)
    && /<w:document(?:\s|>)/.test(document)
    && /<w:body(?:\s|>)/.test(document)
    && /<\/w:body>/.test(document)
    && /<\/w:document>/.test(document));
}

function hasClassicPdfXref(xref: string, source: string) {
  const lines = xref.slice(4).split(/\r?\n/);
  const entries = new Map<string, number>();
  let cursor = 0;
  let trailerSeen = false;
  while (cursor < lines.length) {
    const line = lines[cursor++]!.trim();
    if (!line) continue;
    if (line === "trailer") {
      trailerSeen = true;
      break;
    }
    const subsection = /^(\d+)\s+(\d+)$/.exec(line);
    if (!subsection) return false;
    const firstObject = Number(subsection[1]);
    const entryCount = Number(subsection[2]);
    if (!Number.isSafeInteger(firstObject) || !Number.isSafeInteger(entryCount) || entryCount > lines.length) return false;
    for (let index = 0; index < entryCount; index += 1) {
      const entry = /^(\d{10})\s+(\d{5})\s+([nf])\s*$/.exec(lines[cursor++]?.trim() ?? "");
      if (!entry) return false;
      if (entry[3] !== "n") continue;
      const objectNumber = firstObject + index;
      const generation = Number(entry[2]);
      const objectOffset = Number(entry[1]);
      if (!new RegExp(`^${objectNumber}\\s+${generation}\\s+obj\\b`).test(source.slice(objectOffset, objectOffset + 40))) return false;
      entries.set(`${objectNumber}:${generation}`, objectOffset);
    }
  }
  if (!trailerSeen) return false;
  const root = /trailer\s*<<[\s\S]*?\/Root\s+(\d+)\s+(\d+)\s+R/.exec(xref);
  if (!root) return false;
  const rootOffset = entries.get(`${root[1]}:${root[2]}`);
  if (rootOffset === undefined) return false;
  const rootEnd = source.indexOf("endobj", rootOffset);
  return rootEnd > rootOffset && /\/Type\s*\/Catalog\b/.test(source.slice(rootOffset, rootEnd));
}

function isPdf(bytes: Buffer) {
  if (!/^%PDF-(?:1\.[0-7]|2\.0)/.test(bytes.toString("ascii", 0, 9))) return false;
  const source = bytes.toString("latin1");
  const eofOffset = source.lastIndexOf("%%EOF");
  if (eofOffset < 0 || !/^\s*$/.test(source.slice(eofOffset + 5))) return false;
  const startxrefOffset = source.lastIndexOf("startxref", eofOffset);
  if (startxrefOffset < 0) return false;
  const startxref = /^startxref\s+(\d+)\s*$/.exec(source.slice(startxrefOffset, eofOffset));
  if (!startxref) return false;
  const xrefOffset = Number(startxref[1]);
  if (!Number.isSafeInteger(xrefOffset) || xrefOffset < 9 || xrefOffset >= startxrefOffset) return false;
  const xref = source.slice(xrefOffset, startxrefOffset);
  if (/^xref(?:\s|$)/.test(xref)) {
    return hasClassicPdfXref(xref, source);
  }
  return /^\d+\s+\d+\s+obj\b(?=[\s\S]*?\/Type\s*\/XRef\b)(?=[\s\S]*?\/Root\s+\d+\s+\d+\s+R)(?=[\s\S]*?\/W\s*\[)(?=[\s\S]*?\bstream\r?\n)[\s\S]*?\bendobj\b/.test(xref);
}

export function validateResumeBytes(bytes: Buffer): ResumeValidation {
  if (bytes.length === 0) return { ok: false, error: "Choose a resume file; the selected file is empty." };
  if (bytes.length > MAX_RESUME_BYTES) return { ok: false, error: "Resume must be 5 MB or smaller." };
  if (isPdf(bytes)) return { ok: true, type: "pdf" };
  if (isDocx(bytes)) return { ok: true, type: "docx" };
  return { ok: false, error: "Resume must be a valid PDF or DOCX file." };
}

export function resumeContentType(type: string | null) {
  return type === "docx" ? DOCX_CONTENT_TYPE : PDF_CONTENT_TYPE;
}

export function safeResumeFilename(filename: string, type: string | null) {
  const base = filename.split(/[\\/]/).at(-1)?.replace(/[\u0000-\u001f\u007f";]/g, "_").slice(0, 180) || "resume";
  const extension = type === "docx" ? ".docx" : ".pdf";
  return `${base.replace(/\.[^.]*$/, "") || "resume"}${extension}`;
}
