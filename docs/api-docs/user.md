# User

The signed-in user's endpoints return the [user object](auth.md#user-object); the admin ones return
the [admin user object](#admin-user-object). The password is never included.

## Endpoints

`:name` is a path param, `?…` means query params and `{…}` means a request body. Details are in each section.

| Name                                    | Endpoint                            | Access        |
| --------------------------------------- | ----------------------------------- | ------------- |
| [Get Me](#get-me)                       | `GET /api/v1/users/me`              | Authenticated |
| [Update Me](#update-me)                 | `PATCH /api/v1/users/me`            | Authenticated |
| [Get All Users](#get-all-users)         | `GET /api/v1/admin/users?…`         | Admin         |
| [Ban Or Unban User](#ban-or-unban-user) | `PATCH /api/v1/admin/users/:id/ban` | Admin         |

---

## Get Me

`GET /api/v1/users/me` · Authenticated

Returns the signed-in user.

**Responses**

| Status | When                                | Message                                  |
| ------ | ----------------------------------- | ---------------------------------------- |
| 200    | Success                             | `Profile fetched successfully`           |
| 401    | No `Authorization: Bearer` token    | `Authentication required`                |
| 401    | Token malformed or signed wrongly   | `Invalid token`                          |
| 401    | Token expired                       | `Token expired`                          |
| 401    | User no longer exists               | `Account not found, please log in again` |
| 401    | Token issued before logout or reset | `Session ended, please log in again`     |
| 403    | Account is banned                   | `Your account has been banned`           |

---

## Update Me

`PATCH /api/v1/users/me` · Authenticated

Changes the signed-in user's name and returns the updated user. Email and password have their own
flows in [Auth](auth.md).

**Body**

| Field  | Type   | Rules                                              |
| ------ | ------ | -------------------------------------------------- |
| `name` | string | 2–100 characters, trimmed; no other fields allowed |

**Example**

```json
{
  "name": "Customer 01"
}
```

**Responses**

| Status | When              | Message                        |
| ------ | ----------------- | ------------------------------ |
| 200    | Success           | `Profile updated successfully` |
| 400    | Validation failed | `Validation of body failed`    |
| 401    | Token rejected    | See [Get Me](#get-me)          |
| 403    | Account is banned | `Your account has been banned` |

---

## Admin User Object

What the admin endpoints return for each user: the [user object](auth.md#user-object) plus
`isBanned` and `createdAt`.

```json
{
  "id": "534a7de5-26d8-4ed8-9662-f3efae877c30",
  "name": "Customer 02",
  "email": "customer02@example.com",
  "isBanned": false,
  "createdAt": "2026-11-27T07:33:03.266Z",
  "customer": {
    "id": "1ee9ed18-1ddd-4697-b480-62cbb6db715a",
    "areaId": "67217b6d-bd86-4395-93f3-293aa1e7bc8e",
    "meterNumber": "100000000002"
  },
  "employee": null
}
```

---

## Get All Users

`GET /api/v1/admin/users?…` · Admin

Lists users, one page at a time. `meta` holds `page`, `limit` and `total` (users matching the
filters).

**Query**

| Param       | Rules                                                                                      | Default     |
| ----------- | ------------------------------------------------------------------------------------------ | ----------- |
| `page`      | Integer ≥ 1                                                                                | `1`         |
| `limit`     | Integer 1–50                                                                               | `10`        |
| `search`    | Matches name or email, ignoring case; 1–100 characters                                     | —           |
| `role`      | `CUSTOMER` (has a customer profile), or `ADMIN`, `ZONE_MANAGER`, `TECHNICIAN` (active job) | —           |
| `isBanned`  | `true` or `false`                                                                          | —           |
| `sortBy`    | `name`, `email` or `createdAt`                                                             | `createdAt` |
| `sortOrder` | `asc` or `desc`                                                                            | `desc`      |

**Example**

`GET /api/v1/admin/users?role=CUSTOMER&search=customer0&sortBy=name&sortOrder=asc&page=1&limit=10`

**Response** (`data` trimmed to one user)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Users fetched successfully",
  "data": [
    {
      "id": "25568d41-6919-4b36-882e-e0b180c8cd49",
      "name": "Customer 01",
      "email": "customer01@example.com",
      "isBanned": false,
      "createdAt": "2026-11-27T07:33:03.104Z",
      "customer": {
        "id": "abeeaaa7-07cf-4938-8b8a-4aa60f998369",
        "areaId": "e12c3955-a007-460d-8934-7b623ed1a1f7",
        "meterNumber": "100000000001"
      },
      "employee": null
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 7 }
}
```

**Responses**

| Status | When              | Message                                |
| ------ | ----------------- | -------------------------------------- |
| 200    | Success           | `Users fetched successfully`           |
| 400    | Validation failed | `Validation of query failed`           |
| 401    | Token rejected    | See [Get Me](#get-me)                  |
| 403    | Not an admin      | `You don't have permission to do this` |

---

## Ban Or Unban User

`PATCH /api/v1/admin/users/:id/ban` · Admin

Bans or unbans a user and returns them as an [admin user object](#admin-user-object). A banned user
can't log in, and banning ends all their sessions, so unbanning doesn't bring old ones back.
Each change is saved to the audit log with the admin who made it.

**Body**

| Field      | Type    | Rules    |
| ---------- | ------- | -------- |
| `isBanned` | boolean | Required |

**Example**

```json
{
  "isBanned": true
}
```

**Responses**

| Status | When                           | Message                                                     |
| ------ | ------------------------------ | ----------------------------------------------------------- |
| 200    | Success                        | `User banned successfully` / `User unbanned successfully`   |
| 400    | Validation failed              | `Validation of params failed` / `Validation of body failed` |
| 400    | Admin tried to ban themselves  | `You can't ban yourself`                                    |
| 401    | Token rejected                 | See [Get Me](#get-me)                                       |
| 403    | Not an admin                   | `You don't have permission to do this`                      |
| 403    | Target is an admin             | `Admins can't be banned`                                    |
| 404    | No user with this id           | `User not found`                                            |
| 409    | Already in the requested state | `User is already banned` / `User isn't banned`              |
