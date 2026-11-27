# Grid

The grid is how the company splits its network: a **zone** (e.g. Mirpur) has **feeders** (e.g.
`MIR-F01`), and each feeder supplies **areas** (e.g. Mirpur 10, Block C). Customers pick an area,
schedules are set per feeder, and Zone Managers and Technicians work in one zone.

Anyone can read the grid. Only an admin can change it.

**Deleting is soft.** A deleted zone, feeder or area disappears from every read and can't be used
again, but its row stays for history, and its code or name is free for a new one. A delete is
refused while something still depends on the row: a zone with feeders or employees, a feeder with
areas or upcoming load shedding slots, an area with customers. Every delete is saved to the audit
log with the admin who made it.

## Endpoints

`:name` is a path param, `?…` means query params and `{…}` means a request body. Details are in each section.

| Name                                | Endpoint                     | Access |
| ----------------------------------- | ---------------------------- | ------ |
| [Get All Zones](#get-all-zones)     | `GET /api/v1/zones`          | Public |
| [Create Zone](#create-zone)         | `POST /api/v1/zones`         | Admin  |
| [Update Zone](#update-zone)         | `PATCH /api/v1/zones/:id`    | Admin  |
| [Delete Zone](#delete-zone)         | `DELETE /api/v1/zones/:id`   | Admin  |
| [Get All Feeders](#get-all-feeders) | `GET /api/v1/feeders?…`      | Public |
| [Create Feeder](#create-feeder)     | `POST /api/v1/feeders`       | Admin  |
| [Update Feeder](#update-feeder)     | `PATCH /api/v1/feeders/:id`  | Admin  |
| [Delete Feeder](#delete-feeder)     | `DELETE /api/v1/feeders/:id` | Admin  |
| [Get All Areas](#get-all-areas)     | `GET /api/v1/areas?…`        | Public |
| [Create Area](#create-area)         | `POST /api/v1/areas`         | Admin  |
| [Update Area](#update-area)         | `PATCH /api/v1/areas/:id`    | Admin  |
| [Delete Area](#delete-area)         | `DELETE /api/v1/areas/:id`   | Admin  |

**Admin errors.** Every admin endpoint can also answer:

| Status | When           | Message                                |
| ------ | -------------- | -------------------------------------- |
| 401    | Token rejected | See [Tokens](auth.md#tokens)           |
| 403    | Not an admin   | `You don't have permission to do this` |

**Names and codes.** Names are 2–100 characters, trimmed. Codes are 2–20 letters and digits,
optionally split by single hyphens (`MIR`, `MIR-F01`). They're stored uppercase, so `mir-f01`
becomes `MIR-F01`.

---

## Get All Zones

`GET /api/v1/zones` · Public

Lists every zone, sorted by name.

**Response data**

```json
[
  { "id": "397aade3-5166-4d30-9cf0-0548b521bc7c", "name": "Dhanmondi", "code": "DHN" },
  { "id": "9e44d2cc-5b66-4ed1-be49-39774a53d965", "name": "Mirpur", "code": "MIR" },
  { "id": "5c8a17c6-3382-4939-97c5-525e39488094", "name": "Uttara", "code": "UTT" }
]
```

**Responses**

| Status | When    | Message                      |
| ------ | ------- | ---------------------------- |
| 200    | Success | `Zones fetched successfully` |

---

## Create Zone

`POST /api/v1/zones` · Admin

Creates a zone and returns it, shaped like one item of [Get All Zones](#get-all-zones).

**Body**

| Field  | Type   | Rules                                   |
| ------ | ------ | --------------------------------------- |
| `name` | string | Required; a name                        |
| `code` | string | Required; a code no other zone is using |

**Example**

```json
{
  "name": "Gulshan",
  "code": "GUL"
}
```

**Responses**

| Status | When                      | Message                            |
| ------ | ------------------------- | ---------------------------------- |
| 201    | Success                   | `Zone created successfully`        |
| 400    | Validation failed         | `Validation of body failed`        |
| 409    | Another zone has the code | `This zone code is already in use` |

---

## Update Zone

`PATCH /api/v1/zones/:id` · Admin

Renames a zone, changes its code, or both, and returns the updated zone.

**Body**

At least one field, with the rules of [Create Zone](#create-zone).

**Example**

```json
{
  "name": "Gulshan & Banani"
}
```

**Responses**

| Status | When                             | Message                                                     |
| ------ | -------------------------------- | ----------------------------------------------------------- |
| 200    | Success                          | `Zone updated successfully`                                 |
| 400    | Validation failed, or empty body | `Validation of params failed` / `Validation of body failed` |
| 404    | No zone with this id, or deleted | `Zone not found`                                            |
| 409    | Another zone has the code        | `This zone code is already in use`                          |

---

## Delete Zone

`DELETE /api/v1/zones/:id` · Admin

Soft deletes a zone. Returns no `data`.

**Responses**

| Status | When                             | Message                             |
| ------ | -------------------------------- | ----------------------------------- |
| 200    | Success                          | `Zone deleted successfully`         |
| 400    | `id` isn't a UUID                | `Validation of params failed`       |
| 404    | No zone with this id, or deleted | `Zone not found`                    |
| 409    | The zone still has feeders       | `Delete this zone's feeders first`  |
| 409    | The zone still has employees     | `End this zone's employments first` |

---

## Get All Feeders

`GET /api/v1/feeders?…` · Public

Lists feeders, sorted by code.

**Query**

| Param    | Rules                               | Default |
| -------- | ----------------------------------- | ------- |
| `zoneId` | UUID; only the feeders of this zone | —       |

**Example**

`GET /api/v1/feeders?zoneId=9e44d2cc-5b66-4ed1-be49-39774a53d965`

**Response data**

```json
[
  {
    "id": "bef019b8-b0af-450a-9178-6ce767774820",
    "zoneId": "9e44d2cc-5b66-4ed1-be49-39774a53d965",
    "name": "Mirpur 10",
    "code": "MIR-F01"
  }
]
```

**Responses**

| Status | When              | Message                        |
| ------ | ----------------- | ------------------------------ |
| 200    | Success           | `Feeders fetched successfully` |
| 400    | Validation failed | `Validation of query failed`   |

---

## Create Feeder

`POST /api/v1/feeders` · Admin

Adds a feeder to a zone and returns it, shaped like one item of
[Get All Feeders](#get-all-feeders).

**Body**

| Field    | Type   | Rules                                     |
| -------- | ------ | ----------------------------------------- |
| `zoneId` | string | Required; UUID of a zone                  |
| `name`   | string | Required; a name                          |
| `code`   | string | Required; a code no other feeder is using |

**Example**

```json
{
  "zoneId": "9e44d2cc-5b66-4ed1-be49-39774a53d965",
  "name": "Kazipara",
  "code": "MIR-F03"
}
```

**Responses**

| Status | When                             | Message                              |
| ------ | -------------------------------- | ------------------------------------ |
| 201    | Success                          | `Feeder created successfully`        |
| 400    | Validation failed                | `Validation of body failed`          |
| 404    | Zone doesn't exist or is deleted | `Zone not found`                     |
| 409    | Another feeder has the code      | `This feeder code is already in use` |

---

## Update Feeder

`PATCH /api/v1/feeders/:id` · Admin

Renames a feeder, changes its code, or both, and returns the updated feeder. A feeder can't move
to another zone, since that would move its areas and their customers too.

**Body**

At least one of `name` and `code`, with the rules of [Create Feeder](#create-feeder).

**Example**

```json
{
  "code": "MIR-F04"
}
```

**Responses**

| Status | When                               | Message                                                     |
| ------ | ---------------------------------- | ----------------------------------------------------------- |
| 200    | Success                            | `Feeder updated successfully`                               |
| 400    | Validation failed, or empty body   | `Validation of params failed` / `Validation of body failed` |
| 404    | No feeder with this id, or deleted | `Feeder not found`                                          |
| 409    | Another feeder has the code        | `This feeder code is already in use`                        |

---

## Delete Feeder

`DELETE /api/v1/feeders/:id` · Admin

Soft deletes a feeder. Returns no `data`.

**Responses**

| Status | When                               | Message                                     |
| ------ | ---------------------------------- | ------------------------------------------- |
| 200    | Success                            | `Feeder deleted successfully`               |
| 400    | `id` isn't a UUID                  | `Validation of params failed`               |
| 404    | No feeder with this id, or deleted | `Feeder not found`                          |
| 409    | The feeder still has areas         | `Delete this feeder's areas first`          |
| 409    | The feeder has upcoming slots      | `Cancel this feeder's upcoming slots first` |

---

## Get All Areas

`GET /api/v1/areas?…` · Public

Lists areas sorted by name, one page at a time, each with its feeder and zone. Customers search
here for their area. `meta` holds `page`, `limit` and `total` (areas matching the filters).

**Query**

| Param      | Rules                                                  | Default |
| ---------- | ------------------------------------------------------ | ------- |
| `page`     | Integer ≥ 1                                            | `1`     |
| `limit`    | Integer 1–100                                          | `20`    |
| `search`   | Matches the area name, ignoring case; 1–100 characters | —       |
| `zoneId`   | UUID; only the areas of this zone                      | —       |
| `feederId` | UUID; only the areas of this feeder                    | —       |

**Example**

`GET /api/v1/areas?search=block&zoneId=9e44d2cc-5b66-4ed1-be49-39774a53d965&page=1&limit=20`

**Response** (`data` trimmed to one area)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Areas fetched successfully",
  "data": [
    {
      "id": "67217b6d-bd86-4395-93f3-293aa1e7bc8e",
      "name": "Mirpur 10, Block C",
      "feeder": {
        "id": "bef019b8-b0af-450a-9178-6ce767774820",
        "name": "Mirpur 10",
        "code": "MIR-F01",
        "zone": {
          "id": "9e44d2cc-5b66-4ed1-be49-39774a53d965",
          "name": "Mirpur",
          "code": "MIR"
        }
      }
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 4 }
}
```

**Responses**

| Status | When              | Message                      |
| ------ | ----------------- | ---------------------------- |
| 200    | Success           | `Areas fetched successfully` |
| 400    | Validation failed | `Validation of query failed` |

---

## Create Area

`POST /api/v1/areas` · Admin

Adds an area to a feeder and returns it, shaped like one item of [Get All Areas](#get-all-areas).

**Body**

| Field      | Type   | Rules                                                           |
| ---------- | ------ | --------------------------------------------------------------- |
| `feederId` | string | Required; UUID of a feeder                                      |
| `name`     | string | Required; a name no other area of the feeder has, ignoring case |

**Example**

```json
{
  "feederId": "bef019b8-b0af-450a-9178-6ce767774820",
  "name": "Mirpur 10, Block D"
}
```

**Responses**

| Status | When                                    | Message                                          |
| ------ | --------------------------------------- | ------------------------------------------------ |
| 201    | Success                                 | `Area created successfully`                      |
| 400    | Validation failed                       | `Validation of body failed`                      |
| 404    | Feeder doesn't exist or is deleted      | `Feeder not found`                               |
| 409    | Another area of the feeder has the name | `This feeder already has an area with this name` |

---

## Update Area

`PATCH /api/v1/areas/:id` · Admin

Renames an area and returns it. An area can't move to another feeder, since that would change its
customers' schedules and outages.

**Body**

| Field  | Type   | Rules                                                           |
| ------ | ------ | --------------------------------------------------------------- |
| `name` | string | Required; a name no other area of the feeder has, ignoring case |

**Example**

```json
{
  "name": "Mirpur 10, Block D (East)"
}
```

**Responses**

| Status | When                                    | Message                                                     |
| ------ | --------------------------------------- | ----------------------------------------------------------- |
| 200    | Success                                 | `Area updated successfully`                                 |
| 400    | Validation failed                       | `Validation of params failed` / `Validation of body failed` |
| 404    | No area with this id, or deleted        | `Area not found`                                            |
| 409    | Another area of the feeder has the name | `This feeder already has an area with this name`            |

---

## Delete Area

`DELETE /api/v1/areas/:id` · Admin

Soft deletes an area. Returns no `data`.

**Responses**

| Status | When                              | Message                                       |
| ------ | --------------------------------- | --------------------------------------------- |
| 200    | Success                           | `Area deleted successfully`                   |
| 400    | `id` isn't a UUID                 | `Validation of params failed`                 |
| 404    | No area with this id, or deleted  | `Area not found`                              |
| 409    | Customers have this as their area | `Customers are still registered in this area` |
