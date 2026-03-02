# Data Model: Save Submission Draft

## Entities

### SaveSubmissionDraftRequest
- **id**: Unique identifier
- **payload**: Submitted inputs for the workflow
- **submitted_at**: Timestamp

### SaveSubmissionDraftResult
- **id**: Unique identifier
- **status**: success | validation_failed | storage_failed
- **errors**: List of validation errors
- **completed_at**: Timestamp

### ValidationError
- **field**: Name of the input field
- **code**: Validation error code
- **message**: Human-readable error message

## Relationships

- SaveSubmissionDraftResult is derived from a SaveSubmissionDraftRequest.
- A SaveSubmissionDraftResult may include zero or more ValidationError entries.

## Validation Rules

- Required fields MUST be present for the workflow.
- Inputs MUST satisfy format and business rules defined in the spec.

## State Transitions

- SaveSubmissionDraftResult:
  - created -> validation_failed (on validation errors)
  - created -> success (on valid input and successful persistence)
  - created -> storage_failed (on persistence errors)
