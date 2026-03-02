# Research: Edit & Publish Schedule

## Decisions

### 1) Failure Simulation in LocalStorage Demo
- **Decision**: Provide explicit UI toggles to simulate storage/save failure and notification/announcement failure during manual testing.
- **Rationale**: The spec references failure modes that do not naturally occur in a LocalStorage-only demo. A toggle makes failures deterministic and testable without external dependencies.
- **Alternatives considered**: Randomized failures (rejected due to non-deterministic tests), developer console flags only (rejected due to manual test burden).

### 2) Validation Conflict Definition
- **Decision**: Treat overlapping time ranges in the same room as a validation conflict (room/time collision).
- **Rationale**: This matches the spec example and provides a clear, testable rule for conflict detection.
- **Alternatives considered**: Broader conflict rules (e.g., speaker overlap), rejected for MVP scope.

### 3) Audit/Traceability Record Format
- **Decision**: Persist a compact audit log entry per submission in LocalStorage with timestamp, status, schedule version, and error summary.
- **Rationale**: Meets traceability requirements while keeping the demo lightweight.
- **Alternatives considered**: Full history of schedule diff (rejected for complexity).
