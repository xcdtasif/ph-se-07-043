import PDFDocument from "pdfkit"

import type { EmployeeRole } from "../../generated/prisma/enums.js"
import { dhakaDate } from "../../utils/dhaka-time.js"

export type InvoiceData = {
  id: string
  invoiceNumber: string
  amount: number
  paidAt: Date
  paymentIntentId: string | null
  application: {
    phone: string
    user: { name: string; email: string }
    jobPosting: { title: string; role: EmployeeRole; zone: { name: string } }
  }
}

const ROLE_LABELS: Record<EmployeeRole, string> = {
  ADMIN: "Admin",
  ZONE_MANAGER: "Zone Manager",
  TECHNICIAN: "Technician",
}

// e.g. GL-20261127-3F2A9C1D: the Dhaka date it was paid and the start of the payment's id
export const toInvoiceNumber = (paymentId: string, paidAt: Date) =>
  `GL-${dhakaDate(0, paidAt).replaceAll("-", "")}-${paymentId.slice(0, 8).toUpperCase()}`

export const invoiceFilename = (invoiceNumber: string) => `invoice-${invoiceNumber}.pdf`

// Whole taka; Helvetica has no ৳ sign
export const formatBdt = (amount: number) => `BDT ${amount.toLocaleString("en-US")}`

export const formatPaidAt = (paidAt: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Dhaka",
  }).format(paidAt)

const MARGIN = 50
const MUTED = "#6b7280"
const TEXT = "#111827"
const LINE = "#e5e7eb"

/*
A one-page A4 invoice in pdfkit's built-in Helvetica, whose font files it reads from its own
package folder, so the server needs node_modules as installed (no bundler)
*/
export const buildInvoicePdf = (invoice: InvoiceData) =>
  new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: MARGIN,
      info: { Title: `Invoice ${invoice.invoiceNumber}`, Author: "GridLine" },
    })
    const chunks: Buffer[] = []

    doc.on("data", (chunk: Buffer) => chunks.push(chunk))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    const { application } = invoice
    const { jobPosting } = application
    const left = MARGIN
    const right = doc.page.width - MARGIN
    const width = right - left
    const rule = (y: number) => doc.moveTo(left, y).lineTo(right, y).strokeColor(LINE).stroke()

    // Header: the brand on the left, the document's name on the right
    doc.font("Helvetica-Bold").fontSize(22).fillColor(TEXT).text("GridLine", left, MARGIN)
    doc.fontSize(22).text("Invoice", left, MARGIN, { width, align: "right" })
    doc.font("Helvetica").fontSize(10).fillColor(MUTED)
    doc.text("Power outage tracking and hiring", left, MARGIN + 28)
    doc.text("PAID", left, MARGIN + 28, { width, align: "right" })
    rule(MARGIN + 54)

    // Invoice facts on the left, who paid on the right
    const top = MARGIN + 72
    const half = width / 2
    const facts: [string, string][] = [
      ["Invoice number", invoice.invoiceNumber],
      ["Paid on", formatPaidAt(invoice.paidAt)],
      ["Payment method", "Stripe Checkout"],
    ]

    facts.forEach(([label, value], index) => {
      const y = top + index * 32
      doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(label, left, y)
      doc
        .font("Helvetica")
        .fontSize(11)
        .fillColor(TEXT)
        .text(value, left, y + 12)
    })

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(MUTED)
      .text("Billed to", left + half, top)
    doc.font("Helvetica-Bold").fontSize(11).fillColor(TEXT)
    doc.text(application.user.name, left + half, top + 12, { width: half })
    doc.font("Helvetica").fontSize(10).fillColor(MUTED)
    doc.text(application.user.email, { width: half })
    doc.text(application.phone, { width: half })

    // One line item and the total
    const tableTop = top + 120
    doc.font("Helvetica-Bold").fontSize(9).fillColor(MUTED)
    doc.text("DESCRIPTION", left, tableTop)
    doc.text("AMOUNT", left, tableTop, { width, align: "right" })
    rule(tableTop + 16)

    const itemTop = tableTop + 28
    doc.font("Helvetica").fontSize(11).fillColor(TEXT)
    doc.text(`Application fee: ${jobPosting.title}`, left, itemTop, { width: width - 120 })
    doc.text(formatBdt(invoice.amount), left, itemTop, { width, align: "right" })
    doc.fontSize(9).fillColor(MUTED)
    doc.text(`${ROLE_LABELS[jobPosting.role]}, ${jobPosting.zone.name}`, left, doc.y + 2, {
      width: width - 120,
    })

    const totalTop = doc.y + 16
    rule(totalTop)
    doc.font("Helvetica-Bold").fontSize(12).fillColor(TEXT)
    doc.text("Total paid", left, totalTop + 12)
    doc.text(formatBdt(invoice.amount), left, totalTop + 12, { width, align: "right" })

    // Stripe's reference, for matching this invoice to the payment in a dispute
    doc.font("Helvetica").fontSize(9).fillColor(MUTED)
    const notes = [
      invoice.paymentIntentId && `Stripe reference: ${invoice.paymentIntentId}`,
      "Thank you for applying to GridLine.",
    ].filter(Boolean)
    doc.text(notes.join("\n"), left, totalTop + 48, { width, lineGap: 4 })

    doc.end()
  })
