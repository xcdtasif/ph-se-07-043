import { escapeHtml } from "../../utils/escape-html.js"
import { formatBdt, formatPaidAt } from "./payment.invoice.js"

type InvoiceEmail = {
  name: string
  jobTitle: string
  amount: number
  paidAt: Date
  invoiceNumber: string
}

// Sent from the webhook once the fee is paid, with the invoice PDF attached
export const invoiceEmailTemplate = ({
  name,
  jobTitle,
  amount,
  paidAt,
  invoiceNumber,
}: InvoiceEmail) => `
<div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; color: #1f2937">
  <h2 style="margin-bottom: 4px">Payment received</h2>
  <p>Hi ${escapeHtml(name)}, we received your application fee, and your application for
  <strong>${escapeHtml(jobTitle)}</strong> is submitted.</p>
  <p style="font-size: 24px; font-weight: bold; margin: 24px 0">${formatBdt(amount)}</p>
  <p>Invoice ${invoiceNumber}, paid ${formatPaidAt(paidAt)}. The invoice is attached.</p>
  <p>We'll email you when your application's status changes.</p>
</div>
`
