# Outage

An **outage report** is a customer saying their power is out when no load shedding is scheduled.
The Zone Manager of the area's zone looks at the zone's pending reports and either dismisses one
(for example, it was scheduled load shedding) or confirms an **outage** in some of the zone's
areas, which links the pending reports in those areas. A Zone Manager can also confirm an outage
nobody reported.

A report is made for the customer's current area, taken from their
[customer profile](customer.md). Moving to another area later doesn't move old reports. A customer
can have one pending report per area at a time. If the area is already in an active outage, a new
report joins it at once (`LINKED`), once per customer per outage.

| Report status | Meaning                                 |
| ------------- | --------------------------------------- |
| `PENDING`     | Waiting for the Zone Manager            |
| `LINKED`      | Part of the outage `outageId`           |
| `DISMISSED`   | Not an outage; `dismissReason` says why |

An outage is **active** until it's `RESTORED`, and an area is in at most one active outage. The
Zone Manager assigns a technician of the zone, who starts the work and restores power. A technician
has at most one active job (`ASSIGNED` or `IN_PROGRESS`).

```
CONFIRMED ─► ASSIGNED ─► IN_PROGRESS ─► RESTORED
                 └─────────────────────► RESTORED (TEMPORARY_TRIP only)
```

| Outage status | Meaning                                                       |
| ------------- | ------------------------------------------------------------- |
| `CONFIRMED`   | The Zone Manager confirmed it                                 |
| `ASSIGNED`    | A technician is assigned; the Zone Manager can still reassign |
| `IN_PROGRESS` | The technician is working on it                               |
| `RESTORED`    | Power is back                                                 |

The technician sets the **cause** after inspection, at the latest when restoring:
`TRANSFORMER_FAULT`, `CABLE_DAMAGE`, `EMERGENCY_MAINTENANCE`, `TEMPORARY_TRIP` or `OTHER`. A
temporary trip that cleared before work started can go straight from `ASSIGNED` to `RESTORED`.

## Endpoints

`:name` is a path param, `?…` means query params and `{…}` means a request body. Details are in each section.

| Name                                          | Endpoint                                   | Access       |
| --------------------------------------------- | ------------------------------------------ | ------------ |
| [Report Outage](#report-outage)               | `POST /api/v1/outage-reports`              | Customer     |
| [Get My Reports](#get-my-reports)             | `GET /api/v1/outage-reports/me?…`          | Customer     |
| [Get Zone Reports](#get-zone-reports)         | `GET /api/v1/outage-reports?…`             | Zone Manager |
| [Dismiss Report](#dismiss-report)             | `PATCH /api/v1/outage-reports/:id/dismiss` | Zone Manager |
| [Confirm Outage](#confirm-outage)             | `POST /api/v1/outages`                     | Zone Manager |
| [Get Outages](#get-outages)                   | `GET /api/v1/outages?…`                    | Public       |
| [Get Outage](#get-outage)                     | `GET /api/v1/outages/:id`                  | Public       |
| [Assign Technician](#assign-technician)       | `PATCH /api/v1/outages/:id/assign`         | Zone Manager |
| [Get Assigned Outages](#get-assigned-outages) | `GET /api/v1/outages/assigned?…`           | Technician   |
| [Update Outage Status](#update-outage-status) | `PATCH /api/v1/outages/:id/status`         | Technician   |

Every endpoint that needs a login can also answer:

| Status | When                                      | Message                                |
| ------ | ----------------------------------------- | -------------------------------------- |
| 401    | Token rejected                            | See [Tokens](auth.md#tokens)           |
| 403    | Account is banned                         | `Your account has been banned`         |
| 403    | Customer endpoint, no customer profile    | `Create your customer profile first`   |
| 403    | Zone Manager endpoint, not a Zone Manager | `You don't have permission to do this` |
| 403    | Technician endpoint, not a Technician     | `You don't have permission to do this` |

## Report Object

What a customer sees. Times are UTC. `outageId` is set when the report is `LINKED`; the outage's
status page is `CLIENT_URL/outages/:outageId`.

```json
{
  "id": "363bd5aa-edf0-458f-9fcf-9498191a7c80",
  "status": "DISMISSED",
  "description": "Lights went out",
  "dismissReason": "That was scheduled load shedding on MIR-F01",
  "outageId": null,
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
  "outageId": null,
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

## Outage Object

What anyone sees on the status page: no staff or customer details. `note` is the Zone Manager's
message for the public. `cause` is `null` until the technician sets it, and each time is `null`
until the outage gets there. `areas` are sorted by name and `reportCount` counts the linked
reports.

```json
{
  "id": "0ce75c9b-0822-4817-8ce6-4d20f4a021ab",
  "status": "CONFIRMED",
  "cause": null,
  "note": "Fault near Road 27, crews are on the way",
  "confirmedAt": "2026-11-27T05:27:38.519Z",
  "assignedAt": null,
  "startedAt": null,
  "restoredAt": null,
  "updatedAt": "2026-11-27T05:27:38.519Z",
  "zone": { "id": "53f1db93-cc91-4332-860d-bb9c6cb09df0", "name": "Dhanmondi" },
  "areas": [
    {
      "id": "890035ae-794e-44a2-aef5-68dc571f820c",
      "name": "Dhanmondi Road 27",
      "feeder": {
        "id": "4b4dbcec-7c79-4682-ab38-ca8a9291feb0",
        "name": "Dhanmondi West",
        "code": "DHN-F01"
      }
    }
  ],
  "reportCount": 1
}
```

---

## Report Outage

`POST /api/v1/outage-reports` · Customer

Reports an outage in the customer's area and returns the [report](#report-object). It's `PENDING`,
or `LINKED` with `outageId` set when the area is already in an active outage.

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

| Status | When                                  | Message                                                                   |
| ------ | ------------------------------------- | ------------------------------------------------------------------------- |
| 201    | Success, report pending               | `Outage reported successfully`                                            |
| 201    | Success, joined the active outage     | `Outage reported; it's already confirmed and your report was added to it` |
| 400    | Validation failed                     | `Validation of body failed`                                               |
| 409    | A pending report for this area exists | `You already have a pending report for this area`                         |
| 409    | Already reported the active outage    | `You already reported this outage`                                        |

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

---

## Confirm Outage

`POST /api/v1/outages` · Zone Manager

Confirms an outage in the Zone Manager's zone and returns the [outage](#outage-object). It covers
`areaIds` plus the areas of `reportIds`, so the Zone Manager can confirm straight from the reports
in front of them. Every pending report in those areas is linked, not just the given ones.

**Body**

| Field       | Type     | Rules                                                    |
| ----------- | -------- | -------------------------------------------------------- |
| `areaIds`   | string[] | Optional; up to 50 area UUIDs in the zone                |
| `reportIds` | string[] | Optional; up to 50 pending report UUIDs in the zone      |
| `note`      | string   | Optional; 1–500 characters, trimmed. Shown to the public |

At least one area or report is required.

**Example**

```json
{
  "reportIds": ["07c759cd-8083-4d13-8e68-c55fa2d98886"],
  "areaIds": ["331dad88-f8a2-446a-96f8-54542ca697f4"],
  "note": "Transformer fault on MIR-F01, crews are on the way"
}
```

**Responses**

`errors` lists which area or report each 403, 404 or 409 is about.

| Status | When                                   | Message                                    |
| ------ | -------------------------------------- | ------------------------------------------ |
| 201    | Success                                | `Outage confirmed successfully`            |
| 400    | Validation failed                      | `Validation of body failed`                |
| 403    | An area is in another zone             | `These areas aren't in your zone`          |
| 403    | A report is in another zone            | `Some reports aren't in your zone`         |
| 404    | An area doesn't exist or was deleted   | `Area not found`                           |
| 404    | A report doesn't exist                 | `Report not found`                         |
| 409    | An area is already in an active outage | `Some areas already have an active outage` |
| 409    | A given report isn't pending           | `Some reports are no longer pending`       |

---

## Get Outages

`GET /api/v1/outages?…` · Public

Lists [outages](#outage-object), newest first. `meta` holds `page`, `limit` and `total`. Answers
are cached for up to 5 minutes and dropped as soon as an outage or a grid name changes.

**Query**

| Param    | Rules                                                | Default |
| -------- | ---------------------------------------------------- | ------- |
| `page`   | Integer ≥ 1                                          | `1`     |
| `limit`  | Integer 1–50                                         | `10`    |
| `status` | `CONFIRMED`, `ASSIGNED`, `IN_PROGRESS` or `RESTORED` | —       |
| `zoneId` | Zone UUID                                            | —       |
| `areaId` | Area UUID; outages that cover this area              | —       |

**Example**

`GET /api/v1/outages?areaId=331dad88-f8a2-446a-96f8-54542ca697f4&page=1&limit=10`

**Responses**

| Status | When              | Message                        |
| ------ | ----------------- | ------------------------------ |
| 200    | Success           | `Outages fetched successfully` |
| 400    | Validation failed | `Validation of query failed`   |

---

## Get Outage

`GET /api/v1/outages/:id` · Public

Returns one [outage](#outage-object), for its status page. Cached like [Get Outages](#get-outages).

**Responses**

| Status | When                   | Message                       |
| ------ | ---------------------- | ----------------------------- |
| 200    | Success                | `Outage fetched successfully` |
| 400    | Validation failed      | `Validation of params failed` |
| 404    | No outage with this id | `Outage not found`            |

---

## Assign Technician

`PATCH /api/v1/outages/:id/assign` · Zone Manager

Assigns a technician of the zone to an outage in the zone and returns the
[outage](#outage-object) as `ASSIGNED`. Before work starts, the Zone Manager can hand it to another
technician the same way. `technicianId` is the employment id from
[Get Employees](employee.md#get-employees), whose `activeJob` shows who is free.

**Body**

| Field          | Type   | Rules                                                         |
| -------------- | ------ | ------------------------------------------------------------- |
| `technicianId` | string | Required; employment UUID of an active technician in the zone |

**Example**

```json
{
  "technicianId": "4f0f7c2e-8d1a-4b0e-9a55-2f6b1c3d4e66"
}
```

**Responses**

| Status | When                                  | Message                                                     |
| ------ | ------------------------------------- | ----------------------------------------------------------- |
| 200    | Success                               | `Technician assigned successfully`                          |
| 400    | Validation failed                     | `Validation of params failed` / `Validation of body failed` |
| 403    | The outage is in another zone         | `This outage isn't in your zone`                            |
| 403    | The technician is in another zone     | `This technician isn't in your zone`                        |
| 404    | No outage with this id                | `Outage not found`                                          |
| 404    | No active technician with this id     | `Technician not found`                                      |
| 409    | Work has started                      | `Work has started on this outage; it can't be reassigned`   |
| 409    | Already restored                      | `This outage is already restored`                           |
| 409    | Already assigned to this technician   | `This technician is already assigned to this outage`        |
| 409    | The technician has another active job | `This technician already has an active job`                 |
| 409    | The outage changed while assigning    | `This outage changed meanwhile; reload it`                  |

---

## Get Assigned Outages

`GET /api/v1/outages/assigned?…` · Technician

Lists the [outages](#outage-object) assigned to the technician, most recently assigned first.
`meta` holds `page`, `limit` and `total`. An outage handed to another technician leaves this list.

**Query**

| Param    | Rules                                                | Default |
| -------- | ---------------------------------------------------- | ------- |
| `page`   | Integer ≥ 1                                          | `1`     |
| `limit`  | Integer 1–50                                         | `10`    |
| `status` | `CONFIRMED`, `ASSIGNED`, `IN_PROGRESS` or `RESTORED` | —       |

**Responses**

| Status | When              | Message                        |
| ------ | ----------------- | ------------------------------ |
| 200    | Success           | `Outages fetched successfully` |
| 400    | Validation failed | `Validation of query failed`   |

---

## Update Outage Status

`PATCH /api/v1/outages/:id/status` · Technician

Moves the technician's outage forward and returns the [outage](#outage-object). `IN_PROGRESS` sets
`startedAt`, `RESTORED` sets `restoredAt`. `cause` can be sent with either; restoring needs it, sent
now or before.

**Body**

| Field    | Type   | Rules                                                                                               |
| -------- | ------ | --------------------------------------------------------------------------------------------------- |
| `status` | string | Required; `IN_PROGRESS` or `RESTORED`                                                               |
| `cause`  | string | Optional; `TRANSFORMER_FAULT`, `CABLE_DAMAGE`, `EMERGENCY_MAINTENANCE`, `TEMPORARY_TRIP` or `OTHER` |

**Example**

```json
{
  "status": "RESTORED",
  "cause": "CABLE_DAMAGE"
}
```

**Responses**

| Status | When                                  | Message                                                                 |
| ------ | ------------------------------------- | ----------------------------------------------------------------------- |
| 200    | Success                               | `Outage status updated successfully`                                    |
| 400    | Validation failed                     | `Validation of params failed` / `Validation of body failed`             |
| 400    | Restoring without a cause             | `Validation of body failed`                                             |
| 403    | Not assigned to this technician       | `This outage isn't assigned to you`                                     |
| 404    | No outage with this id                | `Outage not found`                                                      |
| 409    | Already in progress                   | `Work on this outage has already started`                               |
| 409    | Already restored                      | `This outage is already restored`                                       |
| 409    | Restoring from `ASSIGNED`, not a trip | `Start work first; only a temporary trip can be restored straight away` |
| 409    | The outage changed while updating     | `This outage changed meanwhile; reload it`                              |
