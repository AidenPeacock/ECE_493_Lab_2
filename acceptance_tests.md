# Acceptance Test Suites (Flow Coverage)

Source SRS: :contentReference[oaicite:7]{index=7}

> **Goal:** For each use case, tests cover the main flow and every documented extension (all-flows criterion). :contentReference[oaicite:8]{index=8}

---

## AT-UC01 Register User Account
**AT-UC01-01 (Main):** Register with valid unique email + compliant password → account created; redirected to login.  
**AT-UC01-02 (E1):** Register with malformed email → error shown; no account created.  
**AT-UC01-03 (E2):** Register with already-used email → “email in use” error; no new account created.  
**AT-UC01-04 (E3):** Register with non-compliant password → password error; no account created.  
**AT-UC01-05 (E4):** Simulate DB failure on create → failure message; no account created.

## AT-UC02 Log In
**AT-UC02-01 (Main):** Login with valid credentials → session created; redirected to home.  
**AT-UC02-02 (E1):** Login with wrong password → error; no session created.  
**AT-UC02-03 (E3):** DB unavailable during auth → service error; no session created.

## AT-UC03 Change Password
**AT-UC03-01 (Main):** Change password with correct current + compliant new → password updated.  
**AT-UC03-02 (E1):** Incorrect current password → error; password unchanged.  
**AT-UC03-03 (E2):** New password violates standard → error; password unchanged.  
**AT-UC03-04 (E3):** DB update failure → failure; password unchanged.

## AT-UC04 Submit Paper Manuscript
**AT-UC04-01 (Main):** Submit with all required metadata + valid file type/size → success; submission stored.  
**AT-UC04-02 (E1):** Submit with missing required field → error; submission not stored as complete.  
**AT-UC04-03 (E2):** Submit with invalid file type → error; submission not stored.  
**AT-UC04-04 (E3):** Submit with file >7MB → error; submission not stored.  
**AT-UC04-05 (E4):** Storage failure during upload → failure; submission not marked successful.

## AT-UC05 Save Submission Draft
**AT-UC05-01 (Main):** Save draft with valid partial data → draft stored; confirmation shown.  
**AT-UC05-02 (E1):** Save with invalid draft field → error; draft not stored/updated.  
**AT-UC05-03 (E2):** DB unavailable → failure; draft not stored/updated.

## AT-UC06 Assign Referees
**AT-UC06-01 (Main):** Assign 3 referees within limits → 3 invitations recorded; confirmation shown.  
**AT-UC06-02 (E1):** Assign referee that would exceed 5 papers → blocked; violation shown.  
**AT-UC06-03 (E2):** Assign invalid/unknown referee email → blocked; error shown.  
**AT-UC06-04 (E3):** Stop after 2 invites → system indicates incomplete (requires 3).  
**AT-UC06-05 (E4):** Email service down when inviting → invitation marked failed; editor informed.

## AT-UC07 Accept/Reject Review Invitation
**AT-UC07-01 (Main):** Accept invitation → paper appears in referee account; acceptance recorded.  
**AT-UC07-02 (E1):** Reject invitation → rejection recorded; paper not in referee account.  
**AT-UC07-03 (E2):** Accept causes >3 reviewers → acceptance recorded; editor warned of violation.  
**AT-UC07-04 (E3):** Attempt accept with expired/invalid invitation → error; no association created.

## AT-UC08 Submit Paper Review
**AT-UC08-01 (Main):** Submit valid review for accepted assignment → saved; marked complete.  
**AT-UC08-02 (E1):** Try to review without accepting invitation → access denied.  
**AT-UC08-03 (E2):** Submit review with blanks/invalid chars → validation errors; not saved.  
**AT-UC08-04 (E3):** DB save failure → failure; not saved.  
**AT-UC08-05 (E4):** Submit 1/3 reviews only → review saved; editor decision remains disabled.

## AT-UC09 Make Final Decision
**AT-UC09-01 (Main):** With 3 completed reviews, record decision → decision saved; author notified.  
**AT-UC09-02 (E1):** With <3 reviews, attempt decision → action disabled; no decision saved.  
**AT-UC09-03 (E2):** Notification failure after save → decision saved; notification flagged failed.  
**AT-UC09-04 (E3):** DB write failure → decision not saved; error shown.

## AT-UC10 Generate Schedule
**AT-UC10-01 (Main):** Generate schedule with accepted papers → schedule displayed; emails sent.  
**AT-UC10-02 (E1):** Generate with zero accepted papers → “no schedule” message; none published.  
**AT-UC10-03 (E2):** Algorithm failure → error; no schedule produced.  
**AT-UC10-04 (E3):** Email delivery failure → schedule displayed; delivery flagged.

## AT-UC11 Edit & Publish Schedule
**AT-UC11-01 (Main):** Edit schedule validly → saved as final; announced/notified.  
**AT-UC11-02 (E1):** Edit introduces room/time collision → error; final schedule unchanged.  
**AT-UC11-03 (E2):** DB save failure → error; final schedule unchanged.  
**AT-UC11-04 (E3):** Announcement failure → schedule saved; publishing flagged.

## AT-UC12 Pay for Attendance & Receive Ticket
**AT-UC12-01 (Main):** Successful payment → confirmation stored; ticket sent.  
**AT-UC12-02 (E1):** Payment declined → no confirmation; no ticket.  
**AT-UC12-03 (E2):** Gateway unavailable → no confirmation; no ticket.  
**AT-UC12-04 (E3):** Ticket email fails → confirmation stored; email failure flagged.
