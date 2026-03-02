const STORAGE_KEYS = {
  users: "ece493.users",
  session: "ece493.session",
  audit: "ece493.audit"
};

export function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function isStrongPassword(password) {
  const value = String(password ?? "");
  return value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value);
}

function safeParseArray(raw) {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeParseObject(raw) {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function buildValidationError(field, code, message) {
  return { field, code, message };
}

export function createChangePasswordStorageAdapter(storage) {
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
    throw new Error("A LocalStorage-like object is required.");
  }

  return {
    loadUsers() {
      return safeParseArray(storage.getItem(STORAGE_KEYS.users));
    },
    saveUsers(users) {
      storage.setItem(STORAGE_KEYS.users, JSON.stringify(users));
    },
    loadSession() {
      return safeParseObject(storage.getItem(STORAGE_KEYS.session));
    },
    appendAudit(entry) {
      const auditLog = safeParseArray(storage.getItem(STORAGE_KEYS.audit));
      auditLog.push(entry);
      storage.setItem(STORAGE_KEYS.audit, JSON.stringify(auditLog));
    }
  };
}

export function validateChangePasswordInput(input) {
  const errors = [];
  const currentPassword = String(input?.current_password ?? "");
  const newPassword = String(input?.new_password ?? "");

  if (!currentPassword) {
    errors.push(buildValidationError("current_password", "required", "Current password is required."));
  }

  if (!newPassword) {
    errors.push(buildValidationError("new_password", "required", "New password is required."));
  } else if (!isStrongPassword(newPassword)) {
    errors.push(
      buildValidationError(
        "new_password",
        "weak_password",
        "New password must be at least 8 characters and include letters and numbers."
      )
    );
  }

  if (currentPassword && newPassword && currentPassword === newPassword) {
    errors.push(
      buildValidationError("new_password", "same_as_current", "New password must be different from current password.")
    );
  }

  return errors;
}

function recordAuditSafely(adapter, payload) {
  try {
    adapter.appendAudit(payload);
  } catch {
    // Audit failures must not block user-facing password updates.
  }
}

export function changePassword(input, options = {}) {
  if (!options.adapter) {
    throw new Error("changePassword requires an adapter option.");
  }

  const nowProvider = typeof options.nowProvider === "function" ? options.nowProvider : () => new Date().toISOString();
  const auditBase = {
    requested_at: nowProvider()
  };

  let users;
  let session;
  try {
    users = options.adapter.loadUsers();
    session = options.adapter.loadSession();
  } catch (error) {
    const updateFailureError = buildValidationError(
      "system",
      "update_failed",
      "Password update failed. Please retry later."
    );

    recordAuditSafely(options.adapter, {
      ...auditBase,
      status: "update_failed",
      error: String(error?.message ?? error)
    });

    return {
      status: "update_failed",
      message: "Update failure. Please retry later.",
      errors: [updateFailureError]
    };
  }

  if (!session?.email) {
    const authError = buildValidationError("system", "not_authenticated", "Please log in before changing password.");

    recordAuditSafely(options.adapter, {
      ...auditBase,
      status: "validation_failed",
      errors: [authError]
    });

    return {
      status: "validation_failed",
      message: "Validation failed.",
      errors: [authError]
    };
  }

  const email = normalizeEmail(session.email);
  const validationErrors = validateChangePasswordInput(input);
  const submittedCurrentPassword =
    typeof input === "object" && input !== null ? String(input.current_password) : "";

  const userIndex = users.findIndex((candidate) => normalizeEmail(candidate.email) === email);
  if (userIndex === -1) {
    validationErrors.push(
      buildValidationError("current_password", "incorrect_current", "Current password is incorrect.")
    );
  }

  if (validationErrors.length === 0 && String(users[userIndex].password) !== submittedCurrentPassword) {
    validationErrors.push(
      buildValidationError("current_password", "incorrect_current", "Current password is incorrect.")
    );
  }

  if (validationErrors.length > 0) {
    recordAuditSafely(options.adapter, {
      ...auditBase,
      email,
      status: "validation_failed",
      errors: validationErrors
    });

    return {
      status: "validation_failed",
      message: "Validation failed.",
      errors: validationErrors
    };
  }

  const updatedUsers = users.map((user, index) =>
    index === userIndex
      ? {
          ...user,
          password: String(input.new_password),
          updated_at: nowProvider()
        }
      : user
  );

  try {
    options.adapter.saveUsers(updatedUsers);

    recordAuditSafely(options.adapter, {
      ...auditBase,
      email,
      status: "success"
    });

    return {
      status: "success",
      message: "Password updated successfully.",
      errors: []
    };
  } catch (error) {
    const updateFailureError = buildValidationError(
      "system",
      "update_failed",
      "Password update failed. Please retry later."
    );

    recordAuditSafely(options.adapter, {
      ...auditBase,
      email,
      status: "update_failed",
      error: String(error?.message ?? error)
    });

    return {
      status: "update_failed",
      message: "Update failure. Please retry later.",
      errors: [updateFailureError]
    };
  }
}

export function clearChangePasswordErrorState(elements) {
  elements.summary.textContent = "";
  elements.summary.hidden = true;

  for (const fieldKey of ["current_password", "new_password"]) {
    elements.fieldErrors[fieldKey].textContent = "";
    elements.fieldErrors[fieldKey].hidden = true;
  }
}

export function renderChangePasswordErrorState(errors, elements) {
  clearChangePasswordErrorState(elements);

  if (!errors.length) {
    return;
  }

  elements.summary.hidden = false;
  elements.summary.textContent = errors.map((error) => error.message).join(" ");

  for (const error of errors) {
    if (Object.prototype.hasOwnProperty.call(elements.fieldErrors, error.field)) {
      elements.fieldErrors[error.field].textContent = error.message;
      elements.fieldErrors[error.field].hidden = false;
    }
  }
}

export function showChangePasswordSuccessView(elements) {
  elements.formContainer.hidden = true;
  elements.successContainer.hidden = false;
  elements.successMessage.textContent = "Password changed successfully.";
}

export function initChangePasswordApp(options = {}) {
  const doc = options.document ?? (typeof document !== "undefined" ? document : null);
  if (!doc) {
    return null;
  }

  const form = doc.getElementById("change-password-form");
  if (!form) {
    return null;
  }

  const storage =
    options.storage ??
    (typeof window !== "undefined" && window.localStorage ? window.localStorage : null);

  const adapter = options.adapter ?? createChangePasswordStorageAdapter(storage);

  const elements = {
    formContainer: doc.getElementById("change-password-form-container"),
    successContainer: doc.getElementById("change-password-success-container"),
    successMessage: doc.getElementById("change-password-success-message"),
    summary: doc.getElementById("change-password-error-summary"),
    fieldErrors: {
      current_password: doc.getElementById("current-password-error"),
      new_password: doc.getElementById("new-password-error")
    },
    inputs: {
      current_password: doc.getElementById("current-password"),
      new_password: doc.getElementById("new-password")
    }
  };

  const onSubmit = (event) => {
    event?.preventDefault?.();

    const payload = {
      current_password: elements.inputs.current_password.value,
      new_password: elements.inputs.new_password.value
    };

    const result = changePassword(payload, { adapter });

    if (result.status === "success") {
      clearChangePasswordErrorState(elements);
      showChangePasswordSuccessView(elements);
      form.reset();
      return result;
    }

    renderChangePasswordErrorState(result.errors, elements);
    form.reset();
    return result;
  };

  form.addEventListener("submit", onSubmit);
  return { form, onSubmit, adapter, elements };
}
