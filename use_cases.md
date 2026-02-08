# CMS Use Cases (Cockburn-style)

Source SRS: :contentReference[oaicite:5]{index=5}

> **Conventions**
> - “System” refers to the CMS web application.
> - Where the SRS specifies constraints (e.g., file types, reviewer load), those appear in **Special Requirements** and **Extensions**.

---

## UC-01 Register User Account (US-01)

**Scope:** CMS  
**Level:** User-goal  
**Primary Actor:** Prospective authorized user (author/reviewer/editor/attendee)  
**Stakeholders & Interests:**  
- User: wants quick registration, clear errors, secure password rules.  
- CMS/Admin: wants unique, valid emails and compliant passwords.  

**Preconditions:** User is not currently registered with the email.  
**Minimal Guarantees (Failure):** No account is created; user is informed of validation errors.  
**Success Guarantees:** New user record stored; user can proceed to login.

### Main Success Scenario
1. User selects **Register**.
2. System displays registration form.
3. User enters required details (including email and password) and submits.
4. System validates email format, uniqueness, and password compliance.
5. System stores the user in the database.
6. System redirects user to the login page with a success message.

### Extensions (Alternative Flows)
- **E1: Invalid email format**
  - 4a. System detects invalid format and shows an error; user remains on form.
- **E2: Email already registered**
  - 4b. System detects non-unique email and shows an error; user remains on form.
- **E3: Password fails security standard**
  - 4c. System shows password-rule error; user remains on form.
- **E4: Database/store failure**
  - 5a. System shows a failure message; no account created.

**Special Requirements:** Password must follow “Password Security Standards” (exact rule set not provided in SRS).

---

## UC-02 Log In (US-02)

**Scope:** CMS  
**Level:** User-goal  
**Primary Actor:** Registered user  
**Preconditions:** User has an existing account.  
**Minimal Guarantees:** No session created on failure.  
**Success Guarantees:** Authenticated session established; user reaches role-appropriate home page.

### Main Success Scenario
1. User selects **Log in**.
2. System prompts for username and password.
3. User submits credentials.
4. System compares credentials with database.
5. System logs the user in and redirects to home page.

### Extensions
- **E1: Invalid credentials**
  - 4a. System rejects login and shows an error; user remains on login page.
- **E2: Account locked/disabled (not specified)**
  - Not in SRS; omit unless later specified.
- **E3: Database unavailable**
  - 4b. System shows service error; user remains on login page.

---

## UC-03 Change Password (US-03)

**Scope:** CMS  
**Level:** User-goal  
**Primary Actor:** Registered user  
**Preconditions:** User is authenticated.  
**Minimal Guarantees:** Password unchanged on failure.  
**Success Guarantees:** Password updated in DB; user can authenticate with new password.

### Main Success Scenario
1. User navigates to **Change Password**.
2. System displays password change form.
3. User enters current password and new password; submits.
4. System verifies current password and validates new password.
5. System updates password in database and confirms success.

### Extensions
- **E1: Current password incorrect**
  - 4a. System shows error; password unchanged.
- **E2: New password violates security standard**
  - 4b. System shows rule error; password unchanged.
- **E3: Database update fails**
  - 5a. System shows failure; password unchanged.

**Special Requirements:** New password must follow Password Security Standards (details not provided).

---

## UC-04 Submit Paper Manuscript (US-04)

**Scope:** CMS  
**Level:** User-goal  
**Primary Actor:** Author (registered user)  
**Preconditions:** Author is logged in.  
**Minimal Guarantees:** No submission created unless saved or successfully submitted.  
**Success Guarantees:** Submission and file stored; user informed of success.

### Main Success Scenario
1. Author selects **Submit Paper**.
2. System displays submission form.
3. Author fills required metadata (authors/affiliations/contact, abstract, keywords, main source) and uploads manuscript file.
4. Author clicks **Submit**.
5. System validates required fields and file rules (type/size).
6. System stores metadata and manuscript in database.
7. System shows success message and redirects to author home page.

### Extensions
- **E1: Missing/blank required fields**
  - 5a. System highlights invalid fields; shows error; no submission stored.
- **E2: Invalid file type (not PDF/Word/LaTeX)**
  - 5b. System shows file-type error; no submission stored.
- **E3: File too large (> 7MB)**
  - 5c. System shows size error; no submission stored.
- **E4: Upload/storage failure**
  - 6a. System shows failure; submission not completed.

**Special Requirements:** Allowed file types: PDF, Word, LaTeX; maximum size 7MB.

---

## UC-05 Save Submission Draft (US-05)

**Scope:** CMS  
**Level:** User-goal  
**Primary Actor:** Author  
**Preconditions:** Author is logged in and is on submission form (new or existing draft).  
**Minimal Guarantees:** No invalid draft state is stored.  
**Success Guarantees:** Draft data stored and retrievable for later completion.

### Main Success Scenario
1. Author starts filling the submission form.
2. Author clicks **Save**.
3. System validates draft fields (as required by SRS) before saving.
4. System saves draft in database and confirms saved state.

### Extensions
- **E1: Draft contains invalid values**
  - 3a. System reports violations; does not save.
- **E2: Database unavailable**
  - 4a. System reports failure; does not save.

---

## UC-06 Assign Referees (US-06)

**Scope:** CMS  
**Level:** User-goal  
**Primary Actor:** Editor  
**Preconditions:** Editor is logged in; at least one paper exists to assign.  
**Minimal Guarantees:** No reviewer assignment is committed if it violates constraints.  
**Success Guarantees:** Invitations sent; assignments recorded subject to acceptance.

### Main Success Scenario
1. Editor opens a submitted paper and selects **Assign Referees**.
2. System shows fields to enter referee email addresses.
3. Editor enters a referee email for the paper.
4. System checks referee’s current assigned-paper count (must be ≤ 5 after assignment).
5. System records the invitation and sends an email invitation to the referee.
6. Editor repeats steps 3–5 until three invitations are sent for the paper.
7. System confirms that three referees have been invited/assigned for the paper.

### Extensions
- **E1: Referee would exceed 5 assigned papers**
  - 4a. System blocks that selection and informs editor of violation.
- **E2: Referee email not found/invalid format**
  - 4b. System informs editor; invitation not sent.
- **E3: Editor assigns fewer than 3**
  - 7a. System indicates assignment incomplete.
- **E4: Email delivery failure**
  - 5a. System reports failure; invitation not recorded or marked “pending retry” (policy not specified).

**Special Requirements:** Each paper must have 3 referees; each referee must not have > 5 assigned papers.

---

## UC-07 Accept/Reject Review Invitation (US-07)

**Scope:** CMS  
**Level:** User-goal  
**Primary Actor:** Referee  
**Preconditions:** Referee is registered; invitation exists; referee is logged in (or authenticated via invitation link, if implemented).  
**Minimal Guarantees:** Paper not placed under referee unless invitation accepted.  
**Success Guarantees:** On accept, paper appears under referee account; system tracks reviewer count for the paper.

### Main Success Scenario (Accept)
1. Referee receives invitation and selects **Accept**.
2. System records acceptance and associates the paper with referee’s account.
3. System checks paper’s assigned reviewer count and informs editor if it exceeds 3 (per SRS).
4. System shows the paper under referee’s assigned review tasks.

### Extensions
- **E1: Referee rejects invitation**
  - 1a. Referee selects **Reject**; system records rejection and informs editor (notification mechanism not specified).
- **E2: Paper would exceed 3 assigned reviewers**
  - 3a. System informs editor of violation (assignment policy beyond notification not specified).
- **E3: Invitation expired/invalid**
  - 1b. System shows error; no association created.

---

## UC-08 Submit Paper Review (US-08)

**Scope:** CMS  
**Level:** User-goal  
**Primary Actor:** Referee  
**Preconditions:** Referee is logged in; referee has accepted invitation; paper appears in account.  
**Minimal Guarantees:** Invalid review not stored; editor not misled by partial data.  
**Success Guarantees:** Review stored; editor receives review when appropriate.

### Main Success Scenario
1. Referee opens an assigned paper and selects **Review**.
2. System displays the review form.
3. Referee fills the form and submits.
4. System validates required fields (no blanks/invalid characters).
5. System saves the review in database.
6. System sends review to editor (or queues it); when all three reviews are submitted, editor can decide.

### Extensions
- **E1: Referee has not accepted invitation**
  - 1a. System denies access to review form.
- **E2: Review form has blanks/invalid input**
  - 4a. System shows errors; does not save.
- **E3: Database/save failure**
  - 5a. System shows failure; review not stored.
- **E4: Not all three reviews complete yet**
  - 6a. System stores review but editor decision remains unavailable until all three are complete.

---

## UC-09 Make Final Decision (US-09)

**Scope:** CMS  
**Level:** User-goal  
**Primary Actor:** Editor  
**Preconditions:** Paper has three completed review forms.  
**Minimal Guarantees:** No decision stored if prerequisites unmet.  
**Success Guarantees:** Decision stored; author notified.

### Main Success Scenario
1. Editor opens a paper with three completed reviews.
2. System enables **Make Decision**.
3. Editor selects Accept or Reject and submits decision.
4. System stores decision in database.
5. System sends decision notification to the author.

### Extensions
- **E1: Fewer than three reviews**
  - 2a. System disables decision action; informs editor prerequisites not met.
- **E2: Notification delivery failure**
  - 5a. System records decision but flags notification failure (retry policy not specified).
- **E3: Database update failure**
  - 4a. System shows failure; decision not stored.

---

## UC-10 Generate Schedule (US-10)

**Scope:** CMS  
**Level:** User-goal  
**Primary Actor:** Administrator (or editor acting in admin capacity)  
**Preconditions:** Set of accepted papers exists.  
**Minimal Guarantees:** No schedule published on failure.  
**Success Guarantees:** Schedule generated in HTML and sent to authors of accepted papers.

### Main Success Scenario
1. Administrator requests **Generate Schedule**.
2. System runs scheduling algorithm X to assign time/rooms for accepted papers.
3. System displays schedule in HTML format.
4. System sends schedule to authors of accepted papers.

### Extensions
- **E1: No accepted papers**
  - 2a. System shows “no schedule available” message.
- **E2: Scheduling algorithm fails**
  - 2b. System shows failure; no schedule generated.
- **E3: Email delivery failure**
  - 4a. System flags delivery issue; schedule still displayed.

**Special Requirements:** Schedule produced via “algorithm X” (details not provided).

---

## UC-11 Edit & Publish Schedule (US-11)

**Scope:** CMS  
**Level:** User-goal  
**Primary Actor:** Editor  
**Preconditions:** A schedule exists (generated or previously published).  
**Minimal Guarantees:** On failure, existing schedule remains unchanged.  
**Success Guarantees:** Schedule updated; new version becomes final and is published/announced.

### Main Success Scenario
1. Editor opens the schedule and selects **Edit**.
2. System shows editable schedule view.
3. Editor modifies time/room assignments and saves.
4. System validates updates and stores the new schedule as the final version.
5. System announces the final schedule on the CMS webpage and sends it to relevant users (authors/audience per SRS text).

### Extensions
- **E1: Validation conflict (e.g., room/time collision)**
  - 4a. System shows conflict error; does not replace final schedule.
- **E2: Database/save failure**
  - 4b. System shows failure; does not replace final schedule.
- **E3: Notification/announcement failure**
  - 5a. System saves schedule but flags publishing/notification issue.

---

## UC-12 Pay for Attendance & Receive Ticket (US-12)

**Scope:** CMS  
**Level:** User-goal  
**Primary Actor:** Authorized user (attendee)  
**Preconditions:** User is logged in; registration is open; price list exists.  
**Minimal Guarantees:** No payment recorded if payment fails; no ticket issued.  
**Success Guarantees:** Payment confirmation stored; ticket/confirmation sent to user.

### Main Success Scenario
1. User selects **Conference Registration**.
2. System presents credit-card payment interface.
3. User enters payment details and confirms payment.
4. System processes payment.
5. System stores payment confirmation.
6. System sends confirmation/ticket to the user.

### Extensions
- **E1: Payment declined**
  - 4a. System informs user; does not store confirmation; no ticket.
- **E2: Payment gateway unavailable**
  - 4b. System informs user; no ticket.
- **E3: Confirmation email failure**
  - 6a. System stores confirmation but flags notification failure.
