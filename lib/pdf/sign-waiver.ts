import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export async function generateSignedWaiverPdf(opts: {
  signatureDataUrl: string;
  signerName: string;
  signedAt: string;
  waiverType: string;
  gymName: string | null;
  pdfTemplateBytes?: Uint8Array | null;
}): Promise<Uint8Array> {
  // ── Attempt to overlay onto the original template PDF ───────────────────
  if (opts.pdfTemplateBytes && opts.pdfTemplateBytes.length > 0) {
    try {
      const overlaid = await overlaySignatureOnTemplate({
        ...opts,
        pdfTemplateBytes: opts.pdfTemplateBytes,
      });
      if (overlaid) return overlaid;
    } catch {
      // Fall through to standalone if anything goes wrong
    }
  }

  // ── Fallback: standalone signed-waiver document ──────────────────────────
  return generateStandaloneDocument(opts);
}

// ─────────────────────────────────────────────────────────────────────────────
// Overlay: load the original template PDF and stamp the signature onto its
// last page in the bottom area.
// ─────────────────────────────────────────────────────────────────────────────
async function overlaySignatureOnTemplate(opts: {
  signatureDataUrl: string;
  signerName: string;
  signedAt: string;
  waiverType: string;
  gymName: string | null;
  pdfTemplateBytes: Uint8Array;
}): Promise<Uint8Array | null> {
  const doc = await PDFDocument.load(opts.pdfTemplateBytes);

  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await doc.embedFont(StandardFonts.Helvetica);

  // Always work on the last page (where the signature line typically lives)
  const lastPage = doc.getPage(doc.getPageCount() - 1);
  const { width } = lastPage.getSize();
  const margin = 50;

  const formattedDate = new Date(opts.signedAt).toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  });

  // Embed signature image
  const base64 = opts.signatureDataUrl.split(",")[1];
  const sigBytes = Buffer.from(base64, "base64");
  const sigImage = opts.signatureDataUrl.startsWith("data:image/png")
    ? await doc.embedPng(sigBytes)
    : await doc.embedJpg(sigBytes);

  const maxW = width - margin * 2;
  const maxH = 90;
  const dims = sigImage.scaleToFit(maxW, maxH);

  // ── Layout from bottom of page upward (y=0 is bottom in PDF coordinates) ──
  //
  //  y=16   Legal footer
  //  y=28   Separator line
  //  y=38   "Electronically signed via MatFlow"
  //  y=54   "Signed by" label  |  "Date signed" label (right column)
  //  y=68   Signer name        |  Formatted date
  //  y=84   Separator line
  //  y=94   Bottom of signature image
  //  ...    Signature image (up to 90 pt tall)
  //  +10    "Signature" label above image
  //
  // Total height needed ≈ 94 + 90 + 20 = ~204 pt
  // White background ensures readability regardless of template content.

  const sigImageY = 94;
  const bgTop = sigImageY + dims.height + 24;

  // White background over the bottom overlay area
  lastPage.drawRectangle({
    x: margin - 10,
    y: 10,
    width: width - (margin - 10) * 2,
    height: bgTop,
    color: rgb(1, 1, 1),
    opacity: 0.93,
  });

  // "Signature" label (above the image)
  lastPage.drawText("Signature", {
    x: margin,
    y: sigImageY + dims.height + 8,
    size: 8,
    font: regularFont,
    color: rgb(0.5, 0.5, 0.5),
  });

  // Signature image
  lastPage.drawImage(sigImage, {
    x: margin,
    y: sigImageY,
    width: dims.width,
    height: dims.height,
  });

  // Border around signature
  lastPage.drawRectangle({
    x: margin - 2,
    y: sigImageY - 2,
    width: dims.width + 4,
    height: dims.height + 4,
    borderColor: rgb(0.75, 0.75, 0.75),
    borderWidth: 0.75,
  });

  // Separator between signature and metadata text
  lastPage.drawLine({
    start: { x: margin, y: 84 },
    end: { x: width - margin, y: 84 },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });

  // Left column: "Signed by"
  lastPage.drawText("Signed by", {
    x: margin,
    y: 74,
    size: 8,
    font: regularFont,
    color: rgb(0.5, 0.5, 0.5),
  });
  lastPage.drawText(opts.signerName, {
    x: margin,
    y: 60,
    size: 11,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  // Right column: "Date signed"
  const rightCol = Math.floor(width / 2) + margin;
  lastPage.drawText("Date signed", {
    x: rightCol,
    y: 74,
    size: 8,
    font: regularFont,
    color: rgb(0.5, 0.5, 0.5),
  });
  lastPage.drawText(formattedDate, {
    x: rightCol,
    y: 60,
    size: 8,
    font: regularFont,
    color: rgb(0, 0, 0),
  });

  // Separator above footer
  lastPage.drawLine({
    start: { x: margin, y: 48 },
    end: { x: width - margin, y: 48 },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });

  // "Electronically signed via MatFlow"
  lastPage.drawText("Electronically signed via MatFlow", {
    x: margin,
    y: 38,
    size: 8,
    font: regularFont,
    color: rgb(0.4, 0.4, 0.4),
  });

  // Legal footer
  lastPage.drawText(
    "This document was electronically signed and is legally binding.",
    {
      x: margin,
      y: 16,
      size: 7.5,
      font: regularFont,
      color: rgb(0.6, 0.6, 0.6),
    },
  );

  return doc.save();
}

// ─────────────────────────────────────────────────────────────────────────────
// Fallback: generate a clean standalone document (original behaviour).
// ─────────────────────────────────────────────────────────────────────────────
async function generateStandaloneDocument(opts: {
  signatureDataUrl: string;
  signerName: string;
  signedAt: string;
  waiverType: string;
  gymName: string | null;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]); // US Letter
  const { width, height } = page.getSize();

  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await doc.embedFont(StandardFonts.Helvetica);

  const margin = 60;
  let y = height - margin;

  // Gym name
  if (opts.gymName) {
    page.drawText(opts.gymName, {
      x: margin,
      y,
      size: 20,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    y -= 28;
  }

  // Waiver type
  page.drawText(opts.waiverType, {
    x: margin,
    y,
    size: 14,
    font: regularFont,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= 36;

  // Divider line
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });
  y -= 28;

  // Signed by
  page.drawText("Signed by", {
    x: margin,
    y,
    size: 10,
    font: regularFont,
    color: rgb(0.5, 0.5, 0.5),
  });
  y -= 18;
  page.drawText(opts.signerName, {
    x: margin,
    y,
    size: 14,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  y -= 28;

  // Date signed
  const formattedDate = new Date(opts.signedAt).toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  });
  page.drawText("Date signed", {
    x: margin,
    y,
    size: 10,
    font: regularFont,
    color: rgb(0.5, 0.5, 0.5),
  });
  y -= 18;
  page.drawText(formattedDate, {
    x: margin,
    y,
    size: 12,
    font: regularFont,
    color: rgb(0, 0, 0),
  });
  y -= 40;

  // Signature label
  page.drawText("Signature", {
    x: margin,
    y,
    size: 10,
    font: regularFont,
    color: rgb(0.5, 0.5, 0.5),
  });
  y -= 12;

  // Embed signature image
  const base64 = opts.signatureDataUrl.split(",")[1];
  const sigBytes = Buffer.from(base64, "base64");
  const sigImage = opts.signatureDataUrl.startsWith("data:image/png")
    ? await doc.embedPng(sigBytes)
    : await doc.embedJpg(sigBytes);

  const maxW = width - margin * 2;
  const maxH = 130;
  const dims = sigImage.scaleToFit(maxW, maxH);
  const imgY = y - dims.height;

  // Border around signature
  page.drawRectangle({
    x: margin - 2,
    y: imgY - 2,
    width: dims.width + 4,
    height: dims.height + 4,
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 1,
  });

  page.drawImage(sigImage, {
    x: margin,
    y: imgY,
    width: dims.width,
    height: dims.height,
  });

  // "Electronically signed via MatFlow"
  page.drawText("Electronically signed via MatFlow", {
    x: margin,
    y: 54,
    size: 9,
    font: regularFont,
    color: rgb(0.45, 0.45, 0.45),
  });

  // Footer
  page.drawText(
    "This document was electronically signed and is legally binding.",
    {
      x: margin,
      y: 36,
      size: 9,
      font: regularFont,
      color: rgb(0.6, 0.6, 0.6),
    },
  );

  return doc.save();
}
