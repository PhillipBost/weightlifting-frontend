# IWF International Database Integration Plan

**Last Updated**: 2025-11-02
**Current Phase**: Phase 1 (Foundation & Infrastructure)
**Overall Status**: Not Started

---

## Overview

Integrate IWF international weightlifting data alongside existing USAW data with:
- Separate URL structure: `/athlete/iwf-[id]` and `/meet/iwf-[id]`
- Unified search across both databases with source badges
- Auth-protected Performance Profile cards for IWF athletes
- Both athlete and meet pages for IWF

**Key Decisions:**
- URL prefix approach (`iwf-[id]`): Clean separation without middleware complexity
- Adapter layer: Reuse existing components without modification
- Unified search: Better UX than forcing users to choose database
- Auth for analytics: Protects advanced IWF insights as requested
- Dual Supabase clients: Simplest approach, no connection pooling issues

---

## Phase 1: Foundation & Infrastructure

**Phase Status**: ✅ Complete

### Step 1.1: IWF Schema Discovery
**Status**: ✅ Complete (Nov 4, 2025)
**Goal**: Document IWF database schema and create mapping to USAW structure
**Files**: `docs/IWF_SCHEMA_MAPPING.md`, created `discover-iwf-schema.mjs` (temporary script)
**Completed Tasks**:
- ✅ Created Node.js script to connect to IWF database using credentials from `.env.local`
- ✅ Queried all table names, columns, and sample data (3 rows per table)
- ✅ Documented complete schema structure in `docs/IWF_SCHEMA_MAPPING.md`
- ✅ Created mapping between IWF tables/columns and USAW equivalents
- ✅ Identified and fixed TypeScript interface discrepancies in `lib/supabaseIWF.ts`
- ✅ Fixed database connection issue (was pointing to old test database, now on production IWF database)

**Database Findings**:
- **IWF Database**: Production data with 17,712 lifters, 523 meets, 69,488 competition results (going back to 1998)
- **iwf_lifters table**: 10 columns including `country_code` and `country_name` (important for search)
- **iwf_meets table**: 11 columns with `db_meet_id` foreign key
- **iwf_meet_results table**: 41 columns with comprehensive lift data and pre-calculated analytics
- **Data goes back to 1998 World Championships** with historic Olympic weightlifting data

**Schema Reconciliation**:
- Found and fixed field naming discrepancy: Old interface used `iwf_lifter_id` and `iwf_meet_id`, but actual database uses `db_lifter_id` and `db_meet_id`
- Updated `IWFLifter`, `IWFMeet`, and `IWFMeetResult` interfaces in `lib/supabaseIWF.ts` to match actual schema
- Verified homepage search queries already use correct field names (`country_name`, `db_lifter_id`, `db_meet_id`)
- TypeScript compilation now passes ✅

**Success Criteria Met**: ✅ Complete schema documentation with table-to-table mapping and working types

---

### Step 1.2: Create IWF Supabase Client
**Status**: ✅ Complete
**Goal**: Dual Supabase client system for USAW and IWF databases
**Files**: Create `lib/supabaseIWF.ts`, update `lib/supabase.ts` if needed
**Tasks**:
- Create new Supabase client instance for IWF database
- Export typed client with IWF-specific configuration
- Add TypeScript interfaces for IWF data structures based on schema mapping
- Test connection with simple query

**Success Criteria**: Working IWF client that can query international database

---

### Step 1.3: Create Data Source Type System
**Status**: ✅ Complete
**Goal**: Type-safe system to distinguish USAW vs IWF data throughout app
**Files**: Create `lib/types/dataSource.ts`
**Tasks**:
- Define `DataSource` enum: `'USAW' | 'IWF'`
- Create interfaces for unified athlete/meet data that works with both sources
- Add helper functions: `isUSAW()`, `isIWF()`, `getSourceBadge()`, `getSourceColor()`
- Create URL builder utilities: `buildAthleteUrl(id, source)`, `buildMeetUrl(id, source)`

**Success Criteria**: Reusable type system for multi-source data

---

## Phase 2: Search Integration

**Phase Status**: ✅ Complete

### Step 2.1: Update Search Bar UI
**Status**: ✅ Complete
**Goal**: Add visual indicators for data source in search results
**Files**: `app/page.tsx`
**Tasks**:
- Add small badge/chip to each search result showing "USAW" or "IWF"
- Style badges with distinct colors (e.g., blue for USAW, green for IWF)
- Update search result type definitions to include `source: DataSource`
- No functionality changes yet, just UI preparation

**Success Criteria**: Search results have visual placeholders for source badges

---

### Step 2.2: Add IWF Athlete Search
**Status**: ✅ Complete
**Goal**: Search IWF athletes table alongside USAW lifters
**Files**: `app/page.tsx` (athlete search section)
**Tasks**:
- Import IWF Supabase client
- Add parallel IWF athlete search query for `iwf_lifters` table (db_lifter_id, athlete_name, gender, country, iwf_lifter_id)
- Query with same fuzzy search patterns as USAW
- Tag results with `source: 'IWF'`
- Merge IWF results with USAW results
- **Deduplication Strategy**: Only remove true duplicates with same (database_id, source) pair
  - Preserves same-name athletes from same source (e.g., two Tigran Martirosyans with different db_lifter_id in IWF)
  - Preserves same-name athletes from different sources (e.g., John Smith in both USAW and IWF)
- Sort merged results (exact matches first → by source (USAW first) → alphabetical)
- **Update result display**: IWF results show "Gender • Country • IWF ID#" (e.g., "M • Armenia • #50769") instead of club/membership

**Success Criteria**:
- Typing athlete names returns results from both USAW and IWF databases with source badges
- Same-name athletes (e.g., two Tigran Martirosyans) both appear as separate entries with distinguishing info

---

### Step 2.3: Add IWF Meet Search
**Status**: ✅ Complete
**Goal**: Search IWF meets table alongside USAW meets
**Files**: `app/page.tsx` (meet search section)
**Tasks**:
- Import IWF Supabase client
- Duplicate existing meet search logic for IWF database
- Query IWF meets table with same fuzzy search patterns
- Tag results with `source: 'IWF'`
- Merge IWF results with USAW results
- Handle date format differences if any
- Sort merged results by date (most recent first)

**Success Criteria**: Typing meet names returns results from both USAW and IWF databases with source badges

---

### Step 2.4: Update Search Navigation
**Status**: ✅ Complete
**Goal**: Route search selections to correct URLs based on source
**Files**: `app/page.tsx` (handleSelect functions)
**Tasks**:
- Update athlete result handler to check `source` field
- Route USAW athletes to `/athlete/[id]`
- Route IWF athletes to `/athlete/iwf-[id]`
- Update meet result handler to check `source` field
- Route USAW meets to `/meet/[id]`
- Route IWF meets to `/meet/iwf-[id]`

**Success Criteria**: Clicking search results navigates to correct URL based on data source

---

## Phase 3: IWF Athlete Pages

**Phase Status**: Not Started

### Step 3.1: Create IWF Athlete Route Structure
**Status**: Not Started
**Goal**: Set up Next.js dynamic route for IWF athletes
**Files**: Create `app/athlete/iwf-[id]/page.tsx` (initially minimal)
**Tasks**:
- Create folder structure: `app/athlete/iwf-[id]/`
- Create basic page component that extracts `id` from URL params
- Remove "iwf-" prefix from id parameter to get actual IWF lifter ID
- Add basic loading state and error handling
- Display raw athlete data temporarily (just name and ID)

**Success Criteria**: Navigating to `/athlete/iwf-123` displays a basic page

---

### Step 3.2: Add IWF Athlete Data Fetching
**Status**: Not Started
**Goal**: Query IWF database for athlete profile and competition results
**Files**: `app/athlete/iwf-[id]/page.tsx`
**Tasks**:
- Import IWF Supabase client
- Query IWF athletes table by ID (using schema mapping from Step 1.1)
- Query IWF results table for this athlete (using joins as needed)
- Handle slug-based URLs if IWF supports name slugs
- Transform IWF data structure to match USAW data shape where possible
- Add 404 handling for non-existent athletes

**Success Criteria**: IWF athlete page fetches and displays correct data from IWF database

---

### Step 3.3: Create Data Adapter Layer
**Status**: Not Started
**Goal**: Transform IWF data to work with existing components
**Files**: Create `lib/adapters/iwfAdapter.ts`
**Tasks**:
- Create `adaptIWFAthlete()` function to transform IWF athlete → USAW lifters shape
- Create `adaptIWFResults()` function to transform IWF results → USAW meet_results shape
- Handle missing fields gracefully (e.g., if IWF doesn't have Q-scores)
- Map IWF-specific fields to closest USAW equivalents
- Add null/undefined checks for data integrity

**Success Criteria**: IWF data can be consumed by existing USAW components

---

### Step 3.4: Reuse Athlete Page Components
**Status**: Not Started
**Goal**: Display IWF athlete data using existing chart/table components
**Files**: `app/athlete/iwf-[id]/page.tsx`
**Tasks**:
- Import existing chart components from USAW athlete page
- Pass adapted IWF data to LineChart, BarChart, ScatterChart components
- Reuse table structure for competition history
- Keep layout identical to USAW athlete pages
- Add small "IWF Data" badge/indicator at top of page

**Success Criteria**: IWF athlete page looks visually identical to USAW athlete page

---

### Step 3.5: Add Auth Protection for Performance Profile
**Status**: Not Started
**Goal**: Hide AthleteCard component behind authentication for IWF athletes
**Files**: `app/athlete/iwf-[id]/page.tsx`, potentially `app/components/AthleteCard.tsx`
**Tasks**:
- Import `useAuth()` hook from existing auth system
- Check if user is authenticated
- If authenticated: Show full AthleteCard with all insights
- If not authenticated: Show placeholder/locked state with login prompt
- Add "Sign in to view Performance Profile" message
- Style locked state with lock icon and subtle blur effect

**Success Criteria**: Non-authenticated users see locked Performance Profile; authenticated users see full analytics

---

## Phase 4: IWF Meet Pages

**Phase Status**: Not Started

### Step 4.1: Create IWF Meet Route Structure
**Status**: Not Started
**Goal**: Set up Next.js dynamic route for IWF meets
**Files**: Create `app/meet/iwf-[id]/page.tsx` (initially minimal)
**Tasks**:
- Create folder structure: `app/meet/iwf-[id]/`
- Create basic page component that extracts `id` from URL params
- Remove "iwf-" prefix from id parameter to get actual IWF meet ID
- Add basic loading state and error handling
- Display raw meet data temporarily (just name and date)

**Success Criteria**: Navigating to `/meet/iwf-456` displays a basic page

---

### Step 4.2: Add IWF Meet Data Fetching
**Status**: Not Started
**Goal**: Query IWF database for meet info and results
**Files**: `app/meet/iwf-[id]/page.tsx`
**Tasks**:
- Import IWF Supabase client
- Query IWF meets table by ID (using schema mapping)
- Query IWF results table for all athletes at this meet (with joins)
- Transform data using adapter layer from Step 3.3
- Group results by division/weight class/age group as appropriate
- Add 404 handling for non-existent meets

**Success Criteria**: IWF meet page fetches and displays correct data from IWF database

---

### Step 4.3: Reuse Meet Page Components
**Status**: Not Started
**Goal**: Display IWF meet data using existing division rankings components
**Files**: `app/meet/iwf-[id]/page.tsx`
**Tasks**:
- Import existing table/ranking components from USAW meet page
- Pass adapted IWF data to division tables
- Reuse sorting, filtering, and export functionality
- Update athlete links to point to `/athlete/iwf-[id]` instead of `/athlete/[id]`
- Add small "IWF Meet" badge/indicator at top of page

**Success Criteria**: IWF meet page looks visually identical to USAW meet page with working athlete links

---

## Phase 5: Polish & Edge Cases

**Phase Status**: Not Started

### Step 5.1: Add Loading States
**Status**: Not Started
**Goal**: Smooth loading experience for IWF pages
**Files**: `app/athlete/iwf-[id]/loading.tsx`, `app/meet/iwf-[id]/loading.tsx`
**Tasks**:
- Create skeleton loading components for IWF athlete pages
- Create skeleton loading components for IWF meet pages
- Match existing USAW loading states visually
- Add Suspense boundaries if needed

**Success Criteria**: IWF pages show professional loading states during data fetch

---

### Step 5.2: Update Navigation & Breadcrumbs
**Status**: Not Started
**Goal**: Help users understand when viewing IWF vs USAW data
**Files**: Any pages with navigation components
**Tasks**:
- Add breadcrumbs showing data source (e.g., "Home > IWF Athletes > Name")
- Update any navigation menus to accommodate both sources
- Add source indicator to page titles/headers
- Consider adding toggle to switch between USAW and IWF versions if athlete exists in both (future feature)

**Success Criteria**: Clear visual indicators throughout navigation

---

### Step 5.3: Handle Missing Data Gracefully
**Status**: Not Started
**Goal**: IWF data may have different completeness than USAW
**Files**: All IWF page components, adapter layer
**Tasks**:
- Identify which analytics/metrics might not exist for IWF data
- Add null checks and fallback messages (e.g., "Not available for international data")
- Hide irrelevant sections (e.g., if no club data, hide club card)
- Show helpful messages instead of empty/broken sections
- Test with various IWF athletes to find edge cases

**Success Criteria**: Pages handle incomplete IWF data without breaking

---

### Step 5.4: Update Home Page Messaging
**Status**: Not Started
**Goal**: Explain dual-database system to users
**Files**: `app/page.tsx`
**Tasks**:
- Add brief explanation above search bars: "Search USA Weightlifting and international (IWF) results"
- Update placeholder text to mention both sources
- Consider adding info tooltip explaining difference between USAW and IWF data
- Update any onboarding/help text

**Success Criteria**: Users understand they're searching multiple databases

---

### Step 5.5: SEO & Metadata
**Status**: Not Started
**Goal**: Proper SEO for IWF pages
**Files**: `app/athlete/iwf-[id]/page.tsx`, `app/meet/iwf-[id]/page.tsx`
**Tasks**:
- Add metadata generation for IWF athlete pages (title, description)
- Add metadata generation for IWF meet pages
- Include "International" or "IWF" in page titles for differentiation
- Add appropriate OpenGraph tags
- Test with Next.js metadata API

**Success Criteria**: IWF pages have proper SEO metadata

---

## Phase 6: Testing & Validation

**Phase Status**: Not Started

### Step 6.1: Manual Testing Checklist
**Status**: Not Started
**Goal**: Verify all functionality works correctly
**Tasks**:
- Test searching for known IWF athletes and meets
- Test navigation from search to IWF athlete pages
- Test navigation from search to IWF meet pages
- Test navigation from IWF meet pages to IWF athlete pages
- Test auth protection on Performance Profile card
- Test with both authenticated and unauthenticated users
- Test error states (invalid IDs, network failures)
- Test loading states
- Test on mobile devices

**Success Criteria**: All user flows work as expected

---

### Step 6.2: Performance Verification
**Status**: Not Started
**Goal**: Ensure dual-database queries don't slow down search
**Tasks**:
- Measure search response time with both databases
- Add loading indicators if queries take >500ms
- Consider debouncing or throttling if needed
- Check for any unnecessary re-renders
- Verify Supabase query efficiency

**Success Criteria**: Search remains fast and responsive

---

### Step 6.3: Create Documentation
**Status**: Not Started
**Goal**: Document the dual-database architecture
**Files**: Update `CLAUDE.md`, create `docs/IWF_INTEGRATION.md`
**Tasks**:
- Document URL structure for IWF routes
- Document data adapter layer and how to extend it
- Document environment variables needed for IWF
- Add troubleshooting section
- Update feature list to mention international data

**Success Criteria**: Future developers understand the system

---

## Notes & Blockers

- None yet

---

## Progress Summary

| Phase | Status | Steps Complete |
|-------|--------|-----------------|
| 1: Foundation | ✅ Complete | 3/3 |
| 2: Search | ✅ Complete | 4/4 |
| 3: Athlete Pages | Not Started | 0/5 |
| 4: Meet Pages | Not Started | 0/3 |
| 5: Polish | Not Started | 0/5 |
| 6: Testing | Not Started | 0/3 |
| **TOTAL** | **In Progress** | **7/23** |
