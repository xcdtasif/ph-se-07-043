# User

Every endpoint that responds with a user returns the [user object](auth.md#user-object). The password
is never included.

## Endpoints

`:name` is a path param, `?…` means query params and `{…}` means a request body. Details are in each section.

| Name              | Endpoint               | Access        |
| ----------------- | ---------------------- | ------------- |
| [Get Me](#get-me) | `GET /api/v1/users/me` | Authenticated |

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
