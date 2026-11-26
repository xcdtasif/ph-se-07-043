import nodemailer from "nodemailer"

import { env } from "../config/env.js"

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
})

type Mail = { to: string; subject: string; html: string }

// Awaited before responding: a serverless function may be frozen once the response is sent
export const sendMail = async ({ to, subject, html }: Mail) => {
  await transporter.sendMail({ from: `"GridLine" <${env.SMTP_USER}>`, to, subject, html })
}
