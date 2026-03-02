# Quickstart: Submit Paper Review

## Display The Website

1. Open a modern browser (Chrome, Firefox, or Edge).
2. Open `/home/aiden/ECE_493_Lab_2/src/index.html` directly in the browser.
   - If your browser blocks local file scripts, serve the folder with a simple
     local server (optional):
     - From `/home/aiden/ECE_493_Lab_2`, run: `python3 -m http.server`
     - Then open `http://localhost:8000/src/index.html`

## Manual Test Steps

1. Navigate to the submit paper review flow.
2. Enter valid inputs for the flow.
3. Submit and confirm a success outcome message.
4. Trigger a validation error and confirm a clear error message.
5. Validate scenario: **Given** referee is logged in; referee has accepted invitation; paper appears in account., **When** they complete submit paper review, **Then** review stored; editor receives review when appropriate.

## Expected Results

- Successful submissions show a success confirmation.
- Invalid inputs show clear, field-specific error messages.
- The flow follows the acceptance scenarios in the spec.
