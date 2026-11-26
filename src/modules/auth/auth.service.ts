import { createHash, randomInt, timingSafeEqual } from "crypto"

import httpStatus from "http-status"

import { sendMail } from "../../lib/mailer.js"
import { prisma } from "../../lib/prisma.js"
import { redis } from "../../lib/redis.js"
import { AppError } from "../../utils/app-error.js"
import { verifyEmailTemplate } from "./auth.emails.js"
import type { RegisterUserPayload, VerifyEmailPayload } from "./auth.schema.js"
import { authUserSelect, publicUser, toAuthUser } from "./auth.user.js"
import { authUtils } from "./auth.utils.js"

const SIGNUP_TTL_SECONDS = 10 * 60
const MAX_OTP_ATTEMPTS = 5

type PendingSignup = { name: string; email: string; passwordHash: string; otpHash: string }

const signupKey = (email: string) => `signup:${email}`
const attemptsKey = (email: string) => `signup:${email}:attempts`

const hashOtp = (otp: string) => createHash("sha256").update(otp).digest()

const issueSession = (user: Parameters<typeof toAuthUser>[0]) => {
  const authUser = toAuthUser(user)
  const { accessToken, refreshToken } = authUtils.generateTokens(authUser)

  return { user: publicUser(authUser), accessToken, refreshToken }
}

/*
No user row until the email is verified: the signup waits in Redis for 10 minutes. Registering
again replaces it with a new code and resets the attempts
*/
const registerUser = async ({ name, email, password }: RegisterUserPayload) => {
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })

  if (existing) {
    throw new AppError(httpStatus.CONFLICT, "An account with this email already exists")
  }

  const otp = randomInt(0, 1_000_000).toString().padStart(6, "0")
  const pending: PendingSignup = {
    name,
    email,
    passwordHash: await authUtils.hashPassword(password),
    otpHash: hashOtp(otp).toString("hex"),
  }

  await redis.set(signupKey(email), pending, { ex: SIGNUP_TTL_SECONDS })
  await redis.del(attemptsKey(email))

  try {
    await sendMail({
      to: email,
      subject: "Your GridLine verification code",
      html: verifyEmailTemplate(name, otp, SIGNUP_TTL_SECONDS / 60),
    })
  } catch (error) {
    console.error("Sending the verification email failed:", error)
    await redis.del(signupKey(email))
    throw new AppError(httpStatus.BAD_GATEWAY, "Couldn't send the verification email, try again")
  }

  return { email, expiresInSeconds: SIGNUP_TTL_SECONDS }
}

const verifyEmail = async ({ email, otp }: VerifyEmailPayload) => {
  const pending = await redis.get<PendingSignup>(signupKey(email))

  if (!pending) {
    throw new AppError(httpStatus.BAD_REQUEST, "Code expired or not requested, register again")
  }

  // Counted before comparing, and atomically, so parallel guesses can't exceed the limit
  const [attempts] = await redis
    .pipeline()
    .incr(attemptsKey(email))
    .expire(attemptsKey(email), SIGNUP_TTL_SECONDS)
    .exec<[number, number]>()

  if (attempts > MAX_OTP_ATTEMPTS) {
    await redis.del(signupKey(email), attemptsKey(email))
    throw new AppError(httpStatus.BAD_REQUEST, "Too many wrong codes, register again")
  }

  if (!timingSafeEqual(hashOtp(otp), Buffer.from(pending.otpHash, "hex"))) {
    const left = MAX_OTP_ATTEMPTS - attempts

    if (left === 0) {
      await redis.del(signupKey(email), attemptsKey(email))
      throw new AppError(httpStatus.BAD_REQUEST, "Wrong code, register again")
    }

    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Wrong code, ${left} ${left === 1 ? "try" : "tries"} left`,
    )
  }

  // The unique email index turns a parallel verify (or a Google signup in between) into a 409
  const user = await prisma.user.create({
    data: { name: pending.name, email: pending.email, password: pending.passwordHash },
    select: authUserSelect,
  })

  await redis.del(signupKey(email), attemptsKey(email))

  return issueSession(user)
}

export const authService = { registerUser, verifyEmail }
