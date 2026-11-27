import nodemailer from "nodemailer"

import { env } from "../config/env.js"

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
})

type Mail = {
  to: string
  subject: string
  html: string
  attachments?: { filename: string; content: Buffer; contentType: string }[]
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
}

/*
The plain-text part of an email, from its HTML: a block per heading or paragraph. Spam filters
distrust HTML-only mail, and some mail apps show only the text part
*/
const toText = (html: string) =>
  html
    .replace(/\s+/g, " ")
    .replace(/<\/(h\d|p|div)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity] ?? entity)
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

// Awaited before responding: a serverless function may be frozen once the response is sent
export const sendMail = async ({ to, subject, html, attachments }: Mail) => {
  await transporter.sendMail({
    from: `"GridLine" <${env.SMTP_USER}>`,
    to,
    subject,
    html,
    text: toText(html),
    ...(attachments && { attachments }),
  })
}
