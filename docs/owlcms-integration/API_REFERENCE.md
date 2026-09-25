# owlcms Integration API Reference

This document provides technical specifications for the three REST endpoints powering the owlcms meet ingestion workflow.

---

## Endpoint 1: Scope & Federation Resolver

### `POST /api/federations/resolve`

Analyzes raw meet metadata extracted from an owlcms JSON export to programmatically determine the competition scope, host country, and governing federation hierarchy.

#### Request Headers
| Header | Value | Required | Description |
|---|---|---|---|
| `Content-Type` | `application/json` | Yes | Request payload format |

#### Request Body Schema

```json
{
  "competition_name": "Championnat Senior du Québec 2024",
  "competition_date": "2024-04-20",
  "competition_site": "Centre Multisports C.A.-Gauvin, Saint-Hyacinthe, QC",
  "city_text": "Saint-Hyacinthe",
  "host_country_text": "CAN",
  "organizer_text": "Club La Machine Rouge",
  "federation_text": "Fédération d'haltérophilie du Québec",
  "team_names": ["LMR", "GÉANTS", "FORCE VIVE"],
  "athlete_countries": ["CAN"]
}
```

##### Field Definitions

| Field | Type | Description |
|---|---|---|
| `competition_name` | string | Full title of the competition as recorded in owlcms. |
| `competition_date` | string (ISO-8601) | Date of competition (`YYYY-MM-DD`). |
| `competition_site` | string | Free-text venue name or street address. |
| `city_text` | string (optional) | City where the competition occurred. |
| `host_country_text` | string (optional) | Country token or ISO code if explicitly present in the file. |
| `organizer_text` | string (optional) | Name of the host club or organizing committee (`competition.competitionOrganizer`). |
| `federation_text` | string (optional) | Federation string if present in the meet file (`competition.federation`). |
| `team_names` | string[] (optional) | List of distinct club/team codes or names participating in the meet. |
| `athlete_countries` | string[] (optional) | List of ISO-3 sovereign country codes represented across participating athletes. |

---

#### Response Schema (`200 OK`)

```json
{
  "success": true,
  "suggested_scope": "state_provincial",
  "has_derived_scope": true,
  "scope_inference_source": "matched provincial championship title \"du Québec\"",
  "host_country": {
    "status": "matched",
    "match": {
      "id": "c0a80123-0000-0000-0000-000000000001",
      "canonical_name": "Canada",
      "short_code": null,
      "country_code": "CAN",
      "level": "national",
      "is_verified": true,
      "match_rank": 100
    },
    "source": "venue: Canadian postal code"
  },
  "inferred_continental_federation": {
    "id": "a1b2c3d4-0000-0000-0000-000000000001",
    "canonical_name": "Pan American Weightlifting Federation",
    "short_code": "PAWF",
    "country_code": null,
    "level": "continental",
    "is_verified": true,
    "match_rank": 95
  },
  "inferred_national_federation": {
    "id": "b2c3d4e5-0000-0000-0000-000000000002",
    "canonical_name": "Weightlifting Canada Haltérophilie",
    "short_code": "WCH",
    "country_code": "CAN",
    "level": "national",
    "is_verified": true,
    "match_rank": 100
  },
  "inferred_regional_federation": {
    "id": "c3d4e5f6-0000-0000-0000-000000000003",
    "canonical_name": "Fédération d'haltérophilie du Québec",
    "short_code": "FHQ",
    "country_code": "CAN",
    "level": "regional_state_wso",
    "is_verified": true,
    "match_rank": 100
  },
  "inferred_regional_federation_source": "matched state/province \"Québec\" in meet title",
  "caveats": []
}
```

##### Response Properties

| Property | Type | Description |
|---|---|---|
| `suggested_scope` | enum | Inferred competition scope: `'international'`, `'continental'`, `'regional'`, `'national'`, `'state_provincial'`, `'local'`, or `'unknown'`. |
| `has_derived_scope` | boolean | `true` if scope was derived from verified sanctioning evidence; `false` if defaulted to `'local'`. |
| `scope_inference_source` | string | Human-readable explanation of why the scope was assigned. |
| `host_country` | object | Resolved sovereign host country record with ISO-3 code. |
| `inferred_international_federation` | object (nullable) | Apex global governing body (e.g., IWF, UMWF, IMWA) if applicable. |
| `inferred_continental_federation` | object (nullable) | Continental confederation (e.g., PAWF, EWF) if applicable. |
| `inferred_national_federation` | object (nullable) | National governing federation (e.g., USAW, WCH) for the host country. |
| `inferred_regional_federation` | object (nullable) | Subordinate regional or state/provincial federation (e.g., FHQ, Ontario, Florida WSO). |
| `inferred_regional_federation_source` | string | Source citation for provincial/state inference. |

---

## Endpoint 2: Federation Options & Search

### `GET /api/federations/options`

Retrieves active, verified federations from the platform's living registry. Used to populate cascading dropdown selectors or support typeahead search when a user wants to select or adjust a governing body.

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `level` | string | No | null | Comma-separated federation level filter. Supported values:<br>• `global_international`<br>• `continental`<br>• `intercontinental_regional,regional`<br>• `national`<br>• `regional_state_wso`<br>• `club` |
| `parent_id` | string (UUID) | No | null | Filters child members belonging to a specific parent federation. |
| `q` | string | No | null | Search query string (matches canonical names, aliases, and acronyms). |
| `as_of_date` | string (date) | No | current | ISO-8601 date (`YYYY-MM-DD`) for Point-in-Time temporal validity filtering. |
| `limit` | integer | No | `50` | Maximum results to return (max `200`). |
| `offset` | integer | No | `0` | Pagination offset. |

#### Response Schema (`200 OK`)

```json
{
  "items": [
    {
      "id": "c3d4e5f6-0000-0000-0000-000000000003",
      "canonical_name": "Fédération d'haltérophilie du Québec",
      "short_code": "FHQ",
      "country_code": "CAN",
      "level": "regional_state_wso"
    },
    {
      "id": "d4e5f6a7-0000-0000-0000-000000000004",
      "canonical_name": "Ontario Weightlifting Association",
      "short_code": "OWA",
      "country_code": "CAN",
      "level": "regional_state_wso"
    }
  ],
  "total": 2
}
```

---

## Endpoint 3: Meet Ingestion & Upload

### `POST /api/owlcms/upload`

Submits the complete owlcms competition dataset along with submitter attribution and confirmed governance metadata.

#### Request Headers

| Header | Value | Required | Description |
|---|---|---|---|
| `Content-Type` | `application/json` | Yes | Request payload format |
| `X-Submitter-Name` | string | Optional* | Submitter full name (*if not provided in body) |
| `X-Submitter-Email` | string | Optional* | Submitter contact email (*if not provided in body) |
| `X-Dry-Run` | `true` or `false` | No | Enables test mode without writing to database |
| `X-File-Name` | string | No | Original filename (e.g., `meet_2026.json`) |

---

#### Request Body Format

The endpoint accepts a JSON wrapper containing submitter attribution, confirmed governance selections, and the raw owlcms JSON payload:

```json
{
  "submitterName": "Alex Mercer",
  "submitterEmail": "alex.mercer@club.org",
  "fileName": "owlcmsDatabase_2026-08-15_21h59_v2.json",
  "dryRun": false,
  "uploaderSelections": {
    "competition_scope": "state_provincial",
    "host_country_code": "CAN",
    "continent_id": "a1b2c3d4-0000-0000-0000-000000000001",
    "country_id": "b2c3d4e5-0000-0000-0000-000000000002",
    "regional_id": null,
    "organizer_id": "c3d4e5f6-0000-0000-0000-000000000003",
    "additional_notes": "Provincial youth records contested."
  },
  "payload": {
    "competition": {
      "competitionName": "Championnat Senior du Québec 2024",
      "competitionDate": "2024-04-20",
      "competitionSite": "Centre Multisports C.A.-Gauvin, Saint-Hyacinthe, QC",
      "competitionOrganizer": "Club La Machine Rouge"
    },
    "athletes": [
      ...
    ]
  }
}
```

##### Field Specifications

| Field | Type | Required | Description |
|---|---|---|---|
| `submitterName` | string | **Yes** | Full name of the submitter for attribution. |
| `submitterEmail` | string | **Yes** | Valid contact email for validation and receipt. |
| `fileName` | string | No | Original filename of the owlcms export. |
| `dryRun` | boolean | No | If `true`, validates and simulates resolution without database writes. |
| `uploaderSelections` | object | No | Confirmed governance hierarchy and scope selections. |
| `payload` | object | **Yes** | The complete, unaltered owlcms JSON export object (v1.0 or v2.0). |

##### `uploaderSelections` Properties

| Property | Type | Description |
|---|---|---|
| `competition_scope` | enum | `'international'`, `'continental'`, `'regional'`, `'national'`, `'state_provincial'`, `'local'`. |
| `host_country_code` | string | ISO-3 country code for the host nation. |
| `continent_id` | string (UUID) | Selected Continental Confederation ID (or `null`). |
| `regional_id` | string (UUID) | Selected Regional (Multi-Country) Federation ID (or `null`). |
| `country_id` | string (UUID) | Selected National Federation ID (or `null`). |
| `organizer_id` | string (UUID) | Selected State / Provincial Federation or Host Club ID (or `null`). |
| `additional_notes` | string | Optional notes explaining edge cases. Queue upload for review if supplied. |

---

#### Response Formats

##### A. Successful Live Upload (`200 OK`)
```json
{
  "success": true,
  "meetId": "7b8e1f5c-3a21-4f9a-8b1e-6c2e8a1d4f09",
  "status": "pending_review",
  "dryRun": false,
  "athletesProcessed": 48,
  "resultsProcessed": 48,
  "meet": {
    "name": "Championnat Senior du Québec 2024",
    "startDate": "2024-04-20",
    "venue": "Centre Multisports C.A.-Gauvin, Saint-Hyacinthe, QC"
  }
}
```

##### B. Successful Dry-Run Simulation (`200 OK`)
```json
{
  "success": true,
  "dryRun": true,
  "message": "Dry-run validation successful. No records were written to the database.",
  "athletesProcessed": 48,
  "resultsProcessed": 48,
  "detectedScope": "state_provincial",
  "inferredFederation": "Fédération d'haltérophilie du Québec (FHQ)"
}
```

##### C. Missing Attribution Error (`400 Bad Request`)
```json
{
  "success": false,
  "error": "Submitter name is required for anonymous uploads."
}
```

##### D. Duplicate Detection (`409 Conflict`)
```json
{
  "success": false,
  "error": "A meet with identical athletes and results has already been uploaded.",
  "existingMeetId": "3c9a2e1d-4f8b-4a1e-8b1e-7b8e1f5c3a21"
}
```
