# AGENTS.md — Operational Boundaries & Guidelines

## 1. Scope & Separation of Concerns

### Frontend Domain (`weightlifting-frontend`)
- **Core Focus**: Next.js 15 App Router pages, React 19 UI components, Tailwind styling, client-side state management, and frontend API routes under `app/api/`.
- **Boundaries**:
  - Does **not** execute database DDL migrations, alter tables, or create database triggers directly.
  - Does **not** manage or run backend background daemons or scrapers.
  - Prepares structured, context-rich handoff specifications for any database schema, RPC, or daemon requirements needed from the backend.

### Backend Domain (`weightlifting-database`)
- **Core Focus**: PostgreSQL schemas, migrations, RPC functions, indexes, and database-level integrity.
- **Boundaries**:
  - Manages and executes background workers, pipeline runners, event daemons (`owlcms-event-daemon.js`, `link-new-owlcms-athletes.js`), and scraping infrastructure.
  - Provides query endpoints and RPCs for the frontend application.

---

## 2. Universal Agent Protocols

1. **Explicit Approval Required for State Mutations**: Never execute database modifications, file edits, or write/delete operations without first presenting the exact technical change to the user and waiting for explicit permission.
2. **Handle Command Denials & Explanation Requests Strictly**: Break down every argument and flag, explain read/write/network impact, and wait for explicit permission before taking further action.
3. **No Unsolicited Browser Sessions**: Do not call browser subagents unless explicitly requested.
4. **No Apologies**: Focus entirely on technical corrections without expressing regret or apology.
5. **Action-Bound Commitments**: Any conversational commitment to a future rule or workflow MUST be accompanied by a concrete proposed edit to AGENTS.md in the same response.
6. **Local Eastern Time Standard**: All timestamps presented to the user must be explicitly converted to Eastern Time (EDT/EST).
7. **Change & Architecture Tracking**:
   - Significant fixes, added features, or structural changes are appended to `CHANGELOG.md` under `[Fixed]`, `[Added]`, or `[Changed]`.
   - The living system map in `AGENTS.md` or `ARCHITECTURE.md` is updated only when a structural component is permanently added or changed.
