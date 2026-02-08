# Fully Dressed Narrative Scenarios (All Flows)

Source SRS: :contentReference[oaicite:6]{index=6}

Each scenario below instantiates **one specific flow** from the corresponding use case (main or extension).

---

## UC-01 Register User Account

### S1 (Main): Successful registration
Nora is a graduate student preparing to submit a paper. On the CMS homepage she clicks “Register.” The system shows a registration form. She enters “nora@example.com” and a strong password, then submits. The system checks that her email is well-formed and not already in use, accepts her password, stores her account, and redirects her to the login page with a message: “Registration successful—please log in.”

### S2 (E1): Invalid email format
Same day, Nora mistypes her email as “nora@exampl” and submits. The system immediately highlights the email field and explains that the email address is invalid. Nora stays on the registration form and corrects the email.

### S3 (E2): Duplicate email
Dylan tries to register using “nora@example.com” (already registered). After submit, the system reports the email is already in use and refuses to create another account.

### S4 (E3): Weak/non-compliant password
Jin enters a short password that does not meet the password standard. The system rejects the submission and shows the password rule error so Jin can choose a stronger password.

### S5 (E4): Database failure during create
A temporary database outage occurs right as Nora submits. The system shows “Registration failed—please try again later.” No account is created.

---

## UC-02 Log In

### S1 (Main): Successful login
After registering, Nora goes to the login page, enters her username and password, and clicks “Log in.” The system validates her credentials and takes her to her author homepage.

### S2 (E1): Wrong password
Nora accidentally pastes the wrong password. The system rejects the login attempt, shows “Invalid username or password,” and keeps her on the login screen.

### S3 (E3): Database unavailable
During maintenance, the authentication database is unreachable. When Nora submits credentials, CMS shows a service error and suggests trying again later; no session is created.

---

## UC-03 Change Password

### S1 (Main): Password changed successfully
Nora is logged in and navigates to “Change Password.” She enters her current password plus a new compliant password. The system verifies the current password, updates her record, and confirms success.

### S2 (E1): Current password incorrect
Nora accidentally types her current password wrong. The system warns her that the current password is incorrect and does not change anything.

### S3 (E2): New password invalid
Nora tries a new password that violates the password standard. CMS rejects it and explains the rule that was violated.

### S4 (E3): Update fails
Right after validation, the database update fails. CMS reports the failure and keeps the old password active.

---

## UC-04 Submit Paper Manuscript

### S1 (Main): Successful submission
Nora logs in as an author and clicks “Submit Paper.” She fills in author names, affiliations, contact info, abstract, keywords, and the main source, then uploads “paper.pdf” (under 7MB). When she clicks “Submit,” the system validates each field and the file constraints, stores the submission, shows “Submission successful,” and returns her to her home page.

### S2 (E1): Missing required fields
Nora forgets to enter keywords. After she clicks submit, CMS highlights the missing keywords field and shows an error so she can complete it.

### S3 (E2): Invalid file type
Nora uploads “paper.txt.” CMS rejects it and tells her only PDF/Word/LaTeX formats are accepted.

### S4 (E3): File too large
Nora uploads a 15MB PDF. CMS refuses the upload and explains the 7MB maximum.

### S5 (E4): Storage failure
Nora uploads a valid PDF, but the file store is temporarily down. CMS shows an error and does not mark the paper as successfully submitted.

---

## UC-05 Save Submission Draft

### S1 (Main): Save a valid draft
Halfway through the form, Nora clicks “Save.” CMS validates the fields entered so far (e.g., no invalid characters), stores the draft, and confirms “Draft saved.”

### S2 (E1): Draft invalid so not saved
Nora enters an email contact with invalid characters, then clicks “Save.” CMS refuses to save and explains the invalid field so she can correct it.

### S3 (E2): Database unavailable
Nora clicks “Save,” but the database is down. CMS reports the failure and her draft is not persisted.

---

## UC-06 Assign Referees

### S1 (Main): Assign three referees successfully
Evan, the editor, opens Nora’s submitted paper and clicks “Assign Referees.” He enters three referee emails one by one. Each time, CMS checks that the referee will not exceed five assigned papers and records the invitation. After the third invite, CMS confirms the paper has three referee invitations sent.

### S2 (E1): Reviewer overload (>5 papers)
Evan tries to assign “reviewerA@uni.ca,” but CMS detects that would be their sixth assigned paper. CMS blocks the assignment and tells Evan to choose another referee.

### S3 (E2): Invalid/unknown referee email
Evan mistypes an address. CMS warns the email is invalid/unknown and does not send an invitation.

### S4 (E3): Only two referees invited
Evan sends two invitations and tries to leave. CMS indicates the paper still needs three referees assigned.

### S5 (E4): Email delivery failure
CMS attempts to send an invitation but the mail service fails. CMS reports the failure so Evan can re-try or choose a different referee.

---

## UC-07 Accept/Reject Review Invitation

### S1 (Main): Referee accepts invitation
Rita receives an email invitation and logs into CMS. She clicks “Accept.” CMS associates the paper with her account, and the paper appears in her “Assigned Reviews” list.

### S2 (E1): Referee rejects invitation
Rita is overloaded and clicks “Reject.” CMS records the rejection and (conceptually) notifies Evan that another referee must be found.

### S3 (E2): Exceeding three reviewers
Two referees already accepted, and a third acceptance would exceed the allowed count because an extra invitation was mistakenly sent earlier. When Rita accepts, CMS records her acceptance but immediately warns Evan that the paper now exceeds three assigned reviewers.

### S4 (E3): Expired/invalid invitation
Rita clicks an old invitation link that no longer matches a valid invitation. CMS displays an error and does not associate the paper to her account.

---

## UC-08 Submit Paper Review

### S1 (Main): Submit a valid review
Rita opens the assigned paper and clicks “Review.” CMS shows the review form. She fills every required question and submits. CMS validates the form, saves it, and records her review as complete for that paper.

### S2 (E1): Attempt review without acceptance
Rita tries to access a review form for a paper she never accepted. CMS refuses access and prompts her to accept the invitation first.

### S3 (E2): Invalid review form values
Rita leaves required fields blank and clicks submit. CMS highlights the missing answers and does not save.

### S4 (E3): Save fails
Rita submits a complete review but the database is down. CMS reports the failure and her review is not stored.

### S5 (E4): Only one of three reviews complete
Rita’s review saves successfully, but two other referees haven’t submitted yet. CMS keeps the editor decision action disabled until all three reviews are complete.

---

## UC-09 Make Final Decision

### S1 (Main): Decision after three reviews
After all three referees submit their reviews, Evan opens the paper’s review summary. CMS enables “Make Decision.” Evan selects “Accept,” submits, and CMS stores the decision and emails Nora with the outcome.

### S2 (E1): Attempt decision with fewer than three reviews
Evan opens a paper where only two reviews exist. CMS shows the reviews but disables “Make Decision,” explaining that three completed reviews are required.

### S3 (E2): Author notification fails
CMS successfully stores Evan’s “Reject” decision, but email delivery fails. CMS flags the notification error so Evan/admin can re-send.

### S4 (E3): Database update fails
Evan submits “Accept,” but the database write fails. CMS reports the failure and does not record the decision.

---

## UC-10 Generate Schedule

### S1 (Main): Generate schedule successfully
After decisions are finalized, the administrator Ada clicks “Generate Schedule.” CMS runs algorithm X, produces an HTML schedule assigning rooms and times to accepted papers, displays it, and emails it to accepted authors.

### S2 (E1): No accepted papers
Ada requests generation, but no papers are accepted yet. CMS shows “No accepted papers—schedule not generated.”

### S3 (E2): Scheduling failure
Algorithm X errors due to invalid input data. CMS reports that scheduling failed and does not publish a schedule.

### S4 (E3): Email failure
CMS displays the schedule but cannot email some authors. CMS flags the delivery failure while keeping the schedule visible.

---

## UC-11 Edit & Publish Schedule

### S1 (Main): Edit and publish successfully
Evan reviews the generated schedule and notices a conflict for one speaker. He clicks “Edit,” changes a time slot, and saves. CMS validates the edit, stores it as the new final schedule, announces it on the CMS webpage, and notifies relevant users.

### S2 (E1): Conflict detected (time/room collision)
Evan tries to schedule two talks in the same room at the same time. CMS detects the collision and prevents publishing until he resolves it.

### S3 (E2): Save fails
Evan clicks save, but the database fails. CMS keeps the old schedule as final and reports the failure.

### S4 (E3): Announcement fails
CMS saves the new schedule but the announcement service fails. CMS flags the issue so it can be re-published.

---

## UC-12 Pay for Attendance & Receive Ticket

### S1 (Main): Successful payment and ticket issued
Nora decides to attend. She clicks “Conference Registration,” enters her credit card details, and confirms. CMS processes payment, stores confirmation, and emails her a ticket.

### S2 (E1): Payment declined
Nora’s card is declined. CMS displays the decline message and does not issue a ticket.

### S3 (E2): Payment gateway unavailable
The payment provider is down. CMS informs Nora and asks her to try again later; no confirmation is stored.

### S4 (E3): Ticket email fails
Payment succeeds, but the email service fails. CMS stores confirmation and flags that ticket delivery must be re-tried.
