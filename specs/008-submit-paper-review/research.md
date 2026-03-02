# Phase 0 Research: Submit Paper Review Use Case

## Decisions

### Decision 1: Client-side persistence for demo
**Decision**: Store workflow data and outcomes in browser LocalStorage.
**Rationale**: The feature must run in a standard browser with no build steps
and no backend dependencies. LocalStorage provides a simple, inspectable
persistence mechanism aligned with the vanilla web constraint.
**Alternatives considered**:
- In-memory only (lost on refresh, weak for traceability requirements)
- Backend database (violates no-backend dependency for the demo scope)

### Decision 2: Error messaging strategy
**Decision**: Provide inline, field-level error messages and a summary banner on
submission failure.
**Rationale**: Improves clarity for manual testing and aligns with the
requirement for actionable error messages.
**Alternatives considered**:
- Single generic error message (insufficient guidance)
- Modal-only errors (less accessible and slower to test)

### Decision 3: Manual test focus
**Decision**: Define manual test steps for the primary flow and key exceptions.
**Rationale**: Required by the constitution and supports grading.
**Alternatives considered**:
- Automated-only tests (not required and adds tooling complexity)
