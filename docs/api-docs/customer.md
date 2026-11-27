# Customer

A customer profile ties a user to the area their electricity comes from, so they can follow its
load shedding schedule and report outages. Users without one (new Google users, employees) create
it here. The profile appears as `customer` in the [user object](auth.md#user-object).

## Endpoints

`:name` is a path param, `?…` means query params and `{…}` means a request body. Details are in each section.

| Name                                                      | Endpoint                     | Access        |
| --------------------------------------------------------- | ---------------------------- | ------------- |
| [Create My Customer Profile](#create-my-customer-profile) | `POST /api/v1/customers/me`  | Authenticated |
| [Update My Customer Profile](#update-my-customer-profile) | `PATCH /api/v1/customers/me` | Authenticated |

---

## Create My Customer Profile

`POST /api/v1/customers/me` · Authenticated

Creates the signed-in user's customer profile and returns it.

**Body**

| Field         | Type   | Rules                                                                 |
| ------------- | ------ | --------------------------------------------------------------------- |
| `areaId`      | string | Required; UUID of an area from [Get All Areas](grid.md#get-all-areas) |
| `meterNumber` | string | Optional; exactly 12 digits, not used by another customer             |

**Example**

```json
{
  "areaId": "e12c3955-a007-460d-8934-7b623ed1a1f7",
  "meterNumber": "100000000008"
}
```

**Response data**

```json
{
  "id": "7dffab24-dd2b-46bc-bfc6-f4a8ebdb9286",
  "areaId": "e12c3955-a007-460d-8934-7b623ed1a1f7",
  "meterNumber": "100000000008"
}
```

**Responses**

| Status | When                                 | Message                                   |
| ------ | ------------------------------------ | ----------------------------------------- |
| 201    | Success                              | `Customer profile created successfully`   |
| 400    | Validation failed                    | `Validation of body failed`               |
| 401    | Token rejected                       | See [Tokens](auth.md#tokens)              |
| 403    | Account is banned                    | `Your account has been banned`            |
| 404    | Area doesn't exist or is deleted     | `Area not found`                          |
| 409    | User already has a profile           | `You already have a customer profile`     |
| 409    | Meter number belongs to someone else | `This meter number is already registered` |

---

## Update My Customer Profile

`PATCH /api/v1/customers/me` · Authenticated

Moves the signed-in user's profile to another area, changes the meter number, or both. Returns
the updated profile, shaped like [Create My Customer Profile](#create-my-customer-profile)'s.

**Body**

At least one field.

| Field         | Type           | Rules                                                             |
| ------------- | -------------- | ----------------------------------------------------------------- |
| `areaId`      | string         | UUID of an area that isn't deleted                                |
| `meterNumber` | string or null | Exactly 12 digits, not used by another customer; `null` clears it |

**Example**

```json
{
  "meterNumber": null
}
```

**Responses**

| Status | When                                 | Message                                   |
| ------ | ------------------------------------ | ----------------------------------------- |
| 200    | Success                              | `Customer profile updated successfully`   |
| 400    | Validation failed, or empty body     | `Validation of body failed`               |
| 401    | Token rejected                       | See [Tokens](auth.md#tokens)              |
| 403    | Account is banned                    | `Your account has been banned`            |
| 404    | User has no profile yet              | `Create your customer profile first`      |
| 404    | Area doesn't exist or is deleted     | `Area not found`                          |
| 409    | Meter number belongs to someone else | `This meter number is already registered` |
