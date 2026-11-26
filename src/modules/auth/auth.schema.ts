import z from "zod"

const emailSchema = z.string().trim().toLowerCase().pipe(z.email())

// bcrypt only reads the first 72 bytes, so longer passwords would be silently cut
const passwordSchema = z
  .string()
  .min(8)
  .refine((value) => new TextEncoder().encode(value).length <= 72, {
    error: "Password must be at most 72 bytes",
  })

export const registerUserSchema = z.strictObject({
  name: z.string().trim().min(2).max(100),
  email: emailSchema,
  password: passwordSchema,
})

export type RegisterUserPayload = z.output<typeof registerUserSchema>

const otpSchema = z.string().regex(/^\d{6}$/, { error: "OTP must be 6 digits" })

export const verifyEmailSchema = z.strictObject({
  email: emailSchema,
  otp: otpSchema,
})

export type VerifyEmailPayload = z.output<typeof verifyEmailSchema>

// No length rules on an existing password: a wrong one should fail as "invalid", not as validation
const currentPasswordSchema = z.string().min(1).max(1000)

export const loginUserSchema = z.strictObject({
  email: emailSchema,
  password: currentPasswordSchema,
})

export type LoginUserPayload = z.output<typeof loginUserSchema>

export const refreshTokenSchema = z.strictObject({
  refreshToken: z.string().min(1),
})

export type RefreshTokenPayload = z.output<typeof refreshTokenSchema>

export const forgotPasswordSchema = z.strictObject({
  email: emailSchema,
})

export type ForgotPasswordPayload = z.output<typeof forgotPasswordSchema>

export const resetPasswordSchema = z.strictObject({
  email: emailSchema,
  otp: otpSchema,
  newPassword: passwordSchema,
})

export type ResetPasswordPayload = z.output<typeof resetPasswordSchema>

export const changePasswordSchema = z
  .strictObject({
    currentPassword: currentPasswordSchema,
    newPassword: passwordSchema,
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    path: ["newPassword"],
    error: "New password must be different from the current one",
  })

export type ChangePasswordPayload = z.output<typeof changePasswordSchema>
