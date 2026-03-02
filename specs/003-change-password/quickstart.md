# Quickstart: Change Password Use Case

## Display The Website

1. Open a modern browser (Chrome, Firefox, or Edge).
2. Open `/home/aiden/ECE_493_Lab_2/src/index.html` directly in the browser.
   - If your browser blocks local file scripts, serve the folder with a simple
     local server (optional):
     - From `/home/aiden/ECE_493_Lab_2`, run: `python3 -m http.server`
     - Then open `http://localhost:8000/src/index.html`

## Manual Test Steps

1. Navigate to the change password form.
2. Enter the current password and a valid new password (8+ chars, letters + numbers).
3. Submit the form.
4. Confirm you see a success message and the password is updated.
5. Enter an incorrect current password and submit.
6. Confirm a clear error appears and the password is unchanged.
7. Enter a weak new password and submit.
8. Confirm a password rule error appears and the password is unchanged.
9. Simulate an update failure (e.g., disable LocalStorage in dev tools), submit
   the form, and confirm an update-failure error appears and the password is not changed.
10. Retry after the update failure and confirm the system re-validates inputs.

## Expected Results

- Successful change updates the stored password and shows a confirmation.
- Incorrect current password shows a clear error and keeps the password unchanged.
- Weak new password is rejected with a specific error.
- Update failures show a specific error and require a retry.
