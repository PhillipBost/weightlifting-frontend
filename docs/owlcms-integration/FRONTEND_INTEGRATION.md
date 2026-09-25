# owlcms Frontend Integration Blueprint

This document outlines the UI component architecture, state management, and workflow used in the production owlcms uploader. External developers can use this guide as a direct blueprint for building or adapting an uploader interface within their own applications.

---

## 1. Production Component Locations

The active production components in this repository are:

* **Queue Orchestrator & Dropzone**: [`app/components/owlcms/OwlcmsUploader.tsx`](file:///C:/Users/PB/Desktop/Bost%20Laboratory%20Services/Weightlifting/weightlifting-frontend/app/components/owlcms/OwlcmsUploader.tsx)
* **Governance Hierarchy Cascade**: [`app/components/owlcms/GeographyCascade.tsx`](file:///C:/Users/PB/Desktop/Bost%20Laboratory%20Services/Weightlifting/weightlifting-frontend/app/components/owlcms/GeographyCascade.tsx)
* **Federation Search & Omnisearch Dropdown**: [`app/components/owlcms/FederationSelector.tsx`](file:///C:/Users/PB/Desktop/Bost%20Laboratory%20Services/Weightlifting/weightlifting-frontend/app/components/owlcms/FederationSelector.tsx)
* **TypeScript Types & Enums**: [`types/federation.ts`](file:///C:/Users/PB/Desktop/Bost%20Laboratory%20Services/Weightlifting/weightlifting-frontend/types/federation.ts)

---

## 2. Component Hierarchy & Flow

```
<OwlcmsUploader>
  │
  ├── 1. Dropzone & File Input (Drag & Drop, FileReader JSON parsing)
  │
  ├── 2. Staged Meets Queue (Multi-file staging container)
  │     │
  │     └── <GeographyCascade> (Rendered per staged meet)
  │           │
  │           ├── Competition Scope Selector (Custom Portal Dropdown)
  │           ├── Host Country Selector (Sovereign Nation Typeahead)
  │           │
  │           ├── Associated Federations Tree (5 Cascading Tiers)
  │           │     ├── Tier 1: International Federation (Global Apex)
  │           │     ├── Tier 2: Continental Federation
  │           │     ├── Tier 3: Regional Federation (Multi-Country)
  │           │     ├── Tier 4: National Federation
  │           │     └── Tier 5: State / Provincial Federation
  │           │
  │           ├── Inference Provenance Callout (Itemized source evidence)
  │           └── Additional Upload Notes (Optional review queue trigger)
  │
  └── 3. Action Controls Bar
        ├── Submitter Name & Contact Email inputs
        ├── Dry Run (Test Mode) Toggle
        └── Import / Submit Action Button
```

---

## 3. Key UI Architecture Patterns

### A. Non-Destructive Hierarchy De-Saturation
Instead of hiding irrelevant tiers when a competition scope is selected, higher non-relevant tiers are softly de-saturated (`opacity-60 hover:opacity-100`), while the primary governing tiers are highlighted with semantic border glows and badges. This ensures the full governance lineage remains visible without visual clutter.

### B. Cross-Border Multi-Nation Governance Isolation
To prevent jurisdictional collisions, the UI enforces strict boundaries based on `competition_scope`:
* **International / Continental / Regional (Multi-Country)**:
  Cross-border multi-nation events strictly clear and bypass subordinate National and State/Provincial federations (`None / Not Applicable`).
* **National**:
  National championships automatically enforce `None / Not Applicable (National Event)` across the State/Provincial tier.
* **State / Provincial**:
  Provincial/state championships lock to the governing provincial body (e.g., FHQ) and the parent national body (e.g., WCH).
* **Local**:
  Domestic club invitationals and gym opens de-saturate higher tiers as optional, allowing local host clubs to remain assigned as the meet organizer without false elevation to governing tier status.

### C. Floating Portal Dropdowns (`createPortal`)
Dropdown menus for Competition Scope, Host Country, and Federation Tiers are rendered into `document.body` via React's `createPortal`, using viewport-relative bounding box coordinates (`getBoundingClientRect`). This completely eliminates:
* Card frame expansion or jumping inside scrollable queues.
* Double scrollbars.
* Premature dropdown collapse during internal option scrolling.

### D. 1:1 Inferred Provenance Pills
Whenever the resolver automatically suggests a federation or scope:
1. An `<Inferred>` sparkles badge (`bg-sky-500/15 text-sky-300 border-sky-500/30`) is displayed directly on the tier header.
2. The bottom provenance callout displays an itemized bullet citing the exact matched evidence (e.g., `"Inferred as Pan American Weightlifting Federation (PAWF) (matched from 23 continental delegations)"`).

---

## 4. Minimal Implementation Checklist for External Integrators

If building an uploader interface using these APIs:

1. **File Ingestion**: Read the dropped `.json` file using native JavaScript `FileReader`.
2. **Metadata Extraction**: Parse the JSON and extract:
   * `competitionName`, `competitionDate`, `competitionSite`, `competitionOrganizer`, `competition.federation`.
   * Participating team strings (`sampleTeams`).
   * Distinct competitor nationalities (`athlete_countries`).
3. **Resolve Call**: Issue a `POST /api/federations/resolve` request with the extracted fields.
4. **State Hydration**: Pre-populate your scope selector, host country selector, and federation tiers using the returned `suggested_scope`, `host_country`, and `inferred_*_federation` properties.
5. **Options Querying**: Call `GET /api/federations/options?level=...` to populate the dropdowns when users want to search or change federations.
6. **Submit**: Collect Submitter Name and Contact Email, then `POST /api/owlcms/upload` with the wrapper containing `payload` and `uploaderSelections`.
