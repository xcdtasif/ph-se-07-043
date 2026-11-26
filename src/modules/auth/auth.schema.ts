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

export const verifyEmailSchema = z.strictObject({
  email: emailSchema,
  otp: z.string().regex(/^\d{6}$/, { error: "OTP must be 6 digits" }),
})

export type VerifyEmailPayload = z.output<typeof verifyEmailSchema>

// No length rules here: a wrong password should fail as "invalid credentials", not as validation
export const loginUserSchema = z.strictObject({
  email: emailSchema,
  password: z.string().min(1).max(1000),
})

export type LoginUserPayload = z.output<typeof loginUserSchema>
