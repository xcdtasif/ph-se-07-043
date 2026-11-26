import { createHash, randomInt, timingSafeEqual } from "crypto"

import httpStatus from "http-status"

import { verifyGoogleIdToken } from "../../lib/google.js"
import { sendMail } from "../../lib/mailer.js"
import { prisma } from "../../lib/prisma.js"
import { redis } from "../../lib/redis.js"
import { AppError } from "../../utils/app-error.js"
import { resetPasswordTemplate, verifyEmailTemplate } from "./auth.emails.js"
import type {
  ChangePasswordPayload,
  ForgotPasswordPayload,
  GoogleLoginPayload,
  LoginUserPayload,
  RefreshTokenPayload,
  RegisterUserPayload,
  ResetPasswordPayload,
  VerifyEmailPayload,
} from "./auth.schema.js"
import { authUserSelect, findSessionUser, publicUser, toAuthUser } from "./auth.user.js"
import { authUtils } from "./auth.utils.js"

const OTP_TTL_SECONDS = 10 * 60
const MAX_OTP_ATTEMPTS = 5

type PendingSignup = { name: string; email: string; passwordHash: string; otpHash: string }
type PendingReset = { otpHash: string }

const signupKey = (email: string) => `signup:${email}`
const resetKey = (email: string) => `reset:${email}`
const attemptsKey = (key: string) => `${key}:attempts`

const hashOtp = (otp: string) => createHash("sha256").update(otp).digest()

const createOtp = () => {
  const otp = randomInt(0, 1_000_000).toString().padStart(6, "0")

  return { otp, otpHash: hashOtp(otp).toString("hex") }
}

/*
Saves the pending code for 10 minutes (replacing an older one and its attempts), then emails it.
The code is only useful if the email arrives, so a failed send removes it again
*/
const saveAndSendCode = async (
  key: string,
  pending: PendingSignup | PendingReset,
  mail: { to: string; subject: string; html: string },
  failMessage: string,
) => {
  await redis.set(key, pending, { ex: OTP_TTL_SECONDS })
  await redis.del(attemptsKey(key))

  try {
    await sendMail(mail)
  } catch (error) {
    console.error(`Sending "${mail.subject}" failed:`, error)
    await redis.del(key)
    throw new AppError(httpStatus.BAD_GATEWAY, failMessage)
  }
}

/*
Throws unless `otp` matches. Counted before comparing, and atomically, so parallel guesses can't
exceed the limit. The last wrong try deletes the pending code; `restart` says what to do next
*/
const checkOtp = async (key: string, otp: string, otpHash: string, restart: string) => {
  const [attempts] = await redis
    .pipeline()
    .incr(attemptsKey(key))
    .expire(attemptsKey(key), OTP_TTL_SECONDS)
    .exec<[number, number]>()

  if (attempts > MAX_OTP_ATTEMPTS) {
    await redis.del(key, attemptsKey(key))
    throw new AppError(httpStatus.BAD_REQUEST, `Too many wrong codes, ${restart}`)
  }

  if (!timingSafeEqual(hashOtp(otp), Buffer.from(otpHash, "hex"))) {
    const left = MAX_OTP_ATTEMPTS - attempts

    if (left === 0) {
      await redis.del(key, attemptsKey(key))
      throw new AppError(httpStatus.BAD_REQUEST, `Wrong code, ${restart}`)
    }

    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Wrong code, ${left} ${left === 1 ? "try" : "tries"} left`,
    )
  }
}

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

  const { otp, otpHash } = createOtp()
  const pending: PendingSignup = {
    name,
    email,
    passwordHash: await authUtils.hashPassword(password),
    otpHash,
  }

  await saveAndSendCode(
    signupKey(email),
    pending,
    {
      to: email,
      subject: "Your GridLine verification code",
      html: verifyEmailTemplate(name, otp, OTP_TTL_SECONDS / 60),
    },
    "Couldn't send the verification email, try again",
  )

  return { email, expiresInSeconds: OTP_TTL_SECONDS }
}

const verifyEmail = async ({ email, otp }: VerifyEmailPayload) => {
  const pending = await redis.get<PendingSignup>(signupKey(email))

  if (!pending) {
    throw new AppError(httpStatus.BAD_REQUEST, "Code expired or not requested, register again")
  }

  await checkOtp(signupKey(email), otp, pending.otpHash, "register again")

  // The unique email index turns a parallel verify (or a Google signup in between) into a 409
  const user = await prisma.user.create({
    data: { name: pending.name, email: pending.email, password: pending.passwordHash },
    select: authUserSelect,
  })

  await redis.del(signupKey(email), attemptsKey(signupKey(email)))

  return issueSession(user)
}

const loginUser = async ({ email, password }: LoginUserPayload) => {
  const found = await prisma.user.findUnique({
    where: { email },
    select: { ...authUserSelect, password: true },
  })

  const isPasswordValid = await authUtils.comparePassword(
    password,
    found?.password ?? authUtils.DUMMY_HASH,
  )

  // Google-only users have no password yet and get the same answer as a wrong password
  if (!found?.password || !isPasswordValid) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid email or password")
  }

  const { password: _password, ...user } = found

  if (user.isBanned) {
    throw new AppError(httpStatus.FORBIDDEN, "Your account has been banned")
  }

  return issueSession(user)
}

/*
One user per email. Signs in the user with this Google account, or links Google to the user with
the same email, or creates a user without a password. An email is only trusted once Google has
verified it, so nobody can take over an account through an unverified Google address
*/
const googleLogin = async ({ idToken }: GoogleLoginPayload) => {
  const profile = await verifyGoogleIdToken(idToken).catch((error: unknown) => {
    console.error("Google ID token check failed:", error instanceof Error ? error.message : error)
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid or expired Google token")
  })

  if (!profile?.email || !profile.email_verified) {
    throw new AppError(httpStatus.BAD_REQUEST, "Your Google email isn't verified")
  }

  const googleId = profile.sub
  const email = profile.email.toLowerCase()

  let user = await prisma.user.findUnique({ where: { googleId }, select: authUserSelect })

  if (!user) {
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, googleId: true },
    })

    if (existing?.googleId) {
      throw new AppError(httpStatus.CONFLICT, "This email is linked to another Google account")
    }

    // The unique email and googleId indexes turn a parallel first login into a 409
    user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: { googleId },
          select: authUserSelect,
        })
      : await prisma.user.create({
          data: {
            name: (profile.name?.trim() || email.split("@")[0]!).slice(0, 100),
            email,
            googleId,
          },
          select: authUserSelect,
        })
  }

  if (user.isBanned) {
    throw new AppError(httpStatus.FORBIDDEN, "Your account has been banned")
  }

  return issueSession(user)
}

// Refresh tokens aren't rotated: each stays valid until it expires or the user logs out
const refreshTokens = async ({ refreshToken }: RefreshTokenPayload) => {
  const user = await findSessionUser(authUtils.verifyRefreshToken(refreshToken))

  return issueSession(user)
}

// Bumping tokenVersion ends every session of the user, on every device
const logoutUser = async (userId: string) => {
  await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
    select: { id: true },
  })
}

/*
The reply is the same whether or not the account exists, and banned users get no code. Google-only
users have no password yet and set their first one here
*/
const forgotPassword = async ({ email }: ForgotPasswordPayload) => {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { name: true, isBanned: true },
  })

  if (user && !user.isBanned) {
    const { otp, otpHash } = createOtp()

    await saveAndSendCode(
      resetKey(email),
      { otpHash },
      {
        to: email,
        subject: "Your GridLine password reset code",
        html: resetPasswordTemplate(user.name, otp, OTP_TTL_SECONDS / 60),
      },
      "Couldn't send the reset email, try again",
    )
  }

  return { email, expiresInSeconds: OTP_TTL_SECONDS }
}

// Ends every session too, in case someone else knew the old password
const resetPassword = async ({ email, otp, newPassword }: ResetPasswordPayload) => {
  const pending = await redis.get<PendingReset>(resetKey(email))

  if (!pending) {
    throw new AppError(httpStatus.BAD_REQUEST, "Code expired or not requested, ask for a new one")
  }

  await checkOtp(resetKey(email), otp, pending.otpHash, "ask for a new one")

  await prisma.user.update({
    where: { email },
    data: { password: await authUtils.hashPassword(newPassword), tokenVersion: { increment: 1 } },
    select: { id: true },
  })

  await redis.del(resetKey(email), attemptsKey(resetKey(email)))
}

// Ends the user's other sessions and returns a new one for this device
const changePassword = async (
  userId: string,
  { currentPassword, newPassword }: ChangePasswordPayload,
) => {
  const found = await prisma.user.findUnique({ where: { id: userId }, select: { password: true } })

  if (!found?.password) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Your account has no password yet, set one with forgot password",
    )
  }

  if (!(await authUtils.comparePassword(currentPassword, found.password))) {
    throw new AppError(httpStatus.BAD_REQUEST, "Current password is incorrect", [
      { path: "currentPassword", message: "Current password is incorrect" },
    ])
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { password: await authUtils.hashPassword(newPassword), tokenVersion: { increment: 1 } },
    select: authUserSelect,
  })

  return issueSession(user)
}

export const authService = {
  registerUser,
  verifyEmail,
  loginUser,
  googleLogin,
  refreshTokens,
  logoutUser,
  forgotPassword,
  resetPassword,
  changePassword,
}
