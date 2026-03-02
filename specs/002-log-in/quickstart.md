# Quickstart: Log In Use Case

## Display The Website

1. Open a modern browser (Chrome, Firefox, or Edge).
2. Open `/home/aiden/ECE_493_Lab_2/src/index.html` directly in the browser.
   - If your browser blocks local file scripts, serve the folder with a simple
     local server (optional):
     - From `/home/aiden/ECE_493_Lab_2`, run: `python3 -m http.server`
     - Then open `http://localhost:8000/src/index.html`

## Manual Test Steps

1. Navigate to the log in form.
2. Enter a valid email and password and submit.
3. Confirm you see a success message and land on the role-appropriate home view.
4. Enter an invalid email or wrong password and submit.
5. Confirm a generic invalid-credentials error appears.
6. Simulate a service/database outage (e.g., disable LocalStorage in dev tools),
   submit, and confirm a service-unavailable error appears and no session is created.

## Expected Results

- Successful log in shows a success confirmation and enters the correct home view.
- Invalid credentials always show a single generic error.
- Service/database unavailability shows a clear error and creates no session.
