# Schedule

Planned load shedding is published as **slots**: a time window when one feeder, and so every area
on it, is without power. A Zone Manager adds `TENTATIVE` slots for the week ahead as a forecast,
then confirms each day's slots, which become `CONFIRMED`. A slot is never deleted; it's
`CANCELLED` instead, so the history stays.

Anyone can read the schedule. A Zone Manager works only on the feeders of their own zone. Days are Dhaka days (`Asia/Dhaka`,
UTC+6): a slot belongs to the day it starts on.

## Endpoints

`:name` is a path param, `?…` means query params and `{…}` means a request body. Details are in each section.

| Name                          | Endpoint                             | Access       |
| ----------------------------- | ------------------------------------ | ------------ |
| [Get Schedule](#get-schedule) | `GET /api/v1/schedules?…`            | Public       |
| [Create Slot](#create-slot)   | `POST /api/v1/schedules`             | Zone Manager |
| [Update Slot](#update-slot)   | `PATCH /api/v1/schedules/:id`        | Zone Manager |
| [Cancel Slot](#cancel-slot)   | `PATCH /api/v1/schedules/:id/cancel` | Zone Manager |
| [Confirm Day](#confirm-day)   | `POST /api/v1/schedules/confirm`     | Zone Manager |

Every Zone Manager endpoint can also answer:

| Status | When               | Message                                |
| ------ | ------------------ | -------------------------------------- |
| 401    | Token rejected     | See [Tokens](auth.md#tokens)           |
| 403    | Not a Zone Manager | `You don't have permission to do this` |

## Slot Object

Times are returned in UTC; `2026-12-05T03:00:00.000Z` is 9 AM in Dhaka.

```json
{
  "id": "463bc520-f3f5-4bff-8213-85717f251e9c",
  "feederId": "c02da91f-48ee-468f-84cb-11d8f132a562",
  "startsAt": "2026-12-05T03:00:00.000Z",
  "endsAt": "2026-12-05T05:00:00.000Z",
  "status": "TENTATIVE"
}
```

## Slot Times

`startsAt` and `endsAt` are ISO date-times with a time zone, like `2026-12-05T09:00:00+06:00` or
`2026-12-05T03:00:00Z`. A slot must:

- start in the future and within 30 days
- last 15 minutes to 12 hours
- not overlap another slot on the same feeder that isn't cancelled. Slots that only touch (one
  ends as the next starts) are fine

---

## Get Schedule

`GET /api/v1/schedules?…` · Public

Returns the slots on one area, feeder or zone that start on a range of Dhaka days, sorted by start
time. Each [slot](#slot-object) also carries its feeder's `name` and `code`. Cancelled slots are
included, so someone who saw the forecast learns the power stays on; tentative ones are the
forecast, confirmed ones are final. Leave out `from` and `to` for the week ahead from today, or send
today as both for today alone.

Answers are cached for up to 5 minutes and dropped as soon as a slot or the grid changes.

**Query**

| Param      | Rules                                                    | Default        |
| ---------- | -------------------------------------------------------- | -------------- |
| `areaId`   | UUID; send exactly one of `areaId`, `feederId`, `zoneId` | —              |
| `feederId` | UUID                                                     | —              |
| `zoneId`   | UUID; covers every feeder in the zone                    | —              |
| `from`     | A date like `2026-11-29`; past days are fine             | Today in Dhaka |
| `to`       | A date on or after `from`, at most 7 days in all with it | `from` + 6     |

**Example**

`GET /api/v1/schedules?areaId=4c13983d-e6c6-4145-bb9b-da4a85ef8de8&from=2026-11-28&to=2026-11-28`

**Response** (`slots` trimmed to one)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Schedule fetched successfully",
  "data": {
    "from": "2026-11-28",
    "to": "2026-11-28",
    "slots": [
      {
        "id": "880ade28-b8bb-41ca-933c-f534939e3d0e",
        "feederId": "c02da91f-48ee-468f-84cb-11d8f132a562",
        "startsAt": "2026-11-28T02:00:00.000Z",
        "endsAt": "2026-11-28T04:00:00.000Z",
        "status": "TENTATIVE",
        "feeder": { "name": "Mirpur 10", "code": "MIR-F01" }
      }
    ]
  }
}
```

**Responses**

| Status | When                                     | Message                                                  |
| ------ | ---------------------------------------- | -------------------------------------------------------- |
| 200    | Success                                  | `Schedule fetched successfully`                          |
| 400    | Validation failed, or not exactly one id | `Validation of query failed`                             |
| 404    | The area, feeder or zone doesn't exist   | `Area not found` / `Feeder not found` / `Zone not found` |

---

## Create Slot

`POST /api/v1/schedules` · Zone Manager

Adds a `TENTATIVE` slot on a feeder in the Zone Manager's zone and returns the
[slot](#slot-object).

**Body**

| Field      | Type   | Rules                                   |
| ---------- | ------ | --------------------------------------- |
| `feederId` | string | Required; UUID of a feeder in your zone |
| `startsAt` | string | Required; see [Slot Times](#slot-times) |
| `endsAt`   | string | Required; see [Slot Times](#slot-times) |

**Example**

```json
{
  "feederId": "c02da91f-48ee-468f-84cb-11d8f132a562",
  "startsAt": "2026-12-05T09:00:00+06:00",
  "endsAt": "2026-12-05T11:00:00+06:00"
}
```

**Responses**

| Status | When                               | Message                                         |
| ------ | ---------------------------------- | ----------------------------------------------- |
| 201    | Success                            | `Slot created successfully`                     |
| 400    | Validation failed, or bad times    | `Validation of body failed`                     |
| 403    | The feeder is in another zone      | `This feeder isn't in your zone`                |
| 404    | Feeder doesn't exist or is deleted | `Feeder not found`                              |
| 409    | Overlaps a slot on the feeder      | `This slot overlaps another slot on the feeder` |

The overlap error names the other slot's times in `errors`.

---

## Update Slot

`PATCH /api/v1/schedules/:id` · Zone Manager

Moves a tentative slot that hasn't started yet and returns the updated [slot](#slot-object). A
confirmed slot can't be changed, since customers rely on it: cancel it and add a new one.

**Body**

At least one of `startsAt` and `endsAt`. The new window, with the unchanged time kept, must meet
[Slot Times](#slot-times).

**Example**

```json
{
  "endsAt": "2026-12-05T10:30:00+06:00"
}
```

**Responses**

| Status | When                                       | Message                                                          |
| ------ | ------------------------------------------ | ---------------------------------------------------------------- |
| 200    | Success                                    | `Slot updated successfully`                                      |
| 400    | Validation failed, empty body or bad times | `Validation of params failed` / `Validation of body failed`      |
| 403    | The slot is in another zone                | `This slot isn't in your zone`                                   |
| 404    | No slot with this id                       | `Slot not found`                                                 |
| 409    | The slot is confirmed                      | `A confirmed slot can't be changed; cancel it and add a new one` |
| 409    | The slot is cancelled                      | `A cancelled slot can't be changed`                              |
| 409    | The slot has started                       | `This slot has already started`                                  |
| 409    | Overlaps a slot on the feeder              | `This slot overlaps another slot on the feeder`                  |

---

## Cancel Slot

`PATCH /api/v1/schedules/:id/cancel` · Zone Manager

Cancels a tentative or confirmed slot that hasn't started yet and returns it with status
`CANCELLED`. Saved to the audit log. No body.

**Responses**

| Status | When                          | Message                         |
| ------ | ----------------------------- | ------------------------------- |
| 200    | Success                       | `Slot cancelled successfully`   |
| 400    | `id` isn't a UUID             | `Validation of params failed`   |
| 403    | The slot is in another zone   | `This slot isn't in your zone`  |
| 404    | No slot with this id          | `Slot not found`                |
| 409    | The slot is already cancelled | `Slot is already cancelled`     |
| 409    | The slot has started          | `This slot has already started` |

---

## Confirm Day

`POST /api/v1/schedules/confirm` · Zone Manager

Confirms every tentative slot in the Zone Manager's zone that starts on a Dhaka day, all at once.
Returns the day and the slots it confirmed, sorted by start time. Saved to the audit log.

**Body**

| Field  | Type   | Rules                                                       |
| ------ | ------ | ----------------------------------------------------------- |
| `date` | string | Required; a date like `2026-11-29`, today or later in Dhaka |

**Example**

```json
{
  "date": "2026-11-29"
}
```

**Response** (`slots` trimmed to one)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "4 slots confirmed for 2026-11-29",
  "data": {
    "date": "2026-11-29",
    "slots": [
      {
        "id": "392b8e09-610e-4a45-b3eb-1133488d9eb3",
        "feederId": "c02da91f-48ee-468f-84cb-11d8f132a562",
        "startsAt": "2026-11-29T02:00:00.000Z",
        "endsAt": "2026-11-29T04:00:00.000Z",
        "status": "CONFIRMED"
      }
    ]
  }
}
```

**Responses**

| Status | When                             | Message                                     |
| ------ | -------------------------------- | ------------------------------------------- |
| 200    | Success                          | `<n> slots confirmed for <date>`            |
| 400    | Validation failed, or a past day | `Validation of body failed`                 |
| 409    | No tentative slots on that day   | `No tentative slots to confirm on this day` |
