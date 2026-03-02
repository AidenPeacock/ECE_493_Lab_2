# Specification Validation:


# UC-01 Register User Account

## Validation Result
**PASS** — The feature specification generally repeats UC-01 without semantic changes.

## Flow Consistency
- Main success flow matches UC-01 steps exactly.
- All extensions are preserved:
  - Invalid email
  - Duplicate email
  - Password rule violation
  - Database failure (acknowledged via edge cases / minimal guarantees)

## Functional Requirements
- FR-001 through FR-007 are directly derived from UC-01 steps and guarantees.
- No new behavior, constraints, or features introduced.
- Requirements are fully congruent with the use case.

## Acceptance Coverage
- Acceptance scenarios map directly to AT-UC01-01 through AT-UC01-04.
- Database failure aligns with AT-UC01-05 and UC-01 minimal guarantees.

## Errors / Comments
- Edge cases are listed only as questions and are not expanded into full scenarios.
- The single use case is split into two user stories (happy path vs. error recovery). This is unconventional, since error handling is typically part of the same user goal rather than a separate user desire.

## Conclusion
The specification accurately restates UC-01 (flows and intent) with only stylistic and structural changes. It satisfies the Lab 2 specification validation requirement.




# Specification Validation: UC-02 Log In

## Flow Consistency
- The main success flow is mostly consistent with UC-02 (login -> validation -> session -> redirect).
- Invalid credentials handling aligns with UC-02 E1.

## Functional Requirement
- FR-005 (audit/traceability) is not stated or implied in UC-02 and introduces new behavior.
- FR-002 is vague compared to UC-02’s explicit credential comparison.
- All other FRs are generally consistent with UC-02 minimal and success guarantees.

## Acceptance Coverage
- No acceptance scenario maps to AT-UC02-03 (database unavailable).
- Acceptance scenario for account locked/disabled has no corresponding use case or acceptance test.

## Errors / Comments
- Account locked/disabled is included as a user story, acceptance scenario, and edge case, but is explicitly not specified in UC-02 and should be omitted.
- Database unavailable (E3) is only listed as an edge case and is missing from acceptance scenarios, despite being a documented UC-02 extension.
- The use case is split into separate user stories for success vs. error handling, which is unconventional and unnecessary.

## Conclusion
The specification partially restates UC-02 but adds unsupported functionality and omits a required extension flow.






# Specification Validation: UC-03 Change Password

## Flow Consistency
- The main success flow aligns with UC-03 (authenticated user -> submit current + new password -> update -> confirm).
- Handling of incorrect current password aligns with UC-03 E1.
- Handling of new password violating security standards aligns with UC-03 E2.

## Functional Requirement
- FR-005 (audit/traceability) is not stated or implied in UC-03 and introduces new behavior.
- Other functional requirements are generally consistent with UC-03 success and minimal guarantees.

## Acceptance Coverage
- No acceptance scenario maps to AT-UC03-04 (database update failure).
- Acceptance scenarios do not fully cover all documented UC-03 extensions.

## Errors / Comments
- Database update failure (E3) is listed only as an edge case and is missing from acceptance scenarios, despite being a documented UC-03 extension.
- The use case is split into separate user stories for success vs. error handling, which is unconventional; error flows are typically part of the same user goal.

## Conclusion
The specification largely restates UC-03 but adds unsupported requirements and omits a required extension flow.





# Specification Validation: UC-04 Submit Paper Manuscript

## Flow Consistency
- The main success flow aligns with UC-04 (author logged in → fill metadata + upload file → validation → store submission → success message).
- Handling of missing/blank required fields aligns with UC-04 E1.
- Handling of invalid file type aligns with UC-04 E2.

## Functional Requirement
- FR-005 (audit/traceability) is not stated or implied in UC-04 and introduces new behavior.
- Other functional requirements are generally consistent with UC-04 success and minimal guarantees.
- File type and size constraints in FR-006 correctly reflect UC-04 special requirements.

## Acceptance Coverage
- No acceptance scenario maps to UC-04 E3 (file too large > 7MB).
- No acceptance scenario maps to UC-04 E4 (upload/storage failure).
- Acceptance scenarios do not fully cover all documented UC-04 extensions.

## Errors / Comments
- File too large and storage failure extensions are only listed as edge cases and are missing from acceptance scenarios.
- The use case is split into separate user stories for success vs. error handling, which is unconventional; error flows are typically part of the same user goal.

## Conclusion
The specification largely restates UC-04 but adds unsupported requirements and omits required extension flows.





# Specification Validation: UC-05 Save Submission Draft

## Flow Consistency
- The main success flow aligns with UC-05 (author logged in → on submission form → save → draft stored and retrievable).
- Handling of invalid draft values aligns with UC-05 E1.
- Handling of database unavailable aligns with UC-05 E2.

## Functional Requirement
- FR-005 (audit/traceability) is not stated or implied in UC-05 and introduces new behavior.
- Other functional requirements are generally consistent with UC-05 success and minimal guarantees.

## Acceptance Coverage
- Acceptance scenarios map to UC-05 main flow and both documented extensions (invalid draft values, database unavailable).
- No documented UC-05 flows are missing from acceptance coverage.

## Errors / Comments
- The use case is split into separate user stories for success vs. error handling, which is unconventional; error flows are typically part of the same user goal.
- Edge case regarding rapid repeated submission is not specified in UC-05 and is appropriately left as a question.

## Conclusion
The specification largely restates UC-05 but adds an unsupported audit/traceability requirement. Otherwise, the flows and acceptance coverage are consistent with the use case.






# Specification Validation: UC-06 Assign Referees

## Flow Consistency
- The main success flow aligns with UC-06 (editor logged in → select paper → enter referee emails → invitations sent → assignments recorded).
- Handling of referee overload (>5 assigned papers) aligns with UC-06 E1.
- Handling of invalid/unknown referee email aligns with UC-06 E2.

## Functional Requirement
- FR-005 (audit/traceability) is not stated or implied in UC-06 and introduces new behavior.
- Other functional requirements are generally consistent with UC-06 success, minimal guarantees, and special requirements.
- FR-006 correctly reflects UC-06 referee-count and workload constraints.

## Acceptance Coverage
- No acceptance scenario maps to UC-06 E3 (editor assigns fewer than 3 referees).
- No acceptance scenario maps to UC-06 E4 (email delivery failure).
- Acceptance scenarios do not fully cover all documented UC-06 extensions.

## Errors / Comments
- Extensions for assigning fewer than three referees and email delivery failure are only listed as edge cases and are missing from acceptance scenarios.
- The use case is split into separate user stories for success vs. error handling, which is unconventional; error flows are typically part of the same user goal.

## Conclusion
The specification largely restates UC-06 but adds an unsupported audit/traceability requirement and omits required extension flows.






# Specification Validation: UC-07 Accept/Reject Review Invitation

## Flow Consistency
- The main success flow aligns with UC-07 (referee receives invitation → accepts → paper appears in referee account; reviewer count tracked).
- Handling of invitation rejection aligns with UC-07 E1.
- Handling of reviewer count exceeding three aligns with UC-07 E2 (notification of violation).

## Functional Requirement
- FR-005 (audit/traceability) is not stated or implied in UC-07 and introduces new behavior.
- Other functional requirements are generally consistent with UC-07 success and minimal guarantees.

## Acceptance Coverage
- No acceptance scenario maps to UC-07 E3 (expired or invalid invitation).
- Acceptance scenario for rejection incorrectly treats rejection as an error; in UC-07, rejection is a valid alternate flow, not a failure.
- Acceptance scenarios do not fully cover all documented UC-07 extensions.

## Errors / Comments
- Rejecting an invitation is modeled as an error case, but in UC-07 it is a valid, supported outcome.
- Extension for expired/invalid invitation is only listed as an edge case and is missing from acceptance scenarios.
- The use case is split into separate user stories for success vs. error handling, which is unconventional; error and alternate flows are typically part of the same user goal.

## Conclusion
The specification partially restates UC-07 but misclassifies a valid alternate flow as an error, adds an unsupported audit/traceability requirement, and omits a required extension flow.





# Specification Validation: UC-08 Submit Paper Review

## Flow Consistency
- The main success flow aligns with UC-08 (referee logged in → invitation accepted → review form completed → review stored).
- Handling of attempting to review without accepting an invitation aligns with UC-08 E1.
- Handling of invalid review form input aligns with UC-08 E2.

## Functional Requirement
- FR-005 (audit/traceability) is not stated or implied in UC-08 and introduces new behavior.
- Other functional requirements are generally consistent with UC-08 success and minimal guarantees.

## Acceptance Coverage
- No acceptance scenario maps to UC-08 E3 (database/save failure).
- No acceptance scenario explicitly maps to UC-08 E4 (review saved but editor decision remains unavailable until all three reviews are complete).
- Acceptance scenarios do not fully cover all documented UC-08 extensions.

## Errors / Comments
- Database/save failure is listed only as an edge case and is missing from acceptance scenarios.
- The effect of submitting fewer than three total reviews (editor decision remaining disabled) is not captured in acceptance scenarios.
- The use case is split into separate user stories for success vs. error handling, which is unconventional; error and extension flows are typically part of the same user goal.

## Conclusion
The specification largely restates UC-08 but adds an unsupported audit/traceability requirement and omits required extension flows.






# Specification Validation: UC-09 Make Final Decision

## Flow Consistency
- The main success flow aligns with UC-09 (editor opens paper with three completed reviews → makes decision → decision stored → author notified).
- Handling of fewer than three reviews aligns with UC-09 E1 (decision action disabled / prevented).

## Functional Requirement
- FR-005 (audit/traceability) is not stated or implied in UC-09 and introduces new behavior.
- Other functional requirements are generally consistent with UC-09 success and minimal guarantees.

## Acceptance Coverage
- Acceptance scenario for notification delivery failure is incorrect: in UC-09 E2, the decision **is stored successfully** and only the notification fails.
- No acceptance scenario maps to UC-09 E3 (database update failure).
- Acceptance scenarios do not fully cover all documented UC-09 extensions.

## Errors / Comments
- Notification delivery failure is modeled as preventing completion, but in UC-09 it occurs **after** the decision is stored and should not block the action.
- Database update failure is listed only as an edge case and is missing from acceptance scenarios.
- The use case is split into separate user stories for success vs. error handling, which is unconventional; extension flows are typically part of the same user goal.

## Conclusion
The specification partially restates UC-09 but misrepresents the notification failure flow, adds an unsupported audit/traceability requirement, and omits a required extension flow.






# Specification Validation: UC-10 Generate Schedule

## Flow Consistency
- The main success flow aligns with UC-10 (administrator requests generation → scheduling algorithm runs → schedule displayed in HTML → sent to accepted authors).
- Handling of no accepted papers aligns with UC-10 E1.
- Handling of scheduling algorithm failure aligns with UC-10 E2.

## Functional Requirement
- FR-005 (audit/traceability) is not stated or implied in UC-10 and introduces new behavior.
- Other functional requirements are generally consistent with UC-10 success, minimal guarantees, and special requirements.
- FR-006 correctly reflects the UC-10 requirement to use “algorithm X.”

## Acceptance Coverage
- No acceptance scenario maps to UC-10 E3 (email delivery failure).
- Acceptance scenarios do not fully cover all documented UC-10 extensions.

## Errors / Comments
- Email delivery failure is listed only as an edge case and is missing from acceptance scenarios.
- The use case is split into separate user stories for success vs. error handling, which is unconventional; extension flows are typically part of the same user goal.

## Conclusion
The specification largely restates UC-10 but adds an unsupported audit/traceability requirement and omits a required extension flow.



# Specification Validation: UC-11 Edit & Publish Schedule

## Flow Consistency
- The main success flow aligns with UC-11 (editor edits existing schedule → validates changes → saves as final → publishes/announces).
- Handling of validation conflicts (room/time collisions) aligns with UC-11 E1.
- Handling of database/save failure aligns with UC-11 E2.

## Functional Requirement
- FR-005 (audit/traceability) is not stated or implied in UC-11 and introduces new behavior.
- Other functional requirements are generally consistent with UC-11 success and minimal guarantees.

## Acceptance Coverage
- No acceptance scenario maps to UC-11 E3 (notification/announcement failure).
- Acceptance scenarios do not fully cover all documented UC-11 extensions.

## Errors / Comments
- Notification/announcement failure is listed only as an edge case and is missing from acceptance scenarios.
- The use case is split into separate user stories for success vs. error handling, which is unconventional; extension flows are typically part of the same user goal.

## Conclusion
The specification largely restates UC-11 but adds an unsupported audit/traceability requirement and omits a required extension flow.








# Specification Validation: UC-12 Pay for Attendance & Receive Ticket

## Flow Consistency
- The main success flow aligns with UC-12 (user logged in → enter payment details → payment processed → confirmation stored → ticket sent).
- Handling of payment declined aligns with UC-12 E1.
- Handling of payment gateway unavailable aligns with UC-12 E2.

## Functional Requirement
- FR-005 (audit/traceability) is not stated or implied in UC-12 and introduces new behavior.
- Other functional requirements are generally consistent with UC-12 success and minimal guarantees.

## Acceptance Coverage
- No acceptance scenario maps to UC-12 E3 (confirmation/ticket email failure).
- Acceptance scenarios do not fully cover all documented UC-12 extensions.

## Errors / Comments
- Confirmation/ticket email failure is listed only as an edge case and is missing from acceptance scenarios.
- The use case is split into separate user stories for success vs. error handling, which is unconventional; extension flows are typically part of the same user goal.

## Conclusion
The specification largely restates UC-12 but adds an unsupported audit/traceability requirement and omits a required extension flow.
