# Quickstart: Assign Referees

## Display The Website

1. Open a modern browser (Chrome, Firefox, or Edge).
2. Open `/home/aiden/ECE_493_Lab_2/src/index.html` directly in the browser.
   - If your browser blocks local file scripts, serve the folder with a simple
     local server (optional):
     - From `/home/aiden/ECE_493_Lab_2`, run: `python3 -m http.server`
     - Then open `http://localhost:8000/src/index.html`

## Manual Test Steps

1. Navigate to the assign referees flow.
2. Enter valid inputs for the flow.
3. Submit and confirm a success outcome message.
4. Trigger a validation error and confirm a clear error message.
5. Validate scenario: **Given** editor is logged in; at least one paper exists to assign., **When** they complete assign referees, **Then** invitations sent; assignments recorded subject to acceptance.

## Expected Results

- Successful submissions show a success confirmation.
- Invalid inputs show clear, field-specific error messages.
- The flow follows the acceptance scenarios in the spec.
