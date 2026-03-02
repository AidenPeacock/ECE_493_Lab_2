# Phase 0 Research: Log In Use Case

## Decisions

### Decision 1: Client-side persistence for demo
**Decision**: Store user accounts and login outcomes in browser LocalStorage for
the demo.
**Rationale**: The feature must run in a standard browser with no build steps
and no backend dependencies. LocalStorage provides a simple, inspectable
persistence mechanism aligned with the vanilla web constraint.
**Alternatives considered**:
- In-memory only (lost on refresh, weak for traceability requirements)
- Backend database (violates no-backend dependency for the demo scope)

### Decision 2: Invalid-credentials detection
**Decision**: Treat invalid credentials as either email/username not found or
password mismatch and show a single generic invalid-credentials error.
**Rationale**: Aligns with clarified requirements and avoids leaking account
existence details.
**Alternatives considered**:
- Separate error messages per failure (could enable account enumeration)

### Decision 3: Service unavailable handling
**Decision**: On authentication/database unavailability, show a
service-unavailable error, create no session, and require retry later.
**Rationale**: Matches clarified requirements and keeps behavior explicit for
manual testing.
**Alternatives considered**:
- Silent retry (unclear to users)

### Decision 4: Error messaging strategy
**Decision**: Provide inline, field-level error messages and a summary banner on
submission failure.
**Rationale**: Improves clarity for manual testing and aligns with the
requirement for actionable error messages.
**Alternatives considered**:
- Single generic error message (insufficient guidance)
- Modal-only errors (less accessible and slower to test)
