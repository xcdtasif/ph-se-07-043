import PDFDocument from "pdfkit"

import { uploadPdf } from "../../lib/cloudinary.js"

// A fixed id, so seeding again replaces the file instead of adding another
const SAMPLE_CV_ID = "seed-sample-cv"

const buildSampleCv = () =>
  new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, info: { Title: "Sample CV" } })
    const chunks: Buffer[] = []

    doc.on("data", (chunk: Buffer) => chunks.push(chunk))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    doc.font("Helvetica-Bold").fontSize(22).text("Sample CV")
    doc.moveDown(0.5).font("Helvetica").fontSize(11).fillColor("#6b7280")
    doc.text(
      "Every seeded GridLine application links to this file. Real applicants upload their own.",
    )
    doc.end()
  })

// The one CV every seeded application points to
export const uploadSampleCv = async () =>
  uploadPdf(await buildSampleCv(), "gridline/cvs", SAMPLE_CV_ID)
