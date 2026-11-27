# Analytics

**Outage analytics** sum up the [outages](outage.md) confirmed within a range of days: how many,
what caused them, how long assigning and restoring took, which areas were off longest, and how
the range's outage reports were handled. Days are Dhaka calendar days.

A Zone Manager sees their own zone. An admin sees one zone, or the whole company with each zone's
numbers side by side.

## Endpoints

`:name` is a path param, `?…` means query params and `{…}` means a request body. Details are in each section.

| Name                                          | Endpoint                          | Access              |
| --------------------------------------------- | --------------------------------- | ------------------- |
| [Get Outage Analytics](#get-outage-analytics) | `GET /api/v1/analytics/outages?…` | Zone Manager, Admin |

Every endpoint can also answer:

| Status | When                           | Message                                |
| ------ | ------------------------------ | -------------------------------------- |
| 401    | Token rejected                 | See [Tokens](auth.md#tokens)           |
| 403    | Account is banned              | `Your account has been banned`         |
| 403    | Not a Zone Manager or an admin | `You don't have permission to do this` |

## Outage Analytics Object

- `zone` is the zone reported on, or `null` for the whole company.
- `outages` counts the outages confirmed in the range. `active` ones aren't restored yet.
  `avgAssignMinutes` runs from confirming to assigning a technician, and `avgRestorationMinutes`
  from confirming to restoring; each is `null` when no outage got that far.
- `byStatus` and `byCause` list every status and cause, with `0` for none. `byCause` counts
  restored outages, since the technician sets the cause when restoring.
- `reports` counts the outage reports made in the range, by their status now.
- `daily` has one entry per day in the range, empty days included.
- `topAreas` lists the 10 areas that were off longest. An outage counts once in each area it
  covered, and one still active counts until now.
- `byZone` gives each zone's numbers for the whole company, and is `null` when one zone is
  reported on.

```json
{
  "zone": null,
  "from": "2026-10-29",
  "to": "2026-11-27",
  "outages": {
    "total": 5,
    "active": 3,
    "restored": 2,
    "avgAssignMinutes": 23,
    "avgRestorationMinutes": 173
  },
  "byStatus": { "CONFIRMED": 1, "ASSIGNED": 1, "IN_PROGRESS": 1, "RESTORED": 2 },
  "byCause": {
    "TRANSFORMER_FAULT": 1,
    "CABLE_DAMAGE": 0,
    "EMERGENCY_MAINTENANCE": 0,
    "TEMPORARY_TRIP": 1,
    "OTHER": 0
  },
  "reports": { "PENDING": 3, "LINKED": 4, "DISMISSED": 1 },
  "daily": [
    { "date": "2026-10-29", "outages": 0 },
    { "date": "2026-11-27", "outages": 3 }
  ],
  "topAreas": [
    {
      "id": "36da5706-e93f-4e64-8910-62d454fd6a11",
      "name": "Mirpur 10, Block C",
      "feederCode": "MIR-F01",
      "zoneCode": "MIR",
      "outages": 1,
      "minutesOff": 300
    }
  ],
  "byZone": [
    {
      "id": "82b58a20-452e-4901-a7b6-0c05739b7448",
      "name": "Mirpur",
      "code": "MIR",
      "outages": 4,
      "active": 2,
      "avgRestorationMinutes": 173
    }
  ]
}
```

`daily`, `topAreas` and `byZone` are shortened here.

---

## Get Outage Analytics

`GET /api/v1/analytics/outages?…` · Zone Manager, Admin

Returns the [outage analytics](#outage-analytics-object) for a range of Dhaka days, both included.
A Zone Manager gets their own zone, with or without `zoneId`.

**Query**

| Param    | Rules                                                                                | Default                 |
| -------- | ------------------------------------------------------------------------------------ | ----------------------- |
| `zoneId` | Zone UUID. An admin without it gets the whole company; a Zone Manager only their own | The Zone Manager's zone |
| `from`   | First day, like `2026-11-01`                                                         | 29 days before `to`     |
| `to`     | Last day, on or after `from`; at most 366 days in all                                | Today (Dhaka)           |

**Example**

`GET /api/v1/analytics/outages?from=2026-11-01&to=2026-11-30`

**Responses**

| Status | When                                   | Message                                      |
| ------ | -------------------------------------- | -------------------------------------------- |
| 200    | Success                                | `Outage analytics fetched successfully`      |
| 400    | Validation failed                      | `Validation of query failed`                 |
| 403    | Zone Manager, another zone's `zoneId`  | `You can only see your own zone's analytics` |
| 404    | No zone with this `zoneId`, or deleted | `Zone not found`                             |
