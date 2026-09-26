# owlcms Integration Architecture & Developer Guide

This directory contains the technical documentation, API specifications, and frontend integration blueprints for importing competition results from **owlcms** (v1.0 and v2.0 JSON exports) into the weightlifting analytics platform.

---

## 1. System Architecture Overview

The integration follows a client-assisted ingestion architecture where raw owlcms JSON files are inspected by the platform's resolver API to determine governance scope and governing federations before final submission.

<details>
<summary><b>Click to expand: End-to-End Operational Architecture Diagram</b></summary>
<br>

```mermaid
flowchart TD
    %% 1. Input & Parsing
    Step1["<b>1. File Selection</b><br/>User drops or selects standard owlcms JSON file"]
    Step2["<b>2. Client-Side Extraction</b><br/>Uploader parses: <code>competitionName</code>, <code>competitionSite</code>,<br/><code>competitionOrganizer</code>, participating teams, competitor nationalities"]
    Step1 --> Step2

    %% 2. Resolution Call
    Step3["<b>3. Resolution Request</b><br/><code>POST /api/federations/resolve</code><br/><i>Sends extracted meet facts and athlete country list</i>"]
    Step2 --> Step3

    %% 3. Resolver Internal Heuristics
    Step4["<b>4. Automated Jurisdiction Engine</b><br/>• Multi-national delegation corroboration (athlete countries vs. team codes)<br/>• Title demonym matching ('Canadian', 'du Québec', 'Panamericano')<br/>• Geographic venue address parsing & OpenStreetMap Photon geocoding<br/>• Multi-tier governance isolation enforcement"]
    Step3 --> Step4

    %% 4. Inference Return & Display
    Step5["<b>5. Inference Response (200 OK)</b><br/>Returns: <code>suggested_scope</code>, <code>host_country</code>,<br/>and inferred federations across all 5 tiers with provenance citations"]
    Step6["<b>6. Interactive UI Hydration</b><br/>Renders 5-tier cascade, highlighting primary governing bodies<br/>and applying <code>&lt;Inferred&gt;</code> sparkles badges"]
    Step4 --> Step5
    Step5 --> Step6

    %% 5. Optional Dropdown Search
    Step7{"<b>7. User Review</b><br/>Are detected scope &<br/>federations accepted?"}
    Step6 --> Step7

    Step8["<b>7b. Dropdown Query (Optional)</b><br/><code>GET /api/federations/options?level=...&q=...</code><br/>Searches living registry by name or acronym to select alternate body"]
    Step7 -- "No (User edits a tier)" --> Step8
    Step8 --> Step6

    %% 6. Submitter Form & Upload
    Step9["<b>8. Submitter Attribution & Confirmation</b><br/>User enters Submitter Name & Contact Email<br/><i>(Optional Dry-Run toggle for simulation)</i>"]
    Step7 -- "Yes (Confirm selections)" --> Step9

    Step10["<b>9. Ingestion Request</b><br/><code>POST /api/owlcms/upload</code><br/><i>Submits raw owlcms JSON + uploaderSelections + submitter info</i>"]
    Step9 --> Step10

    %% 7. Server-side Processing
    Step11["<b>10. Ingestion Processing</b><br/>• Validates submitter name & email format<br/>• Computes SHA-256 payload hash for duplicate meet prevention<br/>• Ingests competition metadata, athlete roster & attempt history<br/>• Stages in Quarantine Queue (<code>pending_review</code>) if notes/local"]
    Step10 --> Step11

    %% 8. Final Result
    Step12["<b>11. Success Response (200 OK)</b><br/>Returns <code>meetId</code> (UUID), <code>status</code>, and processed counts<br/>UI displays confirmation card with summary"]
    Step11 --> Step12

    %% Styling
    style Step1 fill:#f8fafc,stroke:#64748b,stroke-width:1.5px
    style Step3 fill:#f0f9ff,stroke:#0284c7,stroke-width:1.5px
    style Step4 fill:#f0fdf4,stroke:#16a34a,stroke-width:1.5px
    style Step8 fill:#fefce8,stroke:#ca8a04,stroke-width:1.5px
    style Step10 fill:#faf5ff,stroke:#9333ea,stroke-width:1.5px
    style Step11 fill:#f0fdf4,stroke:#16a34a,stroke-width:1.5px
    style Step12 fill:#ecfdf5,stroke:#059669,stroke-width:2px
```

</details>

---

## 2. Core Capabilities

### A. Zero-Modification JSON Ingestion
The platform accepts standard, unaltered owlcms JSON export files (v1.0 and v2.0). Meet directors do not need to edit, reformat, or add synthetic properties to their files before uploading.

### B. Autonomous Scope & Federation Resolution
Using competition metadata, venue tokens, and athlete country distributions, the resolver endpoint (`/api/federations/resolve`) automatically determines:
1. **Competition Scope**:
   * `International` (Apex global competitions sanctioned by IWF, UMWF, IMWA, or Olympic Games).
   * `Continental` (Championships under a continental confederation, e.g., PAWF, EWF, AWF, WFA, OWF).
   * `Regional (Multi-Country)` (Cross-border regional championships, e.g., South American, Commonwealth, Nordic, Mediterranean).
   * `National` (Country-wide championships under a national governing federation, e.g., USAW, WCH).
   * `State / Provincial` (Subdivision championships, e.g., FHQ, Ontario, Florida WSO).
   * `Local` (Club invitationals, opens, and developmental meets).
2. **Host Country**: Resolved from direct country tokens, national demonyms, athlete distributions, or venue geocoding.
3. **Governing Federation Tiers**: Automatically mapped to persistent, verified records in the living federation registry.

### C. Attribution & Quality Control
* **Submitter Identity**: All live submissions require a valid **Submitter Name** and **Contact Email**.
* **Dry-Run Testing**: Integrators can test uploads at any time using `dryRun: true` (or the `X-Dry-Run: true` header) to validate data and preview resolution results without writing to the database.
* **Review Queueing**: Meets with ambiguous metadata or unlisted local organizations are safely staged in the Quarantine / Review Queue (`status = 'pending_review'`) for administrative verification before public indexing.

---

## 3. Propagation of System Changes

* **Propagates Automatically (Zero Client Updates Required)**:
  * When new federations, state/provincial associations, or clubs are added to the database registry, they immediately appear in search dropdowns (`/api/federations/options`).
  * When resolver heuristics are refined (e.g., smarter multilingual title recognition or venue matching), the client uploader immediately receives the enhanced inferences without any frontend code changes.
* **Stable Contracts**:
  * The API request and response schemas are strictly version-controlled and backward-compatible.
  * Fields will not be removed or renamed without advance deprecation notices.

---

## 4. Documentation Index

* **[API Reference](file:///C:/Users/PB/Desktop/Bost%20Laboratory%20Services/Weightlifting/weightlifting-frontend/docs/owlcms-integration/API_REFERENCE.md)**: Detailed technical specifications for all three endpoints (`resolve`, `options`, `upload`), including request/response schemas, query parameters, and error codes.
* **[Frontend Integration Blueprint](file:///C:/Users/PB/Desktop/Bost%20Laboratory%20Services/Weightlifting/weightlifting-frontend/docs/owlcms-integration/FRONTEND_INTEGRATION.md)**: Component architecture, UI state flow, and reference code for building or embedding the interactive uploader tool.
