# VALIDATION OF USE CASES


## USE CASE 001

- T009 depends on UI containers that don’t exist yet
- “field-level + summary” error rendering utilities need known DOM targets
- Those targets are created in T002 / T011, so doing T009 before T011 is risky unless T009 is written to create its own containers or to fail gracefully when elements are missing.


## USE CASE 002
- Same problem as above, the UI containers do not exist for most modules. 
- “Invalid credentials” implies there’s something to check against:
previously registered users in LocalStorage (from the Register feature), or
a stubbed “auth service” / hardcoded credential, etc.
task list only mentions a LocalStorage adapter inside this login module (T007), but not the data contract for what a stored user record looks like and where it lives.
This is a potential blocker across use cases: login may not be implementable correctly until you align on the registration persistence format/key (or define it here).
Minimal fix: add an explicit dependency note:
“T017 requires agreed LocalStorage schema/key for stored accounts created by Register User Account.”


## USE CASE 003

- Change Password is blocked by “logged-in user” / account identity
To change a password, the flow must know which UserAccount is being changed. Your tasks don’t include any prerequisite like:
“require a current session,”
“select current user from LocalStorage,” or
“identify user by username/email + current password.”
So T013/T017 are blocked unless you define the identity source:
the UI includes username/email

## USE CASE 004
- No obvious blockers 

## USE CASE 005

- “Retrievable draft” is blocked unless you define where/how drafts are retrieved
US1’s independent test says “saved draft is retrievable,” but the tasks only mention:
save flow (T013),
success view/redirect (T014),
storage adapter (T007).
There is no task that implements “load draft” 


## USE CASE 006

To assign referees, the UI/handler must know:
what paper is being assigned (paperId / submissionId), and
what referees exist (list of referee accounts) and their current load (assigned count).
None of that exists in the tasks list. Without it:
T013 can’t validate meaningful assignments,
T018 (max 5 papers per referee) is impossible without persisted assignment history.

## USE CASE 007

- To accept/reject, we need an invitation record with at least:
invitationId/token,
paperId,
refereeId (or referee contact),
status (pending/accepted/rejected/expired),
expiry info (for T019).
tasks don’t include “load pending invitations” or “seed/create invitation records.” That means:
T013 can’t validate inputs against anything real,
T019 (expired/invalid invitation) is impossible without a defined expiry/token scheme.

# USE CASE 008 
- no blockers found

# USE CASE 009
- no blockers found

# USE CASE 010

- T017 explicitly says “block when no accepted papers exist,” which implies the happy path requires:
a persisted list of papers, each with an accepted decision/status.
Your tasks don’t include:
loading papers,
defining what “accepted” means in storage,
seeding accepted papers for manual testing.
So T013/T017 are blocked until we define/implement the accepted-paper data source.

# USE CASE 011
- no blockers found

# USE CASE 012

In a vanilla front-end app, there’s no real payment gateway. To implement T013 (validate, persist, success):
you need a defined “payment processor” abstraction (even if fake),
what data you collect (amount, attendee info, card fields vs “mock pay”),
and how you determine success/failure (toggle, random, validation-driven).
Without that, “Pay” is undefined and US2 “exception-specific error handling” (T017) has nothing concrete to target.