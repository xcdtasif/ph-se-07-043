# Postman Guide

The API is documented in Postman, with a request for every endpoint grouped by module and then by
who may call it (`Public`, `Authenticated`, and the roles as they are added). For endpoint rules
and responses see [API Docs](api-docs).

## Environment

Select an environment before sending a request. Every request starts with `{{baseUrl}}`, so the
environment decides which server the request goes to.

| Environment       | `baseUrl`                                |
| ----------------- | ---------------------------------------- |
| ph-se-07-043-prod | `https://ph-se-07-043.vercel.app/api/v1` |
| ph-se-07-043-dev  | `http://localhost:5000/api/v1`           |

Dev assumes `PORT=5000` in `.env.local`.

## Variables

| Variable       | Scope       | Used by                 | Value                                      |
| -------------- | ----------- | ----------------------- | ------------------------------------------ |
| `baseUrl`      | Environment | Every request           | The API root of the selected environment   |
| `accessToken`  | Collection  | Every protected request | Saved by every request that returns tokens |
| `refreshToken` | Collection  | **Refresh Tokens**      | Saved by every request that returns tokens |

## Authentication

The API takes a Bearer token. The collection sends `Authorization: Bearer {{accessToken}}` on every
request, except the `Public` folders, which send none.

1. Send **Auth / Public / Log In User** with the account for the role you want to test. Its test
   script saves `accessToken` and `refreshToken` to the collection variables.
2. Send the requests for that role. The token is attached automatically.
3. To switch roles, log in again as the other user. A new login replaces the tokens.

Log In User, Verify Email, Refresh Tokens and Change Password all save the tokens they return.

`401 Token expired` means the access token ran out: send **Auth / Public / Refresh Tokens** to get
a new pair. Any other `401` means the token is missing, or was issued before a logout or password
change. Log in again.

### Bot Check

**Register User**, **Log In User** and **Forgot Password** send `"turnstileToken": "XXXX.DUMMY.TOKEN.XXXX"`. That's
Cloudflare's dummy token, which the API accepts while `TURNSTILE_SECRET_KEY` is Cloudflare's test
secret (`1x0000000000000000000000000000000AA`), as it is on the deployed API. With a real secret,
only a token from the frontend's widget passes.

### Sample Accounts

`pnpm db:seed` creates these. All but the admin use the password `1a2s3d4f`.

| Account                     | Role                                |
| --------------------------- | ----------------------------------- |
| `customer01@example.com`    | Customer (`customer05` is banned)   |
| `technician01@example.com`  | Technician, Mirpur zone             |
| `zonemanager01@example.com` | Zone Manager, Mirpur zone           |
| `ADMIN_EMAIL`               | Admin, password in `ADMIN_PASSWORD` |

Edit the email and password in the **Log In User** body to switch accounts.

## Signing Up

1. Send **Register User** with an email you can read. It mails a 6-digit code.
2. Send **Verify Email** with that email and code within 10 minutes. It creates the account and
   saves the tokens like **Log In User**.

## Google Login

**Google Login** needs an ID token that only Google's sign-in button can produce, and it expires
after an hour. Sign in with Google on the frontend, copy the `credential` it receives (or the
`idToken` the frontend sends) from the browser's network tab, and paste it into the body.

## Resetting A Password

1. Send **Forgot Password** with an email you can read. It mails a 6-digit code.
2. Send **Reset Password** with that email, code and a new password within 10 minutes. It signs out
   every session, so log in again.

The seeded accounts use `@example.com` addresses, which receive no mail. To test on them, use
**Change Password** while logged in instead, and change it back to `1a2s3d4f` afterwards.

## Example IDs And Bodies

The UUIDs in the URLs, bodies and saved examples are from one database, so they won't match yours.
Replace them with IDs from your own responses.
