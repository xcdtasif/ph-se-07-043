# Employee

An **employee** is a user's job at the company: `ADMIN`, `ZONE_MANAGER` or `TECHNICIAN`, in one
zone (an admin has none). A user has at most one active employment. Ending it keeps the row as
history, with `endedAt` set.

An admin sees and manages every employee. A Zone Manager sees and manages their zone's technicians.

## Endpoints

`:name` is a path param, `?…` means query params and `{…}` means a request body. Details are in each section.

| Name                              | Endpoint                       | Access              |
| --------------------------------- | ------------------------------ | ------------------- |
| [Get Employees](#get-employees)   | `GET /api/v1/employees?…`      | Zone Manager, Admin |
| [End Employment](#end-employment) | `DELETE /api/v1/employees/:id` | Zone Manager, Admin |

Every endpoint can also answer:

| Status | When                           | Message                                |
| ------ | ------------------------------ | -------------------------------------- |
| 401    | Token rejected                 | See [Tokens](auth.md#tokens)           |
| 403    | Account is banned              | `Your account has been banned`         |
| 403    | Not a Zone Manager or an admin | `You don't have permission to do this` |

## Employee Object

`id` is the employment's id, which [Assign Technician](outage.md#assign-technician) takes.
`activeJob` is the technician's assigned or in-progress outage, so a Zone Manager can see who is
free; it's `null` otherwise.

```json
{
  "id": "4f0f7c2e-8d1a-4b0e-9a55-2f6b1c3d4e66",
  "role": "TECHNICIAN",
  "createdAt": "2026-11-20T10:00:00.000Z",
  "endedAt": null,
  "zone": {
    "id": "37f69231-a572-48a7-ad56-308f66d4a720",
    "name": "Mirpur",
    "code": "MIR"
  },
  "user": {
    "id": "9b2d3e4f-1a2b-4c3d-8e9f-0a1b2c3d4e5f",
    "name": "Technician 01",
    "email": "technician01@example.com"
  },
  "activeJob": {
    "id": "be3cb622-2387-43dc-801c-a30e2a966b18",
    "status": "IN_PROGRESS"
  }
}
```

---

## Get Employees

`GET /api/v1/employees?…` · Zone Manager, Admin

Lists active [employees](#employee-object) by name. `meta` holds `page`, `limit` and `total`. A
Zone Manager always gets their zone's technicians; `role` and `zoneId` only narrow that further.

**Query**

| Param    | Rules                                   | Default |
| -------- | --------------------------------------- | ------- |
| `page`   | Integer ≥ 1                             | `1`     |
| `limit`  | Integer 1–50                            | `10`    |
| `role`   | `ADMIN`, `ZONE_MANAGER` or `TECHNICIAN` | —       |
| `zoneId` | Zone UUID                               | —       |
| `search` | 1–100 characters; matches name or email | —       |

**Example**

`GET /api/v1/employees?role=TECHNICIAN&search=technician&page=1&limit=10`

**Responses**

| Status | When              | Message                          |
| ------ | ----------------- | -------------------------------- |
| 200    | Success           | `Employees fetched successfully` |
| 400    | Validation failed | `Validation of query failed`     |

---

## End Employment

`DELETE /api/v1/employees/:id` · Zone Manager, Admin

Ends an employment and returns the [employee](#employee-object) with `endedAt` set. The user keeps
their account and any customer profile. An admin can end any employment but an admin's; a Zone
Manager can end their zone's technicians'. A technician with an active job must hand it over
first: the Zone Manager [reassigns](outage.md#assign-technician) it, or the technician finishes it.

**Responses**

| Status | When                                      | Message                                                             |
| ------ | ----------------------------------------- | ------------------------------------------------------------------- |
| 200    | Success                                   | `Employment ended successfully`                                     |
| 400    | Validation failed                         | `Validation of params failed`                                       |
| 403    | An admin's employment                     | `An admin's employment can't be ended`                              |
| 403    | Zone Manager, not their zone's technician | `This employee isn't one of your zone's technicians`                |
| 404    | No employee with this id                  | `Employee not found`                                                |
| 409    | Already ended                             | `This employment has already ended`                                 |
| 409    | The technician has an active job          | `This technician has an active job; reassign it or finish it first` |
