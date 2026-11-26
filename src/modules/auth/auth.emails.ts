// A one-time code email: both signup and password reset send one
const codeEmail = (heading: string, lead: string, otp: string, minutes: number, ignore: string) => `
<div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; color: #1f2937">
  <h2 style="margin-bottom: 4px">${heading}</h2>
  <p>${lead}</p>
  <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 24px 0">${otp}</p>
  <p>The code expires in ${minutes} minutes. ${ignore}</p>
</div>
`

export const verifyEmailTemplate = (name: string, otp: string, minutes: number) =>
  codeEmail(
    "Verify your email",
    `Hi ${escapeHtml(name)}, use this code to finish signing up to GridLine:`,
    otp,
    minutes,
    "If you didn't sign up, ignore this email.",
  )

export const resetPasswordTemplate = (name: string, otp: string, minutes: number) =>
  codeEmail(
    "Reset your password",
    `Hi ${escapeHtml(name)}, use this code to set a new GridLine password:`,
    otp,
    minutes,
    "If you didn't ask for it, ignore this email and your password stays the same.",
  )

// The name is user input and ends up in HTML
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char,
  )
