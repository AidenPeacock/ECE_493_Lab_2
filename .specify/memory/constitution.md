<!--
Sync Impact Report
- Version change: 1.0.0 → 1.1.0
- Modified principles:
  - Documentation Sources Of Truth → Documentation Sources Of Truth (expanded requirements location)
  - Acceptance-Driven Validation → Acceptance-Driven Validation (added no-manual-edits rule)
  - Manual Test & Display Instructions → Manual Test & Display Instructions (unchanged title)
  - Vanilla Web Stack Only → Vanilla Web Stack Only (unchanged title)
  - Standard Web Architecture → Standard Web Architecture (unchanged title)
- Added sections: None
- Removed sections: None
- Templates requiring updates:
  - ✅ .specify/templates/plan-template.md
  - ✅ .specify/templates/spec-template.md
  - ✅ .specify/templates/tasks-template.md
  - ⚠ .specify/templates/commands/*.md (directory not present)
- Follow-up TODOs:
  - TODO(RATIFICATION_DATE): adoption date not found in repo
-->
# Conference Management System (CMS) Constitution

## Core Principles

### Documentation Sources Of Truth
All requirements artifacts MUST live in `/home/aiden/ECE_493_Lab_2`. Use cases
MUST be in the consolidated `use_cases.md`, user stories MUST remain in
`user_stories.md`, scenarios MUST remain in `scenarios.md`, and acceptance tests
MUST remain in `acceptance_tests.md`. Any change to requirements MUST update the
corresponding artifact and keep cross-references consistent. Rationale: the
project is graded and validated against these artifacts, so they are the
authoritative source of truth.

### Vanilla Web Stack Only
The application MUST be implemented using vanilla HTML, CSS, and JavaScript. No
frameworks, bundlers, or transpilers are allowed unless explicitly approved in
the constitution. Rationale: the project scope requires standard web
architectures and direct, inspectable source assets.

### Standard Web Architecture
The codebase MUST follow standard web architecture conventions: semantic HTML
structure, CSS for presentation, and JavaScript for behavior with a clear
separation of concerns. The primary entry point MUST be a directly viewable web
page (e.g., `index.html`). Rationale: maintainability and manual evaluation depend
on predictable, conventional structure.

### Manual Test & Display Instructions
Every deliverable MUST include detailed, step-by-step instructions explaining
how to display the website and how to manually test core flows. These
instructions MUST be kept current with each change. Rationale: manual grading
requires reproducible verification steps.

### Acceptance-Driven Validation
User stories and scenarios MUST map to acceptance tests, and acceptance tests
MUST be updated when behavior changes. If a requirement is ambiguous, it MUST be
marked for clarification rather than guessed. Generated artifacts MUST NOT be
manually edited; re-run the generating commands with updated instructions
instead. Rationale: consistent traceability prevents scope drift and enables
reliable evaluation.

## Documentation & Traceability

- The authoritative requirements files are located at
  `/home/aiden/ECE_493_Lab_2` and are:
  - `use_cases.md`
  - `user_stories.md`
  - `scenarios.md`
  - `acceptance_tests.md`
- If a future `acceptance.md` file is introduced to match external guidance, it
  MUST be kept in sync with `acceptance_tests.md` or replace it explicitly via a
  constitution amendment.
- All feature specs and plans MUST cite the relevant use cases, user stories,
  scenarios, and acceptance tests they implement.
- Optional but helpful: Each use case SHOULD be implemented in its own git
  branch to preserve traceability.

## Delivery Workflow & Quality Gates

- Each feature MUST include manual display and testing steps in
  `specs/.../quickstart.md` or a project-level `README.md` if present.
- The UI MUST remain usable without build steps or special tooling beyond a
  standard web browser.
- Any change that affects a requirement MUST be reflected in the documentation
  artifacts and acceptance tests before completion.

## Governance

- This constitution supersedes all other guidance.
- Amendments MUST include a rationale, an impact summary, and any required
  documentation updates.
- Versioning follows semantic versioning:
  - MAJOR for breaking governance or principle removals/redefinitions.
  - MINOR for new principles or materially expanded guidance.
  - PATCH for clarifications or non-semantic refinements.
- All specs and plans MUST include a constitution compliance check.

**Version**: 1.1.0 | **Ratified**: TODO(RATIFICATION_DATE): adoption date not found in repo | **Last Amended**: 2026-02-08
