import assert from "node:assert/strict";
import test from "node:test";
import { MAX_RESUME_BYTES, validateResumeBytes } from "../server/resume-validation.ts";

function crc32(data: Buffer) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeDocx() {
  const files = [
    ["[Content_Types].xml", "<Types><Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/></Types>"],
    ["_rels/.rels", "<Relationships><Relationship Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/></Relationships>"],
    ["word/document.xml", "<w:document><w:body><w:p/></w:body></w:document>"],
  ] as const;
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;
  for (const [name, text] of files) {
    const nameBytes = Buffer.from(name);
    const content = Buffer.from(text);
    const checksum = crc32(content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    localParts.push(local, nameBytes, content);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(content.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(localOffset, 42);
    centralParts.push(central, nameBytes);
    localOffset += local.length + nameBytes.length + content.length;
  }
  const central = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(localOffset, 16);
  return Buffer.concat([...localParts, central, end]);
}

function makePdf() {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [] /Count 0 >>",
  ];
  let document = "%PDF-1.7\n";
  const offsets = [0];
  for (const [index, body] of objects.entries()) {
    offsets.push(Buffer.byteLength(document));
    document += `${index + 1} 0 obj\n${body}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(document);
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) document += `${String(offset).padStart(10, "0")} 00000 n \n`;
  document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(document);
}

test("resume validation checks empty, actual PDF signature, and size boundaries", () => {
  assert.deepEqual(validateResumeBytes(Buffer.alloc(0)), { ok: false, error: "Choose a resume file; the selected file is empty." });
  assert.deepEqual(validateResumeBytes(makePdf()), { ok: true, type: "pdf" });
  assert.equal(validateResumeBytes(Buffer.from("%PDF-1.7\njust a text file")).ok, false);
  assert.equal(validateResumeBytes(Buffer.from("%PDF-1.7\ntrailer << /Root 1 0 R >>\nstartxref\n0\n%%EOF\n")).ok, false);
  assert.equal(validateResumeBytes(Buffer.from("%PDF-1.7\nxref\n0 1\n0000000000 65535 f \ntrailer\n<< /Size 1 /Root 0 0 R >>\nstartxref\n9\n%%EOF\n")).ok, false);
  assert.equal(validateResumeBytes(Buffer.from("resume.pdf but not a PDF")).ok, false);
  const pdf = makePdf();
  const atLimit = Buffer.concat([pdf, Buffer.alloc(MAX_RESUME_BYTES - pdf.length, 0x20)]);
  assert.deepEqual(validateResumeBytes(atLimit), { ok: true, type: "pdf" });
  assert.equal(validateResumeBytes(Buffer.alloc(MAX_RESUME_BYTES + 1)).ok, false);
});

test("DOCX validation requires a ZIP with Word document structure", () => {
  assert.deepEqual(validateResumeBytes(makeDocx()), { ok: true, type: "docx" });
  assert.equal(validateResumeBytes(Buffer.from("PK but not a valid archive")).ok, false);
});
