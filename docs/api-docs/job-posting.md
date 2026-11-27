# Job Posting

A **job posting** is an opening in one zone. A Zone Manager posts `TECHNICIAN` jobs for their own
zone; an admin posts `ZONE_MANAGER` jobs and names the zone. Each manages only the postings of the
role they hire: a Zone Manager their zone's technician postings, an admin every Zone Manager
posting.

Applicants can apply while a posting is `OPEN`. It turns `CLOSED` when its poster closes it, or
once its `deadline` day ends in Dhaka time; nothing has to run for that, reads work it out from
the date.

## Endpoints

`:name` is a path param, `?…` means query params and `{…}` means a request body. Details are in each section.

| Name                                      | Endpoint                          | Access              |
| ----------------------------------------- | --------------------------------- | ------------------- |
| [Get Job Postings](#get-job-postings)     | `GET /api/v1/job-postings?…`      | Public              |
| [Get Job Posting](#get-job-posting)       | `GET /api/v1/job-postings/:id`    | Public              |
| [Create Job Posting](#create-job-posting) | `POST /api/v1/job-postings`       | Zone Manager, Admin |
| [Update Job Posting](#update-job-posting) | `PATCH /api/v1/job-postings/:id`  | Zone Manager, Admin |
| [Delete Job Posting](#delete-job-posting) | `DELETE /api/v1/job-postings/:id` | Zone Manager, Admin |

The endpoints for Zone Managers and admins can also answer:

| Status | When                           | Message                                |
| ------ | ------------------------------ | -------------------------------------- |
| 401    | Token rejected                 | See [Tokens](auth.md#tokens)           |
| 403    | Account is banned              | `Your account has been banned`         |
| 403    | Not a Zone Manager or an admin | `You don't have permission to do this` |

## Job Posting Object

`role` is the job being hired for. `applicationFee` is in whole taka. `deadline` is the last Dhaka
day to apply. `status` is what applicants see: `CLOSED` also when the deadline has passed.

```json
{
  "id": "6a1f3c2e-4b5d-4e6f-8a9b-0c1d2e3f4a5b",
  "role": "TECHNICIAN",
  "title": "Line Technician, Mirpur",
  "description": "Restore supply on 11 kV and 0.4 kV lines across Mirpur: fault finding, fuse and breaker work, and storm repairs. Shift work, including nights.",
  "vacancies": 3,
  "applicationFee": 500,
  "deadline": "2026-12-18",
  "status": "OPEN",
  "createdAt": "2026-11-24T10:00:00.000Z",
  "updatedAt": "2026-11-24T10:00:00.000Z",
  "zone": { "id": "37f69231-a572-48a7-ad56-308f66d4a720", "name": "Mirpur", "code": "MIR" }
}
```

---

## Get Job Postings

`GET /api/v1/job-postings?…` · Public

Lists [job postings](#job-posting-object). `meta` holds `page`, `limit` and `total`. Answers are
cached for up to 5 minutes and dropped as soon as a posting or a zone's name or code changes.

**Query**

| Param       | Rules                                                  | Default     |
| ----------- | ------------------------------------------------------ | ----------- |
| `page`      | Integer ≥ 1                                            | `1`         |
| `limit`     | Integer 1–50                                           | `10`        |
| `zoneId`    | Zone UUID                                              | —           |
| `role`      | `TECHNICIAN` or `ZONE_MANAGER`                         | —           |
| `status`    | `OPEN` or `CLOSED`; `CLOSED` includes passed deadlines | —           |
| `search`    | 1–100 characters; matches title or description         | —           |
| `sortBy`    | `createdAt`, `deadline` or `applicationFee`            | `createdAt` |
| `sortOrder` | `asc` or `desc`                                        | `desc`      |

**Example**

`GET /api/v1/job-postings?status=OPEN&role=TECHNICIAN&search=technician&sortBy=deadline&sortOrder=asc`

**Responses**

| Status | When              | Message                             |
| ------ | ----------------- | ----------------------------------- |
| 200    | Success           | `Job postings fetched successfully` |
| 400    | Validation failed | `Validation of query failed`        |

---

## Get Job Posting

`GET /api/v1/job-postings/:id` · Public

Returns one [job posting](#job-posting-object), open or closed. Cached like
[Get Job Postings](#get-job-postings).

**Responses**

| Status | When                                    | Message                            |
| ------ | --------------------------------------- | ---------------------------------- |
| 200    | Success                                 | `Job posting fetched successfully` |
| 400    | `id` isn't a UUID                       | `Validation of params failed`      |
| 404    | No job posting with this id, or deleted | `Job posting not found`            |

---

## Create Job Posting

`POST /api/v1/job-postings` · Zone Manager, Admin

Posts a job and returns the [job posting](#job-posting-object), `OPEN`. The poster's role sets the
posting's: a Zone Manager's is a `TECHNICIAN` job in their zone, an admin's a `ZONE_MANAGER` job in
`zoneId`. A zone has one Zone Manager, so a Zone Manager posting has one vacancy; hiring checks that
the zone has none left.

**Body**

| Field            | Type    | Rules                                                                   |
| ---------------- | ------- | ----------------------------------------------------------------------- |
| `title`          | string  | Required; 5–120 characters                                              |
| `description`    | string  | Required; 20–5000 characters                                            |
| `vacancies`      | integer | 1–50, default `1`; must be `1` for a Zone Manager posting               |
| `applicationFee` | integer | Required; 100–10000 taka                                                |
| `deadline`       | string  | Required; a date like `2026-12-31`, from today to 90 days ahead (Dhaka) |
| `zoneId`         | string  | Admin: required, a zone UUID. Zone Manager: optional, their own zone    |

**Example**

```json
{
  "title": "Line Technician, Mirpur",
  "description": "Restore supply on 11 kV and 0.4 kV lines across Mirpur: fault finding, fuse and breaker work, and storm repairs.",
  "vacancies": 3,
  "applicationFee": 500,
  "deadline": "2026-12-18"
}
```

**Responses**

| Status | When                                  | Message                                      |
| ------ | ------------------------------------- | -------------------------------------------- |
| 201    | Success                               | `Job posting created successfully`           |
| 400    | Validation failed                     | `Validation of body failed`                  |
| 400    | Admin, no `zoneId`                    | `Choose the zone this Zone Manager will run` |
| 400    | Zone Manager posting, `vacancies` ≠ 1 | `A zone has one Zone Manager`                |
| 403    | Zone Manager, another zone's `zoneId` | `You can only post jobs for your own zone`   |
| 404    | Zone doesn't exist or is deleted      | `Zone not found`                             |

---

## Update Job Posting

`PATCH /api/v1/job-postings/:id` · Zone Manager, Admin

Changes a posting the caller manages and returns the [job posting](#job-posting-object). Its zone
and role stay. `status` closes it (`CLOSED`) or reopens it (`OPEN`); reopening after the deadline
needs a new `deadline` in the same request.

**Body**

At least one of `title`, `description`, `vacancies`, `applicationFee` and `deadline`, with the
rules of [Create Job Posting](#create-job-posting), and `status`: `OPEN` or `CLOSED`.

**Example**

```json
{
  "status": "CLOSED"
}
```

**Responses**

| Status | When                                               | Message                                                        |
| ------ | -------------------------------------------------- | -------------------------------------------------------------- |
| 200    | Success                                            | `Job posting updated successfully`                             |
| 400    | Validation failed, or empty body                   | `Validation of params failed` / `Validation of body failed`    |
| 400    | Zone Manager posting, `vacancies` ≠ 1              | `A zone has one Zone Manager`                                  |
| 403    | Zone Manager, a Zone Manager posting               | `Zone Manager postings are managed by admins`                  |
| 403    | Zone Manager, another zone's posting               | `This job posting isn't in your zone`                          |
| 403    | Admin, a technician posting                        | `Technician postings are managed by their zone's Zone Manager` |
| 404    | No job posting with this id, or deleted            | `Job posting not found`                                        |
| 409    | `status: OPEN` after the deadline, no new deadline | `The deadline has passed; set a new one to reopen`             |

---

## Delete Job Posting

`DELETE /api/v1/job-postings/:id` · Zone Manager, Admin

Soft deletes a posting the caller manages, so it leaves every list. Returns no `data`. To stop
applications but keep it listed, close it with [Update Job Posting](#update-job-posting) instead.

**Responses**

| Status | When                                    | Message                                                        |
| ------ | --------------------------------------- | -------------------------------------------------------------- |
| 200    | Success                                 | `Job posting deleted successfully`                             |
| 400    | `id` isn't a UUID                       | `Validation of params failed`                                  |
| 403    | Zone Manager, a Zone Manager posting    | `Zone Manager postings are managed by admins`                  |
| 403    | Zone Manager, another zone's posting    | `This job posting isn't in your zone`                          |
| 403    | Admin, a technician posting             | `Technician postings are managed by their zone's Zone Manager` |
| 404    | No job posting with this id, or deleted | `Job posting not found`                                        |
