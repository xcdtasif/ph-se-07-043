# Payment

A **payment** is one Stripe Checkout session for an [application](application.md)'s fee, in
`bdt`. Paying is the step that turns an application from `PAYMENT_PENDING` into `SUBMITTED`.

Only Stripe's signed webhook changes a payment's `status`. `COMPLETED` submits the application;
`FAILED` means the session expired unpaid, and the applicant can pay again. A `PENDING` payment's
checkout stays open for 35 minutes.

## Endpoints

`:name` is a path param, `?…` means query params and `{…}` means a request body. Details are in each section.

| Name                                        | Endpoint                            | Access                       |
| ------------------------------------------- | ----------------------------------- | ---------------------------- |
| [Pay Application Fee](#pay-application-fee) | `POST /api/v1/applications/:id/pay` | Authenticated, its applicant |
| [Get My Payments](#get-my-payments)         | `GET /api/v1/payments/me?…`         | Authenticated                |
| [Stripe Webhook](#stripe-webhook)           | `POST /api/v1/stripe/webhook`       | Stripe (signed)              |

The endpoints for users can also answer:

| Status | When              | Message                        |
| ------ | ----------------- | ------------------------------ |
| 401    | Token rejected    | See [Tokens](auth.md#tokens)   |
| 403    | Account is banned | `Your account has been banned` |

Stripe's own failures answer `429 Payment provider is busy, try again`,
`503 Payment provider unavailable` or `502 Payment provider error`.

## Payment Object

`amount` is in whole taka: the posting's fee when the checkout opened. `paidAt` is set once it's
`COMPLETED`. `application` shows where the application stands.

```json
{
  "id": "af1b0647-d118-43e3-9bec-68edc4a75021",
  "amount": 500,
  "currency": "bdt",
  "status": "COMPLETED",
  "paidAt": "2026-11-27T13:34:40.909Z",
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

## Stripe Webhook

`POST /api/v1/stripe/webhook` · Stripe (signed)

Called by Stripe, not by clients: the `Stripe-Signature` header is checked against the raw body
with `STRIPE_WEBHOOK_SECRET`. `checkout.session.completed` (paid) marks the payment `COMPLETED` and
submits the application in one transaction, with an audit log entry; `checkout.session.expired`
marks it `FAILED`. Stripe retries deliveries, so an event for a payment that's no longer
`PENDING` changes nothing. Locally, `pn stripe:listen` forwards the events here.

**Responses**

| Status | When                                 | Message                          |
| ------ | ------------------------------------ | -------------------------------- |
| 200    | Processed, or nothing left to change | `Webhook processed successfully` |
| 400    | No `Stripe-Signature` header         | `Invalid webhook request`        |
| 400    | The signature doesn't match the body | `Invalid webhook signature`      |
