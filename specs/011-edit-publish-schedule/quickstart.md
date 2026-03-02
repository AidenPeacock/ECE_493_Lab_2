# Quickstart: Edit & Publish Schedule

## Display The Website

1. Open a modern browser (Chrome, Firefox, or Edge).
2. Open `/home/aiden/ECE_493_Lab_2/src/index.html` directly in the browser.
   - If your browser blocks local file scripts, serve the folder with a simple
     local server (optional):
     - From `/home/aiden/ECE_493_Lab_2`, run: `python3 -m http.server`
     - Then open `http://localhost:8000/src/index.html`

## Manual Test Steps

1. Navigate to the Edit & Publish Schedule flow.
2. Enter a valid schedule with non-overlapping entries and submit.
3. Confirm a success outcome message and a new published version.
4. Trigger a validation conflict by creating two entries in the same room with overlapping times; submit and confirm a clear error.
5. Enable the "Simulate Save Failure" toggle, submit a valid schedule, and confirm a service/storage error with no saved changes.
6. Enable the "Simulate Announcement Failure" toggle, submit a valid schedule, and confirm a publish/announcement error with no saved changes.
7. Double-submit quickly (click submit twice) and confirm idempotent handling (no duplicate publish records).

## Expected Results

- Successful submissions show a success confirmation and a published version update.
- Validation conflicts show clear, field-specific error messages.
- Simulated failures show service/announcement errors and do not change the saved schedule.
- Double-submit does not create duplicate records.
- The flow follows the acceptance scenarios in the spec.
