# Data Model: Edit & Publish Schedule

## Entities

### EditPublishScheduleRequest
- **id**: Unique identifier
- **schedule_id**: Identifier of the schedule being edited
- **version**: Integer version for optimistic ordering
- **entries**: List of schedule entries to publish
- **submitted_at**: Timestamp

### ScheduleEntry
- **entry_id**: Unique identifier for the scheduled item
- **title**: Display title
- **room**: Room identifier/name
- **start_time**: ISO-8601 local date-time
- **end_time**: ISO-8601 local date-time

### EditPublishScheduleResult
- **id**: Unique identifier
- **schedule_id**: Identifier of the schedule
- **version**: New version if publish succeeds
- **status**: success | validation_failed | storage_failed | announcement_failed
- **errors**: List of validation errors
- **completed_at**: Timestamp

### ValidationError
- **field**: Name of the input field
- **code**: Validation error code
- **message**: Human-readable error message

### AuditLogEntry
- **id**: Unique identifier
- **schedule_id**: Identifier of the schedule
- **status**: success | validation_failed | storage_failed | announcement_failed
- **summary**: Short description of outcome
- **recorded_at**: Timestamp

## Relationships

- EditPublishScheduleResult is derived from an EditPublishScheduleRequest.
- An EditPublishScheduleResult may include zero or more ValidationError entries.
- AuditLogEntry is created for each submission attempt.

## Validation Rules

- Required fields MUST be present for the workflow.
- `entries` MUST be non-empty for publish.
- `start_time` MUST be earlier than `end_time`.
- No two entries in the same `room` may overlap in time.

## State Transitions

- EditPublishScheduleResult:
  - created -> validation_failed (on validation errors)
  - created -> success (on valid input and successful persistence)
  - created -> storage_failed (on persistence errors)
  - created -> announcement_failed (on publish/announcement errors)
