# Outage

An **outage report** is a customer saying their power is out when no load shedding is scheduled.
The Zone Manager of the area's zone looks at the zone's pending reports and either dismisses one
(for example, it was scheduled load shedding) or confirms an outage, which links the pending reports
in its areas.

A report is made for the customer's current area, taken from their
[customer profile](customer.md). Moving to another area later doesn't move old reports. A customer
can have one pending report per area at a time.

| Status      | Meaning                                  |
| ----------- | ---------------------------------------- |
| `PENDING`   | Waiting for the Zone Manager             |
| `LINKED`    | Part of a confirmed outage (coming soon) |
| `DISMISSED` | Not an outage; `dismissReason` says why  |

## Endpoints

`:name` is a path param, `?…` means query params and `{…}` means a request body. Details are in each section.

| Name                                  | Endpoint                                   | Access       |
| ------------------------------------- | ------------------------------------------ | ------------ |
| [Report Outage](#report-outage)       | `POST /api/v1/outage-reports`              | Customer     |
| [Get My Reports](#get-my-reports)     | `GET /api/v1/outage-reports/me?…`          | Customer     |
| [Get Zone Reports](#get-zone-reports) | `GET /api/v1/outage-reports?…`             | Zone Manager |
| [Dismiss Report](#dismiss-report)     | `PATCH /api/v1/outage-reports/:id/dismiss` | Zone Manager |

Every endpoint can also answer:

| Status | When                                      | Message                                |
| ------ | ----------------------------------------- | -------------------------------------- |
| 401    | Token rejected                            | See [Tokens](auth.md#tokens)           |
| 403    | Account is banned                         | `Your account has been banned`         |
| 403    | Customer endpoint, no customer profile    | `Create your customer profile first`   |
| 403    | Zone Manager endpoint, not a Zone Manager | `You don't have permission to do this` |

## Report Object

What a customer sees. Times are UTC.

```json
{
  "id": "363bd5aa-edf0-458f-9fcf-9498191a7c80",
  "status": "DISMISSED",
  "description": "Lights went out",
  "dismissReason": "That was scheduled load shedding on MIR-F01",
  "createdAt": "2026-11-24T09:06:22.644Z",
  "updatedAt": "2026-11-24T10:06:22.644Z",
  "area": {
    "id": "331dad88-f8a2-446a-96f8-54542ca697f4",
    "name": "Mirpur 10, Block C"
  }
}
```

A Zone Manager also gets the area's feeder and who reported it:

```json
{
  "id": "07c759cd-8083-4d13-8e68-c55fa2d98886",
  "status": "PENDING",
  "description": "No power since the evening, the whole lane is dark",
  "dismissReason": null,
  "createdAt": "2026-11-27T08:06:22.482Z",
  "updatedAt": "2026-11-27T09:06:23.171Z",
  "area": {
    "id": "331dad88-f8a2-446a-96f8-54542ca697f4",
    "name": "Mirpur 10, Block C",
    "feeder": {
      "id": "c02da91f-48ee-468f-84cb-11d8f132a562",
      "name": "Mirpur 10",
      "code": "MIR-F01"
    }
  },
  "customer": {
    "meterNumber": "100000000001",
    "user": { "name": "Customer 01" }
  }
}
```

---

## Report Outage

`POST /api/v1/outage-reports` · Customer

Reports an outage in the customer's area and returns the [report](#report-object) as `PENDING`.

**Body**

| Field         | Type   | Rules                                                     |
| ------------- | ------ | --------------------------------------------------------- |
| `description` | string | Optional; 1–500 characters, trimmed. The body can be `{}` |

**Example**

```json
{
  "description": "No power since the evening, the whole lane is dark"
}
```

**Responses**

| Status | When                                  | Message                                           |
| ------ | ------------------------------------- | ------------------------------------------------- |
| 201    | Success                               | `Outage reported successfully`                    |
| 400    | Validation failed                     | `Validation of body failed`                       |
| 409    | A pending report for this area exists | `You already have a pending report for this area` |

---

## Get My Reports

`GET /api/v1/outage-reports/me?…` · Customer

Lists the customer's [reports](#report-object), newest first. `meta` holds `page`, `limit` and
`total`.

**Query**

| Param    | Rules                              | Default |
| -------- | ---------------------------------- | ------- |
| `page`   | Integer ≥ 1                        | `1`     |
| `limit`  | Integer 1–50                       | `10`    |
| `status` | `PENDING`, `LINKED` or `DISMISSED` | —       |

**Responses**

| Status | When              | Message                        |
| ------ | ----------------- | ------------------------------ |
| 200    | Success           | `Reports fetched successfully` |
| 400    | Validation failed | `Validation of query failed`   |

---

## Get Zone Reports

`GET /api/v1/outage-reports?…` · Zone Manager

Lists the reports from the areas of the Zone Manager's zone, in the Zone Manager's
[report](#report-object) shape. `meta` holds `page`, `limit` and `total`.

**Query**

| Param       | Rules                              | Default |
| ----------- | ---------------------------------- | ------- |
| `page`      | Integer ≥ 1                        | `1`     |
| `limit`     | Integer 1–50                       | `10`    |
| `status`    | `PENDING`, `LINKED` or `DISMISSED` | —       |
| `areaId`    | UUID of an area in the zone        | —       |
| `sortOrder` | `asc` or `desc`, by time reported  | `desc`  |

**Example**

`GET /api/v1/outage-reports?status=PENDING&sortOrder=asc&page=1&limit=10`

**Responses**

| Status | When              | Message                        |
| ------ | ----------------- | ------------------------------ |
| 200    | Success           | `Reports fetched successfully` |
| 400    | Validation failed | `Validation of query failed`   |

---

## Dismiss Report

`PATCH /api/v1/outage-reports/:id/dismiss` · Zone Manager

Marks a pending report in the Zone Manager's zone as not an outage and returns it in the Zone
Manager's [report](#report-object) shape. The customer sees the reason.

**Body**

| Field    | Type   | Rules                               |
| -------- | ------ | ----------------------------------- |
| `reason` | string | Required; 3–500 characters, trimmed |

**Example**

```json
{
  "reason": "Scheduled load shedding on MIR-F01"
}
```

**Responses**

| Status | When                          | Message                                                     |
| ------ | ----------------------------- | ----------------------------------------------------------- |
| 200    | Success                       | `Report dismissed successfully`                             |
| 400    | Validation failed             | `Validation of params failed` / `Validation of body failed` |
| 403    | The report is in another zone | `This report isn't in your zone`                            |
| 404    | No report with this id        | `Report not found`                                          |
| 409    | Already dismissed             | `Report is already dismissed`                               |
| 409    | Linked to an outage           | `This report is linked to an outage and can't be dismissed` |
