# Quickstart: Pay for Attendance & Receive Ticket

## Display The Website

1. Open a modern browser (Chrome, Firefox, or Edge).
2. Open `/home/aiden/ECE_493_Lab_2/src/index.html` directly in the browser.
   - If your browser blocks local file scripts, serve the folder with a simple
     local server (optional):
     - From `/home/aiden/ECE_493_Lab_2`, run: `python3 -m http.server`
     - Then open `http://localhost:8000/src/index.html`

## Manual Test Steps

1. Navigate to the pay for attendance & receive ticket flow.
2. Enter valid inputs for the flow.
3. Submit and confirm a success outcome message.
4. Trigger a validation error and confirm a clear error message.
5. Validate scenario: **Given** user is logged in; registration is open; price list exists., **When** they complete pay for attendance & receive ticket, **Then** payment confirmation stored; ticket/confirmation sent to user.

## Expected Results

- Successful submissions show a success confirmation.
- Invalid inputs show clear, field-specific error messages.
- The flow follows the acceptance scenarios in the spec.
