import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/** Generation de rapports PDF (Module 10) avec pdf-lib (100% JavaScript, aucune binaire natif). */

const BRAND = rgb(0.07, 0.22, 0.45);
const ACCENT = rgb(0.96, 0.51, 0.12);
const INK = rgb(0.16, 0.18, 0.22);
const MUTED = rgb(0.45, 0.48, 0.53);
const LINE = rgb(0.87, 0.89, 0.92);

/** Les polices standard n'acceptent que WinAnsi : on neutralise le reste. */
function sanitize(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/[^\u0000-\u00FF]/g, "?");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = sanitize(text).split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export type ReportPdfInput = {
  title: string;
  companyName: string;
  period: string;
  generatedAt: string;
  kpis: { label: string; value: string }[];
  table?: { headers: string[]; rows: string[][] };
  notes?: string[];
};

export async function buildReportPdf(input: ReportPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 48;
  let page = pdf.addPage([595.28, 841.89]);
  let cursorY = 0;

  const drawHeader = (target: PDFPage) => {
    const { width, height } = target.getSize();
    target.drawRectangle({ x: 0, y: height - 96, width, height: 96, color: BRAND });
    target.drawRectangle({ x: 0, y: height - 100, width, height: 4, color: ACCENT });
    target.drawText("SHALO COM SPACE", { x: margin, y: height - 46, size: 16, font: bold, color: rgb(1, 1, 1) });
    target.drawText("BATIANA TECH", { x: margin, y: height - 64, size: 9, font, color: rgb(0.78, 0.84, 0.93) });
    target.drawText(sanitize(input.companyName), {
      x: margin,
      y: height - 80,
      size: 10,
      font: bold,
      color: rgb(1, 1, 1),
    });
    return height - 130;
  };

  const drawFooter = (target: PDFPage, pageNumber: number) => {
    const { width } = target.getSize();
    target.drawLine({ start: { x: margin, y: 54 }, end: { x: width - margin, y: 54 }, thickness: 0.5, color: LINE });
    target.drawText(sanitize(`Genere le ${input.generatedAt} - SHALO COM SPACE`), {
      x: margin,
      y: 40,
      size: 8,
      font,
      color: MUTED,
    });
    target.drawText(`Page ${pageNumber}`, { x: width - margin - 40, y: 40, size: 8, font, color: MUTED });
  };

  const newPage = () => {
    drawFooter(page, pdf.getPageCount());
    page = pdf.addPage([595.28, 841.89]);
    cursorY = drawHeader(page);
  };

  const ensureSpace = (needed: number) => {
    if (cursorY - needed < 80) newPage();
  };

  const width = 595.28 - margin * 2;
  cursorY = drawHeader(page);

  page.drawText(sanitize(input.title), { x: margin, y: cursorY, size: 18, font: bold, color: INK });
  cursorY -= 18;
  page.drawText(sanitize(`Periode analysee : ${input.period}`), {
    x: margin,
    y: cursorY,
    size: 10,
    font,
    color: MUTED,
  });
  cursorY -= 28;

  // Indicateurs cles
  const columnWidth = width / 2;
  input.kpis.forEach((kpi, index) => {
    const column = index % 2;
    if (column === 0) ensureSpace(58);
    const x = margin + column * columnWidth;
    const y = cursorY;
    page.drawRectangle({
      x,
      y: y - 46,
      width: columnWidth - 10,
      height: 46,
      borderColor: LINE,
      borderWidth: 0.8,
      color: rgb(0.98, 0.985, 0.995),
    });
    page.drawText(sanitize(kpi.label), { x: x + 10, y: y - 18, size: 8.5, font, color: MUTED });
    page.drawText(sanitize(kpi.value), { x: x + 10, y: y - 36, size: 14, font: bold, color: BRAND });
    if (column === 1 || index === input.kpis.length - 1) cursorY -= 56;
  });

  if (input.table && input.table.rows.length > 0) {
    cursorY -= 8;
    ensureSpace(40);
    page.drawText("Detail", { x: margin, y: cursorY, size: 12, font: bold, color: INK });
    cursorY -= 18;

    const colWidth = width / input.table.headers.length;
    const drawRow = (cells: string[], header: boolean) => {
      ensureSpace(22);
      if (header) {
        page.drawRectangle({ x: margin, y: cursorY - 4, width, height: 20, color: BRAND });
      }
      cells.forEach((cell, colIndex) => {
        const text = wrap(cell ?? "", header ? bold : font, 8.5, colWidth - 8)[0] ?? "";
        page.drawText(text, {
          x: margin + colIndex * colWidth + 4,
          y: cursorY + 1,
          size: 8.5,
          font: header ? bold : font,
          color: header ? rgb(1, 1, 1) : INK,
        });
      });
      if (!header) {
        page.drawLine({
          start: { x: margin, y: cursorY - 6 },
          end: { x: margin + width, y: cursorY - 6 },
          thickness: 0.4,
          color: LINE,
        });
      }
      cursorY -= 20;
    };

    drawRow(input.table.headers, true);
    for (const row of input.table.rows) drawRow(row, false);
  }

  if (input.notes?.length) {
    cursorY -= 14;
    ensureSpace(40);
    page.drawText("Notes methodologiques", { x: margin, y: cursorY, size: 12, font: bold, color: INK });
    cursorY -= 18;
    for (const note of input.notes) {
      for (const line of wrap(`- ${note}`, font, 9, width)) {
        ensureSpace(14);
        page.drawText(line, { x: margin, y: cursorY, size: 9, font, color: MUTED });
        cursorY -= 13;
      }
    }
  }

  drawFooter(page, pdf.getPageCount());
  return pdf.save();
}
