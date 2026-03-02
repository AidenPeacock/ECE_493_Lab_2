# Data Model: Register User Account Use Case

## Entities

### RegisterUserAccountRequest
- **id**: Unique identifier
- **email**: Submitted email
- **password**: Submitted password (transient only)
- **role**: One of author, reviewer, editor, attendee
- **submitted_at**: Timestamp

### RegisterUserAccountResult
- **id**: Unique identifier
- **status**: success | validation_failed | storage_failed
- **errors**: List of validation errors
- **completed_at**: Timestamp

### UserAccount
- **id**: Unique identifier
- **email**: User email address (unique)
- **password**: Stored securely (not plaintext)
- **role**: One of author, reviewer, editor, attendee
- **created_at**: Timestamp

### ValidationError
- **field**: email | password | role
- **code**: invalid_format | already_registered | weak_password | storage_failure
- **message**: Human-readable error message

## Relationships

- RegisterUserAccountResult is derived from RegisterUserAccountRequest.
- A successful RegisterUserAccountResult creates a UserAccount.
- RegisterUserAccountResult may include zero or more ValidationError entries.

## Validation Rules

- Email MUST be present and follow standard email format.
- Email MUST be unique against existing UserAccount records.
- Password MUST be at least 8 characters and include at least one letter and
  one number.
- Role MUST be one of author, reviewer, editor, attendee.

## State Transitions

- RegisterUserAccountResult:
  - created -> validation_failed (on validation errors)
  - created -> success (on valid input and successful persistence)
  - created -> storage_failed (on persistence errors)
