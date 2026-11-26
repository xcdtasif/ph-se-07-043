export const verifyEmailTemplate = (name: string, otp: string, minutes: number) => `
<div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; color: #1f2937">
  <h2 style="margin-bottom: 4px">Verify your email</h2>
  <p>Hi ${escapeHtml(name)}, use this code to finish signing up to GridLine:</p>
  <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 24px 0">${otp}</p>
  <p>The code expires in ${minutes} minutes. If you didn't sign up, ignore this email.</p>
</div>
`

// The name is user input and ends up in HTML
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char,
  )
