# Data Model: Change Password Use Case

## Entities

### UserAccount
- **id**: Unique identifier
- **email**: User email address (unique)
- **password**: Stored securely (not plaintext)
- **role**: One of author, reviewer, editor, attendee
- **updated_at**: Timestamp

### ChangePasswordRequest
- **id**: Unique identifier
- **current_password**: Submitted current password (transient only)
- **new_password**: Submitted new password (transient only)
- **submitted_at**: Timestamp

### ChangePasswordResult
- **id**: Unique identifier
- **status**: success | validation_failed | update_failed
- **errors**: List of validation errors
- **completed_at**: Timestamp

### ValidationError
- **field**: current_password | new_password
- **code**: incorrect_current | weak_password | update_failed
- **message**: Human-readable error message

## Relationships

- ChangePasswordResult is derived from a ChangePasswordRequest.
- A successful ChangePasswordResult updates UserAccount.password.

## Validation Rules

- Current password MUST match the stored credential for the account.
- New password MUST be at least 8 characters and include at least one letter and
  one number.
- New password MUST differ from the current password.

## State Transitions

- ChangePasswordResult:
  - created -> validation_failed (on validation errors)
  - created -> success (on valid input and successful persistence)
  - created -> update_failed (on persistence errors)
