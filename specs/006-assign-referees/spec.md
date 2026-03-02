# Feature Specification: Assign Referees Use Case

**Feature Branch**: `006-assign-referees`  
**Created**: 2026-02-08  
**Status**: Draft  
**Input**: User description: "generate specs for all use cases inside use_cases.md"

Before drafting this spec, review `use_cases.md` and incorporate any relevant
project use cases into user scenarios, requirements, and acceptance scenarios.

## User Scenarios & Testing *(mandatory)*

Traceability: Each user story and scenario MUST map to acceptance tests in
`acceptance_tests.md`, and manual test steps MUST explain how to display the
website in a browser.
Generated artifacts MUST NOT be manually edited; re-run the generating commands
with updated instructions instead.

### User Story 1 - Assign Referees (Priority: P1)

A editor wants to assign referees so they can complete their
primary task.

**Why this priority**: This is a core workflow required for the conference
management system.

**Independent Test**: Complete the assign referees flow and verify the
expected outcome.

**Acceptance Scenarios**:

1. **Given** editor is logged in and at least one paper exists to assign, **When** they complete assign referees, **Then** invitations are sent and the assignments are recorded as pending until referees respond.
2. **Given** the user encounters referee would exceed 5 assigned papers, **When** they submit the request, **Then** the system prevents completion and shows a clear error.
3. **Given** the editor assigns fewer than 3 referees, **When** they submit the request, **Then** the system blocks submission and shows an error requiring exactly 3 referees.

---

### User Story 2 - Handle Assign Referees Exceptions (Priority: P2)

A editor wants clear guidance when assign referees fails so they
can recover and complete the task.

**Why this priority**: Error recovery reduces failed attempts and user
frustration.

**Independent Test**: Trigger a validation error and verify the system provides
clear recovery guidance.

**Acceptance Scenarios**:

1. **Given** the user encounters referee email not found/invalid format, **When** they submit the request, **Then** the system prevents completion and shows a clear error.
2. **Given** an invitation delivery failure occurs, **When** they submit the request, **Then** the system shows a delivery-failure error and does not mark the invitation as sent.

---

### Edge Cases

- If referee would exceed 5 assigned papers, the system MUST handle it with a clear error and no state change.
- If referee email not found/invalid format, the system MUST produce a validation error and block completion.
- If editor assigns fewer than 3, the system MUST block completion and indicate three are required.
- If invitation delivery failure, the system MUST report delivery failure and not record the invitation.
- If the request is submitted twice in quick succession, the system MUST handle it idempotently with at most one record created.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow editor to assign referees.
- **FR-002**: The system MUST validate inputs required for assign referees.
- **FR-003**: The system MUST complete assign referees only when validation passes.
- **FR-004**: The system MUST provide clear, actionable error messages when validation fails.
- **FR-005**: The system MUST record the outcome of assign referees for auditing and traceability.
- **FR-006**: The system MUST enforce the special requirement: Each paper must have 3 referees; each referee must not have > 5 assigned papers.
- **FR-007**: On failure, the system MUST ensure: No reviewer assignment is committed if it violates constraints.
- **FR-008**: If fewer than 3 referees are assigned, the system MUST block submission and show an error requiring exactly 3 referees.
- **FR-009**: If an invitation delivery failure occurs, the system MUST show a delivery-failure error and MUST NOT mark the invitation as sent.

### Key Entities *(include if feature involves data)*



- **AssignRefereesRequest**: Represents an assign referees request.
- **AssignRefereesResult**: Represents the outcome of an assign referees request.
- **ValidationError**: Represents a validation error.

### Assumptions

- Error handling follows the extensions listed in the use case.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of users can complete assign referees in under 3 minutes.
- **SC-002**: 100% of validation errors for assign referees are reported with clear messages.
- **SC-003**: At least 90% of users rate the assign referees flow as clear and easy to complete.
- **SC-004**: 100% of successful assign referees actions are recorded for traceability.

## Clarifications

### Session 2026-02-09

- Q: How should the system handle fewer than 3 referees assigned? → A: Block submission and show an error until 3 referees are assigned.
- Q: How should invitation delivery failures be handled? → A: Show delivery-failure error, do not mark invitation as sent, require retry.
