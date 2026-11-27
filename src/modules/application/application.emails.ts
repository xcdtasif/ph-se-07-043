import { env } from "../../config/env.js"
import type { ApplicationStatus } from "../../generated/prisma/enums.js"
import { escapeHtml } from "../../utils/escape-html.js"

type ReviewStatus = Extract<ApplicationStatus, "SHORTLISTED" | "REJECTED" | "HIRED">

type StatusEmail = {
  name: string
  status: ReviewStatus
  jobTitle: string
  zoneName: string
}

const SUBJECTS: Record<ReviewStatus, string> = {
  SHORTLISTED: "You're shortlisted",
  REJECTED: "Update on your application",
  HIRED: "You're hired",
}

const bodies = (job: string, zone: string): Record<ReviewStatus, string> => ({
  SHORTLISTED: `<p>Good news: your application for <strong>${job}</strong> is shortlisted. We'll
  email you again once a decision is made.</p>`,
  REJECTED: `<p>Thank you for applying for <strong>${job}</strong>. We've decided not to go ahead
  with your application this time.</p>`,
  HIRED: `<p>Congratulations: you're hired for <strong>${job}</strong> in ${zone}. Log in to
  GridLine with your usual account to open your new dashboard.</p>`,
})

export const statusEmailSubject = (status: ReviewStatus, jobTitle: string) =>
  `${SUBJECTS[status]}: ${jobTitle}`

// Sent after a reviewer shortlists, rejects or hires an application
export const statusEmailTemplate = ({ name, status, jobTitle, zoneName }: StatusEmail) => `
<div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; color: #1f2937">
  <h2 style="margin-bottom: 4px">${SUBJECTS[status]}</h2>
  <p>Hi ${escapeHtml(name)},</p>
  ${bodies(escapeHtml(jobTitle), escapeHtml(zoneName))[status]}
  <p><a href="${env.CLIENT_URL}/dashboard">Open your dashboard</a></p>
</div>
`
