# Application

An **application** is a user's bid for a [job posting](job-posting.md): their phone number and a
PDF CV, with their name and email taken from the account. Any logged-in user who isn't an active
employee can apply, once per posting, while it's `OPEN`.

An application starts as `PAYMENT_PENDING` and becomes `SUBMITTED` once the posting's
`applicationFee` is [paid](payment.md#pay-application-fee). The poster's role then reviews it: a
Zone Manager their zone's technician applications, an admin every Zone Manager application.

```
PAYMENT_PENDING ─► SUBMITTED ─► SHORTLISTED ─► HIRED
                       │             │
                       └─────────────┴──────► REJECTED
```

Hiring makes the applicant an employee of the posting's role and zone, with their existing login.
Each review is emailed to the applicant and written to the audit log.

## Endpoints

`:name` is a path param, `?…` means query params and `{…}` means a request body. Details are in each section.

| Name                                                          | Endpoint                                      | Access                   |
| ------------------------------------------------------------- | --------------------------------------------- | ------------------------ |
| [Apply](#apply)                                               | `POST /api/v1/job-postings/:id/applications`  | Authenticated, not staff |
| [Get My Applications](#get-my-applications)                   | `GET /api/v1/applications/me?…`               | Authenticated            |
| [Get Job Posting Applications](#get-job-posting-applications) | `GET /api/v1/job-postings/:id/applications?…` | Zone Manager, Admin      |
| [Update Application Status](#update-application-status)       | `PATCH /api/v1/applications/:id/status {…}`   | Zone Manager, Admin      |

Every endpoint can also answer:

| Status | When              | Message                        |
| ------ | ----------------- | ------------------------------ |
| 401    | Token rejected    | See [Tokens](auth.md#tokens)   |
| 403    | Account is banned | `Your account has been banned` |

## Application Object

`status` is `PAYMENT_PENDING`, `SUBMITTED`, `SHORTLISTED`, `HIRED` or `REJECTED`. `cvUrl` opens the
CV; its id is random, so only those given the link can find it. `jobPosting.applicationFee` is the
fee to pay, in whole taka.

```json
{
  "id": "0b7e6d5c-4a3b-4c2d-9e1f-a2b3c4d5e6f7",
  "status": "PAYMENT_PENDING",
  "phone": "01712345678",
  "cvUrl": "https://res.cloudinary.com/erh5watf/image/upload/v1795782394/gridline/cvs/gh8ijlyu4x3jpq6ppx4l.pdf",
  "createdAt": "2026-11-27T12:00:00.000Z",
  "updatedAt": "2026-11-27T12:00:00.000Z",
  "jobPosting": {
    "id": "6a1f3c2e-4b5d-4e6f-8a9b-0c1d2e3f4a5b",
    "title": "Line Technician, Mirpur",
    "role": "TECHNICIAN",
    "applicationFee": 500,
    "zone": { "id": "37f69231-a572-48a7-ad56-308f66d4a720", "name": "Mirpur", "code": "MIR" }
  }
}
```

---

## Apply

`POST /api/v1/job-postings/:id/applications` · Authenticated, not staff

Applies for an open posting and returns the [application](#application-object), `PAYMENT_PENDING`.
The body is `multipart/form-data`. Every check runs before the CV is uploaded, so a refused
application stores no file. Limited to 20 tries per user per hour, failed ones included; over the limit returns
`429 Too many requests, try again in N seconds` with a `Retry-After` header.

**Body** (`multipart/form-data`)

| Field   | Type | Rules                                                                                                            |
| ------- | ---- | ---------------------------------------------------------------------------------------------------------------- |
| `phone` | text | Required; a Bangladeshi mobile number like `01712345678`. Spaces, dashes and a `+88` prefix are dropped          |
| `cv`    | file | Required; one PDF, 2 MB at most. Sent as `application/pdf` and must be a real PDF (the file starts with `%PDF-`) |

**Example**

```
phone=01712345678
cv=@cv.pdf;type=application/pdf
```

**Responses**

| Status | When                                       | Message                                                     |
| ------ | ------------------------------------------ | ----------------------------------------------------------- |
| 201    | Success                                    | `Application created; pay the fee to submit it`             |
| 400    | Validation failed (`phone` or `cv`)        | `Validation of params failed` / `Validation of body failed` |
| 400    | The body isn't a readable multipart form   | `Send the form as multipart/form-data`                      |
| 403    | An active employee                         | `Employees can't apply for jobs`                            |
| 404    | No job posting with this id, or deleted    | `Job posting not found`                                     |
| 409    | The posting is closed or past its deadline | `This job posting is closed`                                |
| 409    | Already applied for this posting           | `You already applied for this job`                          |
| 429    | Over 20 tries in an hour                   | `Too many requests, try again in N seconds`                 |
| 502    | Cloudinary didn't take the CV              | `Couldn't upload your CV; try again`                        |

---

## Get My Applications

`GET /api/v1/applications/me?…` · Authenticated

Lists the caller's [applications](#application-object), newest first. `meta` holds `page`,
`limit` and `total`.

**Query**

| Param          | Rules                                                              | Default |
| -------------- | ------------------------------------------------------------------ | ------- |
| `page`         | Integer ≥ 1                                                        | `1`     |
| `limit`        | Integer 1–50                                                       | `10`    |
| `status`       | `PAYMENT_PENDING`, `SUBMITTED`, `SHORTLISTED`, `HIRED`, `REJECTED` | —       |
| `jobPostingId` | Job posting UUID; the caller's application for it, if any          | —       |

**Example**

`GET /api/v1/applications/me?status=PAYMENT_PENDING&page=1&limit=10`

**Responses**

| Status | When              | Message                             |
| ------ | ----------------- | ----------------------------------- |
| 200    | Success           | `Applications fetched successfully` |
| 400    | Validation failed | `Validation of query failed`        |

---

## Review Application Object

What a reviewer sees: the [application](#application-object) with the applicant's `user`,
`reviewedBy` (who made the last review, or `null`), and `employee` (the employee row a hire
created, or `null`). `jobPosting` carries `vacancies` instead of the fee.

```json
{
  "id": "0b7e6d5c-4a3b-4c2d-9e1f-a2b3c4d5e6f7",
  "status": "HIRED",
  "phone": "01712345678",
  "cvUrl": "https://res.cloudinary.com/erh5watf/image/upload/v1795782394/gridline/cvs/gh8ijlyu4x3jpq6ppx4l.pdf",
  "createdAt": "2026-11-25T12:00:00.000Z",
  "updatedAt": "2026-11-27T09:30:00.000Z",
  "user": {
    "id": "9c8b7a6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
    "name": "Customer 02",
    "email": "customer02@example.com"
  },
  "reviewedBy": { "id": "2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f6a", "name": "Zone Manager 01" },
  "employee": {
    "id": "7f6e5d4c-3b2a-4c1d-8e9f-0a1b2c3d4e5f",
    "role": "TECHNICIAN",
    "zoneId": "37f69231-a572-48a7-ad56-308f66d4a720"
  },
  "jobPosting": {
    "id": "6a1f3c2e-4b5d-4e6f-8a9b-0c1d2e3f4a5b",
    "title": "Line Technician, Mirpur",
    "role": "TECHNICIAN",
    "vacancies": 3,
    "zone": { "id": "37f69231-a572-48a7-ad56-308f66d4a720", "name": "Mirpur", "code": "MIR" }
  }
}
```

---

## Get Job Posting Applications

`GET /api/v1/job-postings/:id/applications?…` · Zone Manager, Admin

Lists a posting's paid applications as [review application objects](#review-application-object),
oldest first; ones still waiting for the fee aren't shown. `meta` holds `page`, `limit` and `total`.

**Query**

| Param    | Rules                                           | Default  |
| -------- | ----------------------------------------------- | -------- |
| `page`   | Integer ≥ 1                                     | `1`      |
| `limit`  | Integer 1–50                                    | `10`     |
| `status` | `SUBMITTED`, `SHORTLISTED`, `HIRED`, `REJECTED` | All four |

**Example**

`GET /api/v1/job-postings/6a1f3c2e-4b5d-4e6f-8a9b-0c1d2e3f4a5b/applications?status=SUBMITTED`

**Responses**

| Status | When                                    | Message                                                        |
| ------ | --------------------------------------- | -------------------------------------------------------------- |
| 200    | Success                                 | `Applications fetched successfully`                            |
| 400    | Validation failed                       | `Validation of params failed` / `Validation of query failed`   |
| 403    | Not a Zone Manager or an admin          | `You don't have permission to do this`                         |
| 403    | Zone Manager, a Zone Manager posting    | `Zone Manager postings are managed by admins`                  |
| 403    | Zone Manager, another zone's posting    | `This job posting isn't in your zone`                          |
| 403    | Admin, a technician posting             | `Technician postings are managed by their zone's Zone Manager` |
| 404    | No job posting with this id, or deleted | `Job posting not found`                                        |

---

## Update Application Status

`PATCH /api/v1/applications/:id/status {…}` · Zone Manager, Admin

Reviews an application of a posting the caller manages and returns the
[review application object](#review-application-object). A `SUBMITTED` application can be
shortlisted or rejected, a `SHORTLISTED` one hired or rejected; `HIRED` and `REJECTED` are final.
The applicant gets an email after the change is saved; if the email fails, the change stands.

Hiring, in one transaction with the status change and both audit rows (`APPLICATION_STATUS_CHANGED`,
`EMPLOYEE_HIRED`):

- the posting must have a vacancy left (hires on one posting run one at a time)
- for a Zone Manager posting, the zone must have no active Zone Manager
- the applicant must not already be an active employee
- creates the applicant's employee row with the posting's role and zone; they keep their login and
  get the new role on their next request

**Body**

| Field    | Type   | Rules                                |
| -------- | ------ | ------------------------------------ |
| `status` | string | `SHORTLISTED`, `REJECTED` or `HIRED` |

**Example**

```json
{
  "status": "HIRED"
}
```

**Responses**

| Status | When                                      | Message                                                                      |
| ------ | ----------------------------------------- | ---------------------------------------------------------------------------- |
| 200    | Success                                   | `Application status updated successfully`                                    |
| 400    | Validation failed                         | `Validation of params failed` / `Validation of body failed`                  |
| 403    | Not a Zone Manager or an admin            | `You don't have permission to do this`                                       |
| 403    | Not the poster's role for this posting    | As in [Get Job Posting Applications](#get-job-posting-applications)          |
| 404    | No application with this id               | `Application not found`                                                      |
| 409    | The fee isn't paid                        | `This application's fee isn't paid yet`                                      |
| 409    | Already `HIRED` or `REJECTED`             | `This application is already hired` / `This application is already rejected` |
| 409    | Shortlisting a shortlisted application    | `This application is already shortlisted`                                    |
| 409    | Hiring a `SUBMITTED` application          | `Shortlist this application before hiring`                                   |
| 409    | Another reviewer changed it first         | `This application was just changed by someone else; refresh and try again`   |
| 409    | Hiring, no vacancy left                   | `The vacancy is filled` / `All N vacancies are filled`                       |
| 409    | Hiring a Zone Manager, the zone has one   | `This zone already has a Zone Manager`                                       |
| 409    | Hiring someone who is already an employee | `This applicant is already an employee`                                      |
