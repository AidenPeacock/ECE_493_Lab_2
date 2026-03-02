## CMS Necessary Checklist Status — Register User Account (UC-01)

- [x] CHK001 Are requirements defined for all input fields expected on the registration form (email, password)?  
  [Complete — Spec §FR-001, Acceptance Scenarios]
- [ ] CHK003 Are requirements included for handling storage failures when creating a new account?  
  [Incomplete — UC-01 E4 only appears as an edge case question]
- [x] CHK006 Is the term "register user account" defined with specific data captured and validation rules?  
  [Complete — Spec §FR-001, UC-01 flow restated]
- [x] CHK010 Do acceptance scenarios align with functional requirements for validation and error handling?  
  [Complete — No conflicts detected]
- [x] CHK014 Are acceptance scenarios complete for all validation failure types (invalid email, duplicate email, weak password)?  
  [Complete — UC-01 E1–E3 covered]
- [ ] CHK017 Are exception flows for storage failures or unavailable services specified?  
  [Incomplete — No acceptance scenario for UC-01 E4 / AT-UC01-05]
- [x] CHK025 Are dependencies on external requirement artifacts (use cases, acceptance tests) explicitly mapped?  
  [Complete — Spec §User Scenarios & Testing]


## CORRECTIONS MADE 

  for use case 001, add - [ ] CHK003 Are requirements included for handling storage failures when creating a new account? [Incomplete — UC-01 E4 only appears as an edge case
  question], - [ ] CHK017 Are exception flows for storage failures or unavailable services specified? [Incomplete — No acceptance scenario for UC-01 E4 / AT-UC01-05]

  Recommended: Option B — it preserves data integrity, communicates failure clearly, and aligns with traceability.

  | Option | Description |
  |---|---|
  | A | Show generic error, stay on form, user must retry (no data preserved) |
  | B | Show specific storage error, keep entered data, allow retry |
  | C | Queue the registration for later retry, show “pending” status |
  | Short | Provide a different short answer (<=5 words) |

  You can reply with the option letter (e.g., "B"), accept the recommendation by saying "yes" or "recommended", or provide your own short answer.


› A


  Next clarification (Q2): Do we need to specify storage failure acceptance criteria explicitly (e.g., error text requirements and retry behavior), or is a single functional
  requirement sufficient?

  Recommended: Option B — it reduces ambiguity and helps acceptance test mapping.

  | Option | Description |
  |---|---|
  | A | Keep it as a single functional requirement only |
  | B | Add explicit acceptance criteria for storage failure behavior |
  | Short | Provide a different short answer (<=5 words) |

  You can reply with the option letter, “yes/recommended”, or a short answer.


› B


## CMS Necessary Checklist Status — Log In (UC-02)

- [x] CHK001 Are all inputs required for log in explicitly listed (e.g., username/email and password)?  
  [Complete — credentials implied and used consistently]

- [ ] CHK002 Are requirements defined for how invalid credentials are detected and reported?  
  [Incomplete — error handling stated but detection logic is vague]

- [ ] CHK004 Are requirements included for unavailable authentication/storage services?  
  [Incomplete — UC-02 database-unavailable extension not elevated beyond edge case]

- [x] CHK006 Is “log in” defined with explicit success outcomes (session established, role-appropriate home page)?  
  [Complete — stated in acceptance scenarios]

- [x] CHK009 Do acceptance scenarios align with the functional requirements for validation and error handling?  
  [Complete — no internal conflicts]

- [x] CHK023 Are dependencies on external artifacts explicitly mapped?  
  [Complete — traceability section present]


## CORRECTIONS MADE 


  Recommended: Option A — it’s the clearest, testable definition and aligns with typical login requirements.

  | Option | Description |
  |--------|-------------|
  | A | Define invalid credentials as “email/username not found OR password mismatch,” and require a single generic error message for either case |
  | B | Define invalid credentials as “email/username not found OR password mismatch,” and require distinct error messages for each case |
  | C | Define invalid credentials only as “password mismatch” (assume account exists) |
  | Short | Provide a different short answer (<=5 words) |

  You can reply with the option letter (e.g., “A”), accept the recommendation by saying “yes” or “recommended”, or provide your own short answer.


› A


• Edited specs/002-log-in/spec.md (+8 -1)
    32  1. **Given** user has an existing account., **When** they complete log in, **Then** authenticated session established; user reaches role-appropriate home page.
    33 -2. **Given** the user encounters invalid credentials, **When** they submit the request, **Then** the system prevents completion and shows a clear error.
    33 +2. **Given** the user encounters invalid credentials (email/username not found or password mismatch), **When** they submit the request, **Then** the system prevents co
        mpletion and shows a generic invalid-credentials error.
    34
       ⋮
    70  - **FR-006**: On failure, the system MUST ensure: No session created on failure.
    71 +- **FR-007**: Invalid credentials MUST be defined as email/username not found OR password mismatch, and the system MUST show a single generic invalid-credentials error
    72
    89  - **SC-004**: 100% of successful log in actions are recorded for traceability.
    92 +
    93 +### Session 2026-02-09
    94 +
    95 +- Q: How should invalid credentials be detected and reported in the requirements? → A: Email/username not found OR password mismatch; show a single generic invalid-cre
        dentials error.

───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

• Recorded and applied Q1.

  Recommended: Option A — it makes the failure mode explicit and testable without over-complicating flow.

  | Option | Description |
  |--------|-------------|
  | A | Treat it as a service error: show a specific “service unavailable” message, no session created, and user must retry later |
  | B | Treat it as a validation error (generic invalid-credentials message) |
  | C | Allow offline login using last known session (if any) |
  | Short | Provide a different short answer (<=5 words) |

  You can reply with the option letter (e.g., “A”), accept the recommendation by saying “yes” or “recommended”, or provide your own short answer.


› A

## CMS Necessary Checklist Status — Change Password (UC-03)

- [x] CHK001 Are all inputs required for changing a password explicitly listed (current password, new password)?  
  [Complete — inputs are clearly referenced in requirements and scenarios]

- [x] CHK002 Are requirements defined for current password verification failures?  
  [Complete — covered by acceptance scenario for incorrect current password]

- [ ] CHK003 Are requirements included for database/update failure handling?  
  [Incomplete — UC-03 database failure appears only as an edge case]

- [ ] CHK013 Are acceptance scenarios complete for all failure types listed?  
  [Incomplete — update failure not covered by acceptance scenarios]

- [x] CHK006 Is “change password” defined with explicit success outcomes?  
  [Complete — password updated and usable for authentication]

- [x] CHK023 Are dependencies on external artifacts explicitly mapped?  
  [Complete — traceability section present]

  Recommended: Option A — it’s explicit, testable, and aligns with FR‑007 (no password change on failure).

  | Option | Description |
  |--------|-------------|
  | A | Show a specific update-failure error, do not change the password, require the user to retry later |
  | B | Treat as a validation error (generic message) |
  | C | Retry automatically without user action |
  | Short | Provide a different short answer (<=5 words) |

  You can reply with the option letter (e.g., “A”), accept the recommendation by saying “yes” or “recommended”, or provide your own short answer.


› A


## CMS Necessary Checklist Status — Submit Paper Manuscript (UC-04)

- [x] CHK001 Are all required submission fields (metadata + file) explicitly listed in requirements?  
  [Complete — metadata and file upload are clearly implied and enforced]

- [x] CHK002 Are requirements defined for handling missing/blank required fields?  
  [Complete — covered by acceptance scenario for missing fields]

- [ ] CHK003 Are requirements included for file size violations beyond the edge case list?  
  [Incomplete — UC-04 E3 (file too large) not elevated to acceptance scenario]

- [x] CHK006 Is “submit paper manuscript” defined with explicit success outcomes (stored file + metadata)?  
  [Complete — success outcome clearly stated]

- [ ] CHK014 Are primary and exception flows fully specified for submission?  
  [Incomplete — size and storage failure flows missing]

- [x] CHK023 Are dependencies on external artifacts explicitly mapped?  
  [Complete — traceability section present]

## CORRECTIONS MADE 

• Q1: How should file size violations be handled in the requirements for Submit Paper Manuscript?

  Recommended: Option A — it’s explicit, testable, and aligns with the existing file-size constraint.

  | Option | Description |
  |--------|-------------|
  | A | Add an acceptance scenario: if file > 7MB, reject submission and show a size-limit error |
  | B | Treat file-size violations as a generic validation error (no specific scenario) |
  | C | Allow oversize uploads with a warning (no rejection) |
  | Short | Provide a different short answer (<=5 words) |

  You can reply with the option letter (e.g., “A”), accept the recommendation by saying “yes” or “recommended”, or provide your own short answer.


› A


  Next clarification (Q2): How should storage/upload failures be handled in requirements for submission?

  Recommended: Option A — it makes the failure mode explicit and testable without changing scope.

  | Option | Description |
  |--------|-------------|
  | A | Show a specific upload/storage error, do not create the submission, require the user to retry |
  | B | Treat it as a generic validation error |
  | C | Save metadata and retry file upload automatically |
  | Short | Provide a different short answer (<=5 words) |

  You can reply with the option letter (e.g., “A”), accept the recommendation by saying “yes” or “recommended”, or provide your own short answer.

 › A


 ## CMS Necessary Checklist Status — Save Submission Draft (UC-05)

- [x] CHK002 Are requirements defined for validation before saving a draft?  
  [Complete — validation before save is explicitly required]

- [x] CHK003 Are requirements included for handling invalid draft values?  
  [Complete — covered by acceptance scenario]

- [x] CHK006 Is “save submission draft” defined with explicit success outcomes (draft stored and retrievable)?  
  [Complete — stated in acceptance scenarios]

- [ ] CHK010 Do edge cases map to explicit requirements rather than remaining open questions?  
  [Incomplete — edge cases remain questions]

- [ ] CHK013 Are acceptance scenarios complete for all failure types listed?  
  [Incomplete — storage failure not covered]

- [x] CHK023 Are dependencies on external artifacts explicitly mapped?  
  [Complete — traceability section present]

## CORRECTIONS MADE 



  Recommended: Option A — it’s explicit, testable, and prevents duplicate drafts.

  | Option | Description |
  |--------|-------------|
  | A | Ignore duplicate submit; keep the latest valid draft only |
  | B | Reject the second submit with a clear error |
  | C | Create a new duplicate draft entry |
  | Short | Provide a different short answer (<=5 words) |

  You can reply with the option letter (e.g., “A”), accept the recommendation by saying “yes” or “recommended”, or provide your own short answer.




• Edited specs/005-save-submission-draft/spec.md (+2 -0)
    73
       ⋮
    96  - Q: How should database unavailable be handled in requirements for Save Submission Draft? → A: Show service-unavailable error, do not save the draft, user must retry
        later.
    97 +- Q: How should double-submission be handled for Save Submission Draft? → A: Ignore duplicate submit; keep the latest valid draft only.

───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

  Next clarification (Q2): Do we need an acceptance scenario for database-unavailable handling, or is the current functional requirement enough?

  Recommended: Option A — it closes the gap in acceptance coverage.

  | Option | Description |
  |--------|-------------|
  | A | Add an explicit acceptance scenario for database-unavailable handling |
  | B | Keep it only in functional requirements (no scenario) |
  | Short | Provide a different short answer (<=5 words) |

  You can reply with the option letter (e.g., “A”), accept the recommendation by saying “yes” or “recommended”, or provide your own short answer.


› A





## CMS Necessary Checklist Status — Assign Referees (UC-06)

- [x] CHK001 Are all assignment constraints (3 referees per paper, max 5 per referee) explicitly stated?  
  [Complete — clearly stated in functional requirements]

- [x] CHK002 Are requirements defined for validating referee email existence/format?  
  [Complete — covered by acceptance scenario for invalid/unknown email]

- [ ] CHK003 Are requirements specified for inviting exactly three referees (not fewer/more)?  
  [Incomplete — fewer-than-three case listed only as an edge case]

- [ ] CHK004 Are requirements included for handling invitation delivery failures?  
  [Incomplete — delivery failure appears only as an edge case]

- [x] CHK006 Is “assign referees” defined with explicit success outcomes?  
  [Complete — invitations sent and assignments recorded]

- [x] CHK023 Are dependencies on external artifacts explicitly mapped?  
  [Complete — traceability section present]


## CORRECTIONS MADE 


  Recommended: Option A — it enforces the stated constraint and makes the outcome testable.

  | Option | Description |
  |--------|-------------|
  | A | Block submission and show an error until 3 referees are assigned |
  | B | Allow submission but mark assignment as incomplete with a warning |
  | C | Allow submission and auto-fill later (no warning) |
  | Short | Provide a different short answer (<=5 words) |

  You can reply with the option letter (e.g., “A”), accept the recommendation by saying “yes” or “recommended”, or provide your own short answer.


› A


  Recommended: Option A — explicit and testable without adding asynchronous complexity.

  | Option | Description |
  |--------|-------------|
  | A | Show a delivery-failure error, do not mark the invitation as sent, require retry |
  | B | Mark as sent but flag for retry, no user action required |
  | C | Ignore delivery failure (no error) |
  | Short | Provide a different short answer (<=5 words) |

  You can reply with the option letter (e.g., “A”), accept the recommendation by saying “yes” or “recommended”, or provide your own short answer.


› A


## CMS Necessary Checklist Status — Accept/Reject Review Invitation (UC-07)


- [x] CHK003 Are requirements specified for updating reviewer assignment counts when an invitation is accepted?  
  [Complete — reviewer count tracking is stated in acceptance scenarios]

- [x] CHK005 Are requirements specified for preventing acceptance when reviewer limits are exceeded?  
  [Complete — covered by acceptance scenario for limit exceeded]

- [ ] CHK001 Are all invitation response states (accept, reject, expired/invalid) explicitly covered?  
  [Incomplete — expired/invalid invitation not covered by acceptance scenarios]

- [ ] CHK004 Are requirements included for handling rejection outcomes?  
  [Incomplete — rejection is treated as an error instead of a valid alternate flow]

- [ ] CHK013 Are acceptance scenarios complete for all failure types listed?  
  [Incomplete — expired/invalid invitation missing]

- [x] CHK023 Are dependencies on external artifacts explicitly mapped?  
  [Complete — traceability section present]


## CORRECTIONS MADE 

  • Q1: How should referee rejection be treated in requirements?

  Recommended: Option A — rejection is a valid alternate flow and should not be treated as an error.

  | Option | Description |
  |--------|-------------|
  | A | Treat rejection as a valid alternate flow: record rejection and notify editor (no error) |
  | B | Treat rejection as an error (current behavior) |
  | C | Treat rejection as neutral: record but no notification |
  | Short | Provide a different short answer (<=5 words) |

  You can reply with the option letter (e.g., “A”), accept the recommendation by saying “yes” or “recommended”, or provide your own short answer.


› A


  Recommended: Option A — makes the failure explicit and testable.

  | Option | Description |
  |--------|-------------|
  | A | Show an expired/invalid invitation error and do not associate the referee with the paper |
  | B | Allow acceptance anyway if logged in |
  | C | Auto-refresh to a new invitation token |
  | Short | Provide a different short answer (<=5 words) |

  You can reply with the option letter (e.g., “A”), accept the recommendation by saying “yes” or “recommended”, or provide your own short answer.


› A



## CMS Necessary Checklist Status — Submit Paper Review (UC-08)

- [x] CHK002 Are requirements defined for eligibility to submit (invitation accepted)?  
  [Complete — acceptance scenario explicitly requires accepted invitation]

- [x] CHK006 Is “submit paper review” defined with explicit success outcomes?  
  [Complete — review stored and editor receives review]


- [x] CHK023 Are dependencies on external artifacts explicitly mapped?  
  [Complete — traceability section present]


  
  ## CMS Necessary Checklist Status — Make Final Decision (UC-09)

- [x] CHK001 Are prerequisites for making a decision (three completed reviews) explicitly specified?  
  [Complete — stated in acceptance scenarios]

- [x] CHK006 Is “make final decision” defined with explicit success outcomes (decision stored, author notified)?  
  [Complete — clearly stated in main success scenario]

- [x] CHK023 Are dependencies on external artifacts explicitly mapped?  
  [Complete — traceability section present]



## CMS Necessary Checklist Status — Generate Schedule (UC-10)

- [x] CHK001 Are prerequisites for schedule generation (accepted papers) explicitly specified?  
  [Complete — stated in acceptance scenarios]

- [x] CHK002 Are requirements defined for the schedule output format (HTML) and distribution to authors?  
  [Complete — HTML display and email distribution are specified]

- [x] CHK003 Are requirements included for handling scheduling algorithm failures?  
  [Complete — covered by acceptance scenario]

- [x] CHK006 Is “generate schedule” defined with explicit success outcomes?  
  [Complete — schedule displayed and sent]

- [x] CHK023 Are dependencies on external artifacts explicitly mapped?  
  [Complete — traceability section present]




  ## CMS Necessary Checklist Status — Edit & Publish Schedule (UC-11)

- [x] CHK001 Are prerequisites for editing/publishing (existing schedule) explicitly specified?  
  [Complete — acceptance scenarios require an existing schedule]

- [x] CHK002 Are requirements defined for validation conflicts (e.g., room/time collisions)?  
  [Complete — covered by acceptance scenario]

- [x] CHK003 Are requirements included for database/save failures?  
  [Complete — save failure covered by acceptance scenario]

- [x] CHK006 Is “edit & publish schedule” defined with explicit success outcomes?  
  [Complete — final schedule saved and published/announced]


- [x] CHK023 Are dependencies on external artifacts explicitly mapped?  
  [Complete — traceability section present]



  ## CMS Necessary Checklist Status — Pay for Attendance & Receive Ticket (UC-12)

- [x] CHK001 Are prerequisites for payment (logged in, registration open, price list) explicitly specified?  
  [Complete — stated in acceptance scenarios]

- [x] CHK002 Are requirements defined for payment confirmation storage and ticket delivery?  
  [Complete — confirmation stored and ticket sent on success]

- [x] CHK003 Are requirements included for payment declined and gateway unavailable failures?  
  [Complete — both failure types covered by acceptance scenarios]

- [x] CHK006 Is “pay for attendance & receive ticket” defined with explicit success outcomes?  
  [Complete — success outcomes clearly stated]

- [x] CHK023 Are dependencies on external artifacts explicitly mapped?  
  [Complete — traceability section present]