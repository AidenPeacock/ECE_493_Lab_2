# Tasks: Edit & Publish Schedule Use Case

**Input**: Design documents from `/specs/011-edit-publish-schedule/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: No automated tests requested in the feature specification. Manual testing steps live in `/home/aiden/ECE_493_Lab_2/specs/011-edit-publish-schedule/quickstart.md`.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create base web app structure in `src/index.html`, `src/css/styles.css`, `src/js/011-edit-publish-schedule.js`
- [ ] T002 Add base HTML shell and mounting containers in `src/index.html`
- [ ] T003 [P] Add baseline layout and form styles in `src/css/styles.css`
- [ ] T004 [P] Add JS module scaffolding and init hook in `src/js/011-edit-publish-schedule.js`
- [ ] T005 [P] Confirm display instructions are correct in `/home/aiden/ECE_493_Lab_2/specs/011-edit-publish-schedule/quickstart.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [ ] T006 Define data model helpers for EditPublishScheduleRequest, ScheduleEntry, EditPublishScheduleResult, ValidationError, AuditLogEntry in `src/js/011-edit-publish-schedule.js`
- [ ] T007 Implement LocalStorage adapter for schedule persistence and audit logging in `src/js/011-edit-publish-schedule.js`
- [ ] T008 Implement validation utilities (required fields, time order, room/time collisions) in `src/js/011-edit-publish-schedule.js`
- [ ] T009 Implement error rendering utilities (field-level + summary) in `src/js/011-edit-publish-schedule.js`
- [ ] T010 Implement versioning/idempotency utilities (latest-only publish, double-submit guard) in `src/js/011-edit-publish-schedule.js`
- [ ] T011 Re-run acceptance test generation with updated instructions to refresh `acceptance_tests.md`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Edit & Publish Schedule (Priority: P1) 🎯 MVP

**Goal**: Edit & publish a schedule and persist a new published version when validation passes.

**Independent Test**: Submit a valid schedule and verify the published version is updated and retrievable.

### Implementation for User Story 1

- [ ] T012 [US1] Build schedule editor UI (entries list, add/remove controls) in `src/index.html`
- [ ] T013 [P] [US1] Add labels, helper text, and required markers in `src/index.html`
- [ ] T014 [US1] Implement publish handler (validate, persist, success state, audit log) in `src/js/011-edit-publish-schedule.js`
- [ ] T015 [US1] Implement success state/summary view (version, timestamp) in `src/js/011-edit-publish-schedule.js`
- [ ] T016 [US1] Style primary success state and editor layout in `src/css/styles.css`

**Checkpoint**: User Story 1 is fully functional and testable independently

---

## Phase 4: User Story 2 - Handle Edit & Publish Schedule Exceptions (Priority: P2)

**Goal**: Provide clear guidance when validation or service failures prevent publishing.

**Independent Test**: Trigger validation conflict, save failure, and announcement failure and verify clear errors with no state change.

### Implementation for User Story 2

- [ ] T017 [US2] Add UI toggles for "Simulate Save Failure" and "Simulate Announcement Failure" in `src/index.html`
- [ ] T018 [US2] Implement validation conflict handling and messaging in `src/js/011-edit-publish-schedule.js`
- [ ] T019 [US2] Implement storage/save failure handling (service error, no save, retry required) in `src/js/011-edit-publish-schedule.js`
- [ ] T020 [US2] Implement announcement failure handling (error, no state change, retry required) in `src/js/011-edit-publish-schedule.js`
- [ ] T021 [US2] Implement retry/reset behavior for failed attempts in `src/js/011-edit-publish-schedule.js`
- [ ] T022 [US2] Style error/exception states and toggle controls in `src/css/styles.css`

**Checkpoint**: User Story 2 is fully functional and testable independently

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T023 [P] Verify audit/traceability data is recorded and refresh quickstart via `/speckit.plan` instructions in `/home/aiden/ECE_493_Lab_2/specs/011-edit-publish-schedule/quickstart.md`
- [ ] T024 [P] Clean up UI copy and ensure consistent terminology in `src/index.html`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: Depend on Foundational phase completion
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - no dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational - should be independently testable

### Parallel Opportunities

- Setup tasks marked [P] can run in parallel
- Foundational tasks marked [P] can run in parallel
- Within each story, [P] tasks can run in parallel
- Different user stories can be worked on in parallel after Foundational completes

---

## Parallel Example: User Story 1

```bash
Task: "Build schedule editor UI (entries list, add/remove controls) in src/index.html"
Task: "Add labels, helper text, and required markers in src/index.html"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE** using `/home/aiden/ECE_493_Lab_2/specs/011-edit-publish-schedule/quickstart.md`

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Demo
3. Add User Story 2 → Test independently → Demo
4. Polish for consistency and traceability
