# Auth

## Endpoints

`:name` is a path param, `?…` means query params and `{…}` means a request body. Details are in each section.

| Name                            | Endpoint                             | Access |
| ------------------------------- | ------------------------------------ | ------ |
| [Register User](#register-user) | `POST /api/v1/auth/register {…}`     | Public |
| [Verify Email](#verify-email)   | `POST /api/v1/auth/verify-email {…}` | Public |
| [Log In User](#log-in-user)     | `POST /api/v1/auth/login {…}`        | Public |

## Tokens

Verify Email and Log In User return an `accessToken` and a `refreshToken`. Send the access token
on every protected request:

```
Authorization: Bearer <accessToken>
```

Their lifetimes come from `JWT_ACCESS_TOKEN_EXPIRES_IN` and `JWT_REFRESH_TOKEN_EXPIRES_IN`.

## User Object

Returned by every auth endpoint that responds with a user. The password is never included.
`employee` is the user's active job at the company, or `null` for a user who isn't an employee.
`zoneId` is `null` for an admin, who covers every zone.

```json
{
  "id": "9600f9bc-8c3e-43f5-8a46-782596d82cd7",
  "name": "Technician 01",
  "email": "technician01@example.com",
  "employee": {
    "id": "6b3c1eb3-3024-4d66-9f05-3a6422631331",
    "role": "TECHNICIAN",
    "zoneId": "5ab7b985-3aab-45a4-9eef-e649e0041ec1"
  }
}
```

---

## Register User

`POST /api/v1/auth/register` · Public

Emails a 6-digit verification code. No account exists until [Verify Email](#verify-email) succeeds.
The signup is kept for 10 minutes. Registering again with the same email sends a new code and
replaces the old one.

**Body**

| Field      | Type   | Rules                                   |
| ---------- | ------ | --------------------------------------- |
| `name`     | string | Trimmed, 2 to 100 characters            |
| `email`    | string | Valid email, trimmed and lowercased     |
| `password` | string | At least 8 characters, at most 72 bytes |

**Example**

```json
{
  "name": "New Customer",
  "email": "newcustomer@example.com",
  "password": "1a2s3d4f"
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

| Field      | Type   | Rules                               |
| ---------- | ------ | ----------------------------------- |
| `email`    | string | Valid email, trimmed and lowercased |
| `password` | string | Required                            |

**Example**

```json
{
  "email": "technician01@example.com",
  "password": "1a2s3d4f"
}
```

**Responses**

| Status | When                    | Message                        |
| ------ | ----------------------- | ------------------------------ |
| 200    | Success                 | `Logged in successfully`       |
| 400    | Validation failed       | `Validation of body failed`    |
| 401    | Wrong email or password | `Invalid email or password`    |
| 403    | Account is banned       | `Your account has been banned` |
