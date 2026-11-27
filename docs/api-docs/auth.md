# Auth

## Endpoints

`:name` is a path param, `?…` means query params and `{…}` means a request body. Details are in each section.

| Name                                | Endpoint                                 | Access        |
| ----------------------------------- | ---------------------------------------- | ------------- |
| [Register User](#register-user)     | `POST /api/v1/auth/register {…}`         | Public        |
| [Verify Email](#verify-email)       | `POST /api/v1/auth/verify-email {…}`     | Public        |
| [Log In User](#log-in-user)         | `POST /api/v1/auth/login {…}`            | Public        |
| [Google Login](#google-login)       | `POST /api/v1/auth/google {…}`           | Public        |
| [Refresh Tokens](#refresh-tokens)   | `POST /api/v1/auth/refresh-token {…}`    | Public        |
| [Log Out User](#log-out-user)       | `POST /api/v1/auth/logout`               | Authenticated |
| [Forgot Password](#forgot-password) | `POST /api/v1/auth/forgot-password {…}`  | Public        |
| [Reset Password](#reset-password)   | `POST /api/v1/auth/reset-password {…}`   | Public        |
| [Change Password](#change-password) | `PATCH /api/v1/auth/change-password {…}` | Authenticated |

## Tokens

Verify Email, Log In User, Google Login, Refresh Tokens and Change Password return an `accessToken` and a
`refreshToken`. Send the access token on every protected request:

```
Authorization: Bearer <accessToken>
```

Their lifetimes come from `JWT_ACCESS_TOKEN_EXPIRES_IN` and `JWT_REFRESH_TOKEN_EXPIRES_IN`. When the
access token expires, trade the refresh token for a new pair with [Refresh Tokens](#refresh-tokens).

Log Out User, Reset Password and Change Password end **every** session of the user, on every
device. Tokens issued before them are then rejected:

| Status | When                                          | Message                                  |
| ------ | --------------------------------------------- | ---------------------------------------- |
| 401    | No `Authorization: Bearer` header             | `Authentication required`                |
| 401    | Token expired                                 | `Token expired`                          |
| 401    | Token malformed or signed with another secret | `Invalid token`                          |
| 401    | Session ended by logout or a password change  | `Session ended, please log in again`     |
| 401    | Account no longer exists                      | `Account not found, please log in again` |
| 403    | Account is banned                             | `Your account has been banned`           |

## Bot Check

Register User, Log In User and Forgot Password need a Cloudflare Turnstile token in the body as `turnstileToken`.
The frontend gets it from the Turnstile widget. Each token works once and expires after 5 minutes.

The deployed API uses Cloudflare's test secret, which accepts only the dummy token, so from Postman
send:

```json
"turnstileToken": "XXXX.DUMMY.TOKEN.XXXX"
```

| Status | When                                   | Message                                      |
| ------ | -------------------------------------- | -------------------------------------------- |
| 400    | Token missing                          | `Bot check required`                         |
| 400    | Token invalid, expired or already used | `Bot check failed, refresh it and try again` |
| 502    | Cloudflare couldn't be reached         | `Couldn't run the bot check, try again`      |

## Rate Limits

Counted per IP address and email, so one account can't be guessed at from one address without
locking it for everyone else. Google Login and Change Password are counted per IP. Every route also shares a limit of
100 requests a minute per IP.

| Endpoint        | Limit             |
| --------------- | ----------------- |
| Register User   | 5 per hour        |
| Verify Email    | 10 per 10 minutes |
| Log In User     | 10 per 15 minutes |
| Google Login    | 20 per 15 minutes |
| Forgot Password | 5 per hour        |
| Reset Password  | 10 per 10 minutes |
| Change Password | 10 per 15 minutes |

Over the limit returns `429 Too many requests, try again in N seconds` with a `Retry-After` header.

## User Object

Returned by every auth endpoint that responds with a user. The password is never included.

- `customer` is the user's electricity connection, or `null` until they create one with
  [Create My Customer Profile](customer.md#create-my-customer-profile). `meterNumber` may be `null`.
- `employee` is the user's active job at the company, or `null` for a user who isn't an employee.
  `zoneId` is `null` for an admin, who covers every zone.

A user can have both: an employee who also gets electricity from GridLine.

```json
{
  "id": "25568d41-6919-4b36-882e-e0b180c8cd49",
  "name": "Customer 01",
  "email": "customer01@example.com",
  "customer": {
    "id": "abeeaaa7-07cf-4938-8b8a-4aa60f998369",
    "areaId": "e12c3955-a007-460d-8934-7b623ed1a1f7",
    "meterNumber": "100000000001"
  },
  "employee": null
}
```

---

## Register User

`POST /api/v1/auth/register` · Public

Emails a 6-digit verification code. No account exists until [Verify Email](#verify-email) succeeds.
The signup is kept for 10 minutes. Registering again with the same email sends a new code and
replaces the old one.

**Body**

| Field            | Type   | Rules                                   |
| ---------------- | ------ | --------------------------------------- |
| `name`           | string | Trimmed, 2 to 100 characters            |
| `email`          | string | Valid email, trimmed and lowercased     |
| `password`       | string | At least 8 characters, at most 72 bytes |
| `turnstileToken` | string | See [Bot Check](#bot-check)             |

**Example**

```json
{
  "name": "New Customer",
  "email": "newcustomer@example.com",
  "password": "1a2s3d4f",
  "turnstileToken": "XXXX.DUMMY.TOKEN.XXXX"
}
```

**Responses**

| Status | When                     | Message                                           |
| ------ | ------------------------ | ------------------------------------------------- |
| 200    | Success                  | `Verification code sent to your email`            |
| 400    | Validation failed        | `Validation of body failed`                       |
| 409    | Email already registered | `An account with this email already exists`       |
| 502    | Email couldn't be sent   | `Couldn't send the verification email, try again` |

---

## Verify Email

`POST /api/v1/auth/verify-email` · Public

Checks the code from [Register User](#register-user), creates the account and signs the user in.
Five wrong codes cancel the signup.

**Body**

| Field   | Type   | Rules                               |
| ------- | ------ | ----------------------------------- |
| `email` | string | Valid email, trimmed and lowercased |
| `otp`   | string | Exactly 6 digits                    |

**Example**

```json
{
  "email": "newcustomer@example.com",
  "otp": "424242"
}
```

**Responses**

| Status | When                                 | Message                                         |
| ------ | ------------------------------------ | ----------------------------------------------- |
| 201    | Success                              | `Email verified, account created`               |
| 400    | Validation failed                    | `Validation of body failed`                     |
| 400    | No signup for this email, or expired | `Code expired or not requested, register again` |
| 400    | Wrong code                           | `Wrong code, 4 tries left` (counts down)        |
| 400    | Fifth wrong code                     | `Wrong code, register again`                    |
| 409    | Email registered in the meantime     | `email already exists`                          |

---

## Log In User

`POST /api/v1/auth/login` · Public

Signs in with email and password.

**Body**

| Field            | Type   | Rules                               |
| ---------------- | ------ | ----------------------------------- |
| `email`          | string | Valid email, trimmed and lowercased |
| `password`       | string | Required                            |
| `turnstileToken` | string | See [Bot Check](#bot-check)         |

**Example**

```json
{
  "email": "technician01@example.com",
  "password": "1a2s3d4f",
  "turnstileToken": "XXXX.DUMMY.TOKEN.XXXX"
}
```

**Responses**

| Status | When                    | Message                        |
| ------ | ----------------------- | ------------------------------ |
| 200    | Success                 | `Logged in successfully`       |
| 400    | Validation failed       | `Validation of body failed`    |
| 401    | Wrong email or password | `Invalid email or password`    |
| 403    | Account is banned       | `Your account has been banned` |

---

## Google Login

`POST /api/v1/auth/google` · Public

Signs in with the one-time code from Google's sign-in popup on the frontend (the auth-code flow).
The API trades the code with Google for the user's ID token and checks it. One account per email:

- A user who has signed in with this Google account before is signed in.
- Otherwise, if a user already has the email, Google is linked to that account and they can use
  either way to sign in.
- Otherwise a new account is created, without a password. Forgot Password sets one.

Only emails Google has verified are accepted. No bot check: Google's sign-in replaces it.

**Body**

| Field  | Type   | Rules                                               |
| ------ | ------ | --------------------------------------------------- |
| `code` | string | The `code` from Google's popup; works once, briefly |

**Example**

```json
{
  "code": "<code from Google's popup>"
}
```

**Responses**

| Status | When                                           | Message                                          |
| ------ | ---------------------------------------------- | ------------------------------------------------ |
| 200    | Success                                        | `Logged in with Google successfully`             |
| 400    | Validation failed                              | `Validation of body failed`                      |
| 400    | Google hasn't verified the email               | `Your Google email isn't verified`               |
| 401    | Code invalid, used or expired                  | `Google sign-in failed or expired, try again`    |
| 403    | Account is banned                              | `Your account has been banned`                   |
| 409    | Email already linked to another Google account | `This email is linked to another Google account` |

---

## Refresh Tokens

`POST /api/v1/auth/refresh-token` · Public

Trades a refresh token for a new access and refresh token. The old refresh token keeps working until
it expires or the session ends.

**Body**

| Field          | Type   | Rules    |
| -------------- | ------ | -------- |
| `refreshToken` | string | Required |

**Example**

```json
{
  "refreshToken": "<refreshToken>"
}
```

**Responses**

| Status | When              | Message                         |
| ------ | ----------------- | ------------------------------- |
| 200    | Success           | `Tokens refreshed successfully` |
| 400    | Validation failed | `Validation of body failed`     |
| 401    | Token rejected    | See [Tokens](#tokens)           |
| 403    | Account is banned | `Your account has been banned`  |

---

## Log Out User

`POST /api/v1/auth/logout` · Authenticated

Ends every session of the user, on every device. No body.

**Responses**

| Status | When           | Message                   |
| ------ | -------------- | ------------------------- |
| 200    | Success        | `Logged out successfully` |
| 401    | Token rejected | See [Tokens](#tokens)     |

---

## Forgot Password

`POST /api/v1/auth/forgot-password` · Public

Emails a 6-digit code for [Reset Password](#reset-password), valid for 10 minutes. Asking again
sends a new code and replaces the old one. The reply is the same whether or not an account uses the
email, and banned accounts get no code. A user who signed up with Google sets their first password
this way.

**Body**

| Field            | Type   | Rules                               |
| ---------------- | ------ | ----------------------------------- |
| `email`          | string | Valid email, trimmed and lowercased |
| `turnstileToken` | string | See [Bot Check](#bot-check)         |

**Example**

```json
{
  "email": "technician01@example.com",
  "turnstileToken": "XXXX.DUMMY.TOKEN.XXXX"
}
```

**Responses**

| Status | When                   | Message                                                      |
| ------ | ---------------------- | ------------------------------------------------------------ |
| 200    | Always, if valid       | `If an account uses this email, a reset code was sent to it` |
| 400    | Validation failed      | `Validation of body failed`                                  |
| 502    | Email couldn't be sent | `Couldn't send the reset email, try again`                   |

---

## Reset Password

`POST /api/v1/auth/reset-password` · Public

Checks the code from [Forgot Password](#forgot-password) and sets the new password. Ends every
session, so log in again afterwards. Five wrong codes cancel the code.

**Body**

| Field         | Type   | Rules                                   |
| ------------- | ------ | --------------------------------------- |
| `email`       | string | Valid email, trimmed and lowercased     |
| `otp`         | string | Exactly 6 digits                        |
| `newPassword` | string | At least 8 characters, at most 72 bytes |

**Example**

```json
{
  "email": "technician01@example.com",
  "otp": "424242",
  "newPassword": "1a2s3d4f"
}
```

**Responses**

| Status | When                               | Message                                            |
| ------ | ---------------------------------- | -------------------------------------------------- |
| 200    | Success                            | `Password reset, log in with the new password`     |
| 400    | Validation failed                  | `Validation of body failed`                        |
| 400    | No code for this email, or expired | `Code expired or not requested, ask for a new one` |
| 400    | Wrong code                         | `Wrong code, 4 tries left` (counts down)           |
| 400    | Fifth wrong code                   | `Wrong code, ask for a new one`                    |

---

## Change Password

`PATCH /api/v1/auth/change-password` · Authenticated

Changes the password of a user who has one. Ends every other session and returns new tokens for
this one.

**Body**

| Field             | Type   | Rules                                                        |
| ----------------- | ------ | ------------------------------------------------------------ |
| `currentPassword` | string | Required                                                     |
| `newPassword`     | string | At least 8 characters, at most 72 bytes, not the current one |

**Example**

```json
{
  "currentPassword": "1a2s3d4f",
  "newPassword": "4f3d2s1a"
}
```

**Responses**

| Status | When                             | Message                                                          |
| ------ | -------------------------------- | ---------------------------------------------------------------- |
| 200    | Success                          | `Password changed successfully`                                  |
| 400    | Validation failed                | `Validation of body failed`                                      |
| 400    | Account has no password (Google) | `Your account has no password yet, set one with forgot password` |
| 400    | Current password is wrong        | `Current password is incorrect`                                  |
| 401    | Token rejected                   | See [Tokens](#tokens)                                            |
