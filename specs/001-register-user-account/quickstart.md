# Quickstart: Register User Account Use Case

## Display The Website

1. Open a modern browser (Chrome, Firefox, or Edge).
2. Open `/home/aiden/ECE_493_Lab_2/src/index.html` directly in the browser.
   - If your browser blocks local file scripts, serve the folder with a simple
     local server (optional):
     - From `/home/aiden/ECE_493_Lab_2`, run: `python3 -m http.server`
     - Then open `http://localhost:8000/src/index.html`

## Manual Test Steps

1. Navigate to the registration form.
2. Enter a valid email, password (8+ chars, letters + numbers), and role.
3. Submit the form.
4. Confirm you see a success message and are directed to the login page view.
5. Try an invalid email and confirm an inline error appears.
6. Try a password without numbers and confirm a password rule error appears.
7. Try registering the same email twice and confirm a duplicate email error.
8. Simulate a storage failure (e.g., disable LocalStorage in dev tools), submit
   the form, and confirm a storage error appears and the form does not retain
   entered data on retry.
9. Retry registration after storage failure and confirm inputs are re-validated.

## Expected Results

- Successful registration stores the user and shows a success confirmation.
- Invalid inputs show clear, field-specific error messages.
- Duplicate emails are rejected with a specific message.
- Storage failures show a specific error and require re-entry on retry.
- Retry after storage failure re-validates inputs before submission.
