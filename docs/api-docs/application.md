# Application

An **application** is a user's bid for a [job posting](job-posting.md): their phone number and a
PDF CV, with their name and email taken from the account. Any logged-in user who isn't an active
employee can apply, once per posting, while it's `OPEN`.

An application starts as `PAYMENT_PENDING` and becomes `SUBMITTED` once the posting's
`applicationFee` is [paid](payment.md#pay-application-fee). The poster then shortlists, hires or rejects it.

## Endpoints

`:name` is a path param, `?…` means query params and `{…}` means a request body. Details are in each section.

| Name                                        | Endpoint                                     | Access                   |
| ------------------------------------------- | -------------------------------------------- | ------------------------ |
| [Apply](#apply)                             | `POST /api/v1/job-postings/:id/applications` | Authenticated, not staff |
| [Get My Applications](#get-my-applications) | `GET /api/v1/applications/me?…`              | Authenticated            |

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

| Param    | Rules                                                              | Default |
| -------- | ------------------------------------------------------------------ | ------- |
| `page`   | Integer ≥ 1                                                        | `1`     |
| `limit`  | Integer 1–50                                                       | `10`    |
| `status` | `PAYMENT_PENDING`, `SUBMITTED`, `SHORTLISTED`, `HIRED`, `REJECTED` | —       |

**Example**

`GET /api/v1/applications/me?status=PAYMENT_PENDING&page=1&limit=10`

**Responses**

| Status | When              | Message                             |
| ------ | ----------------- | ----------------------------------- |
| 200    | Success           | `Applications fetched successfully` |
| 400    | Validation failed | `Validation of query failed`        |
