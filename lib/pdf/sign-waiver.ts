import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export async function generateSignedWaiverPdf(opts: {
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
