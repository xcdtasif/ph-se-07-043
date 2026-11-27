# Payment

A **payment** is one Stripe Checkout session for an [application](application.md)'s fee, in
`bdt`. Paying is the step that turns an application from `PAYMENT_PENDING` into `SUBMITTED`.

Only Stripe's signed webhook changes a payment's `status`. `COMPLETED` submits the application;
`FAILED` means the session expired unpaid, and the applicant can pay again. A `PENDING` payment's
checkout stays open for 35 minutes.

## Endpoints

`:name` is a path param, `?…` means query params and `{…}` means a request body. Details are in each section.

| Name                                        | Endpoint                            | Access                        |
| ------------------------------------------- | ----------------------------------- | ----------------------------- |
| [Pay Application Fee](#pay-application-fee) | `POST /api/v1/applications/:id/pay` | Authenticated, its applicant  |
| [Get My Payments](#get-my-payments)         | `GET /api/v1/payments/me?…`         | Authenticated                 |
| [Download Invoice](#download-invoice)       | `GET /api/v1/payments/:id/invoice`  | Authenticated, payer or Admin |
| [Get All Payments](#get-all-payments)       | `GET /api/v1/admin/payments?…`      | Admin                         |
| [Stripe Webhook](#stripe-webhook)           | `POST /api/v1/stripe/webhook`       | Stripe (signed)               |

The endpoints for users can also answer:

| Status | When              | Message                        |
| ------ | ----------------- | ------------------------------ |
| 401    | Token rejected    | See [Tokens](auth.md#tokens)   |
| 403    | Account is banned | `Your account has been banned` |

Get All Payments also answers `403 You don't have permission to do this` to anyone but an admin.

Stripe's own failures answer `429 Payment provider is busy, try again`,
`503 Payment provider unavailable` or `502 Payment provider error`.

## Payment Object

`amount` is in whole taka: the posting's fee when the checkout opened. `paidAt` and
`invoiceNumber` are set once it's `COMPLETED`. `application` shows where the application stands.

```json
{
  "id": "af1b0647-d118-43e3-9bec-68edc4a75021",
  "amount": 500,
  "currency": "bdt",
  "status": "COMPLETED",
  "paidAt": "2026-11-27T13:34:40.909Z",
  "invoiceNumber": "GL-20261127-AF1B0647",
  "createdAt": "2026-11-27T13:28:16.817Z",
  "updatedAt": "2026-11-27T13:34:40.911Z",
  "application": {
    "id": "103c8c36-1679-4a8c-b7dc-9aba90bec514",
    "status": "SUBMITTED",
    "jobPosting": {
      "id": "260af440-251c-451f-959e-28d01c965982",
      "title": "Line Technician, Mirpur",
      "role": "TECHNICIAN",
      "zone": { "id": "ebab1cc6-4368-4767-b2f1-460cc8e371b3", "name": "Mirpur", "code": "MIR" }
    }
  }
}
```

---

## Pay Application Fee

`POST /api/v1/applications/:id/pay` · Authenticated, its applicant

Returns the `PENDING` [payment](#payment-object) plus `checkoutUrl`, Stripe's hosted page to pay
on. While a checkout is still open, the same one comes back, so a user who closed the tab or
clicked twice has one payable session. The posting must still be open. After paying, Stripe
redirects to `CLIENT_URL/payments/success?session_id=…` (cancelling, to `CLIENT_URL/payments/cancel`);
the application is `SUBMITTED` once the webhook arrives, usually within seconds.

Test card: `4242 4242 4242 4242`, any future expiry date, any CVC.

**Example**

`POST /api/v1/applications/103c8c36-1679-4a8c-b7dc-9aba90bec514/pay`

**Responses**

| Status | When                                       | Message                                   |
| ------ | ------------------------------------------ | ----------------------------------------- |
| 200    | Success                                    | `Checkout ready; open checkoutUrl to pay` |
| 400    | `id` isn't a UUID                          | `Validation of params failed`             |
| 403    | Someone else's application                 | `This application isn't yours`            |
| 404    | No application with this id                | `Application not found`                   |
| 409    | Not `PAYMENT_PENDING` any more             | `This application's fee is already paid`  |
| 409    | The posting is closed or past its deadline | `This job posting is closed`              |
| 409    | Paid, and the webhook hasn't arrived yet   | `Your payment is being processed`         |
| 502    | Stripe gave no checkout page               | `Couldn't create a checkout session`      |

---

## Get My Payments

`GET /api/v1/payments/me?…` · Authenticated

Lists the caller's [payments](#payment-object), newest first. `meta` holds `page`, `limit` and
`total`. The success page finds its payment with `sessionId`, the `session_id` Stripe put in its
URL.

**Query**

| Param       | Rules                                   | Default |
| ----------- | --------------------------------------- | ------- |
| `page`      | Integer ≥ 1                             | `1`     |
| `limit`     | Integer 1–50                            | `10`    |
| `status`    | `PENDING`, `COMPLETED` or `FAILED`      | —       |
| `sessionId` | 1–255 characters; a Checkout session id | —       |

**Example**

`GET /api/v1/payments/me?sessionId=cs_test_a0UWQuWodrjTS2Pn21vvW0Dn1KfTCCUKW1HlDf1uNXtTViz5NppsbH1qjR`

**Responses**

| Status | When              | Message                         |
| ------ | ----------------- | ------------------------------- |
| 200    | Success           | `Payments fetched successfully` |
| 400    | Validation failed | `Validation of query failed`    |

---

## Download Invoice

`GET /api/v1/payments/:id/invoice` · Authenticated, payer or Admin

Returns the invoice of a `COMPLETED` payment as a PDF (`Content-Type: application/pdf`), saved as
`invoice-<invoiceNumber>.pdf`. It's the same invoice the webhook emails to the payer, built afresh
on each request, so a lost email doesn't lose the invoice. Errors answer in JSON as usual.

**Example**

`GET /api/v1/payments/af1b0647-d118-43e3-9bec-68edc4a75021/invoice`

**Responses**

| Status | When                              | Message                                   |
| ------ | --------------------------------- | ----------------------------------------- |
| 200    | Success                           | The PDF, no JSON body                     |
| 400    | `id` isn't a UUID                 | `Validation of params failed`             |
| 403    | Someone else's payment, not Admin | `This payment isn't yours`                |
| 404    | No payment with this id           | `Payment not found`                       |
| 409    | `PENDING` or `FAILED`             | `Only a completed payment has an invoice` |

---

## Get All Payments

`GET /api/v1/admin/payments?…` · Admin

Lists every [payment](#payment-object), newest first, with the payer added to `application` as
`user`. `meta` holds `page`, `limit` and `total`.

**Query**

| Param    | Rules                                                                                | Default |
| -------- | ------------------------------------------------------------------------------------ | ------- |
| `page`   | Integer ≥ 1                                                                          | `1`     |
| `limit`  | Integer 1–50                                                                         | `10`    |
| `status` | `PENDING`, `COMPLETED` or `FAILED`                                                   | —       |
| `search` | 1–100 characters; part of the payer's name or email, or the invoice number, any case | —       |
| `from`   | First day the checkout opened on (Dhaka), like `2026-11-01`                          | —       |
| `to`     | Last day, on or after `from`                                                         | —       |

**Example**

`GET /api/v1/admin/payments?status=COMPLETED&search=customer01&from=2026-11-01&to=2026-11-30`

```json
[
  {
    "id": "ac655c71-b6dc-4d48-84be-f740622f7400",
    "amount": 1000,
    "currency": "bdt",
    "status": "COMPLETED",
    "paidAt": "2026-11-26T16:01:14.152Z",
    "invoiceNumber": "GL-20261126-AC655C71",
    "createdAt": "2026-11-26T15:59:14.152Z",
    "updatedAt": "2026-11-26T16:01:14.152Z",
    "application": {
      "id": "d408d62d-a866-4334-a2b4-7b9e07f18536",
      "status": "SHORTLISTED",
      "jobPosting": {
        "id": "0e19bb13-cd46-444f-b961-95386d510a88",
        "title": "Zone Manager, Uttara",
        "role": "ZONE_MANAGER",
        "zone": { "id": "e7eb61e2-89f3-4967-8a4f-5039a23416a9", "name": "Uttara", "code": "UTT" }
      },
      "user": {
        "id": "ebc6183f-f6bb-4c04-8e1d-e1282a8fffb3",
        "name": "Customer 01",
        "email": "customer01@example.com"
      }
    }
  }
]
```

**Responses**

| Status | When              | Message                         |
| ------ | ----------------- | ------------------------------- |
| 200    | Success           | `Payments fetched successfully` |
| 400    | Validation failed | `Validation of query failed`    |

---

## Stripe Webhook

`POST /api/v1/stripe/webhook` · Stripe (signed)

Called by Stripe, not by clients: the `Stripe-Signature` header is checked against the raw body
with `STRIPE_WEBHOOK_SECRET`. `checkout.session.completed` (paid) marks the payment `COMPLETED` with
its `invoiceNumber` and submits the application in one transaction, with an audit log entry, then
emails the payer the [invoice](#download-invoice) PDF; a failed email is only logged.
`checkout.session.expired` marks it `FAILED`. Stripe retries deliveries, so an event for a payment
that's no longer `PENDING` changes nothing and sends no second email. Locally, `pn stripe:listen` forwards the events here.

**Responses**

| Status | When                                 | Message                          |
| ------ | ------------------------------------ | -------------------------------- |
| 200    | Processed, or nothing left to change | `Webhook processed successfully` |
| 400    | No `Stripe-Signature` header         | `Invalid webhook request`        |
| 400    | The signature doesn't match the body | `Invalid webhook signature`      |
