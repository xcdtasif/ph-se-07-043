# Admin

An admin's view of the whole company: **stats** for the dashboard, and the **audit log** of
critical actions. The admin's other endpoints live with what they manage:
[users](user.md#get-all-users), [payments](payment.md#get-all-payments) and
[outage analytics](analytics.md).

## Endpoints

`:name` is a path param, `?…` means query params and `{…}` means a request body. Details are in each section.

| Name                              | Endpoint                         | Access |
| --------------------------------- | -------------------------------- | ------ |
| [Get Stats](#get-stats)           | `GET /api/v1/admin/stats`        | Admin  |
| [Get Audit Logs](#get-audit-logs) | `GET /api/v1/admin/audit-logs?…` | Admin  |

Every endpoint can also answer:

| Status | When              | Message                                |
| ------ | ----------------- | -------------------------------------- |
| 401    | Token rejected    | See [Tokens](auth.md#tokens)           |
| 403    | Account is banned | `Your account has been banned`         |
| 403    | Not an admin      | `You don't have permission to do this` |

---

## Get Stats

`GET /api/v1/admin/stats` · Admin

Returns the company as it stands now.

- `users`: every account, the banned ones, customers (users with a customer profile), and the
  active employees by role.
- `grid`: zones, feeders and areas that aren't deleted.
- `outages`: every outage by status; `active` ones aren't restored yet.
- `reports`: every outage report by status.
- `hiring`: postings still open to applicants, and every application by status.
- `payments`: every payment by status, and `collected`, the whole taka of the completed ones.

Each status list has every status, with `0` for none.

```json
{
  "users": {
    "total": 18,
    "banned": 1,
    "customers": 7,
    "technicians": 5,
    "zoneManagers": 2,
    "admins": 1
  },
  "grid": { "zones": 3, "feeders": 6, "areas": 14 },
  "outages": {
    "active": 3,
    "byStatus": { "CONFIRMED": 1, "ASSIGNED": 1, "IN_PROGRESS": 1, "RESTORED": 10 }
  },
  "reports": { "PENDING": 3, "LINKED": 4, "DISMISSED": 1 },
  "hiring": {
    "openPostings": 3,
    "applications": {
      "PAYMENT_PENDING": 2,
      "SUBMITTED": 7,
      "SHORTLISTED": 2,
      "HIRED": 1,
      "REJECTED": 2
    }
  },
  "payments": {
    "byStatus": { "PENDING": 0, "COMPLETED": 12, "FAILED": 2 },
    "collected": 7700
  }
}
```

**Responses**

| Status | When    | Message                      |
| ------ | ------- | ---------------------------- |
| 200    | Success | `Stats fetched successfully` |

---

## Get Audit Logs

`GET /api/v1/admin/audit-logs?…` · Admin

Lists the audit log, newest first. `meta` holds `page`, `limit` and `total`. Each entry is written
in the same transaction as the change it records, so the log never misses one or records one that
was rolled back.

- `actor` is who acted, or `null` when the system did (a payment completed by Stripe's webhook).
- `entityType` and `entityId` name the changed record.
- `before` and `after` hold the fields that changed, or `null` when there's nothing to show (a new
  outage has no `before`).

| `action`                     | `entityType`  | Written when                                     |
| ---------------------------- | ------------- | ------------------------------------------------ |
| `USER_BANNED`                | `USER`        | An admin bans a user                             |
| `USER_UNBANNED`              | `USER`        | An admin unbans a user                           |
| `ZONE_DELETED`               | `ZONE`        | An admin deletes a zone                          |
| `FEEDER_DELETED`             | `FEEDER`      | An admin deletes a feeder                        |
| `AREA_DELETED`               | `AREA`        | An admin deletes an area                         |
| `SLOT_CANCELLED`             | `SLOT`        | A Zone Manager cancels a load shedding slot      |
| `SCHEDULE_DAY_CONFIRMED`     | `ZONE`        | A Zone Manager confirms a day's slots            |
| `OUTAGE_CONFIRMED`           | `OUTAGE`      | A Zone Manager confirms an outage                |
| `OUTAGE_ASSIGNED`            | `OUTAGE`      | A Zone Manager assigns or reassigns a technician |
| `OUTAGE_STATUS_CHANGED`      | `OUTAGE`      | A technician starts work or restores power       |
| `EMPLOYMENT_ENDED`           | `EMPLOYEE`    | An employment is ended                           |
| `PAYMENT_COMPLETED`          | `PAYMENT`     | Stripe's webhook completes a payment             |
| `APPLICATION_STATUS_CHANGED` | `APPLICATION` | An application is shortlisted, hired or rejected |
| `EMPLOYEE_HIRED`             | `EMPLOYEE`    | A hire creates an employee                       |

**Query**

| Param        | Rules                                | Default |
| ------------ | ------------------------------------ | ------- |
| `page`       | Integer ≥ 1                          | `1`     |
| `limit`      | Integer 1–50                         | `20`    |
| `actorId`    | User UUID                            | —       |
| `action`     | One of the actions above             | —       |
| `entityType` | One of the entity types above        | —       |
| `entityId`   | UUID; one record's history           | —       |
| `from`       | First day (Dhaka), like `2026-11-01` | —       |
| `to`         | Last day, on or after `from`         | —       |

**Example**

`GET /api/v1/admin/audit-logs?entityType=APPLICATION&from=2026-11-01`

```json
[
  {
    "id": "d9683593-9cd7-436a-a3ec-24b6fb5c35c3",
    "action": "APPLICATION_STATUS_CHANGED",
    "entityType": "APPLICATION",
    "entityId": "c85279cf-4c80-474e-9348-7f3324524a5a",
    "before": { "status": "SUBMITTED" },
    "after": { "status": "SHORTLISTED" },
    "createdAt": "2026-11-25T19:01:15.009Z",
    "actor": {
      "id": "3a0a5a32-b66a-41e5-a3fa-7213fc8e5ea0",
      "name": "Zone Manager 01",
      "email": "zonemanager01@example.com"
    }
  }
]
```

**Responses**

| Status | When              | Message                           |
| ------ | ----------------- | --------------------------------- |
| 200    | Success           | `Audit logs fetched successfully` |
| 400    | Validation failed | `Validation of query failed`      |
