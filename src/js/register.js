export const VALID_ROLES = ["author", "reviewer", "editor", "attendee"];

const STORAGE_KEYS = {
  users: "ece493.users",
  audit: "ece493.audit"
};

export function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function isValidEmailFormat(email) {
  const value = normalizeEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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

export function createLocalStorageAdapter(storage) {
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
    loadAudit() {
      return safeParseArray(storage.getItem(STORAGE_KEYS.audit));
    },
    appendAudit(entry) {
      const auditLog = safeParseArray(storage.getItem(STORAGE_KEYS.audit));
      auditLog.push(entry);
      storage.setItem(STORAGE_KEYS.audit, JSON.stringify(auditLog));
    }
  };
}

export function buildValidationError(field, code, message) {
  return { field, code, message };
}

export function validateRegistrationInput(input, existingUsers = []) {
  const errors = [];
  const email = normalizeEmail(input?.email);
  const password = String(input?.password ?? "");
  const role = String(input?.role ?? "");

  if (!email) {
    errors.push(buildValidationError("email", "required", "Email is required."));
  } else if (!isValidEmailFormat(email)) {
    errors.push(buildValidationError("email", "invalid_format", "Enter a valid email address."));
  } else if (existingUsers.some((user) => normalizeEmail(user.email) === email)) {
    errors.push(buildValidationError("email", "already_registered", "Email is already registered."));
  }

  if (!password) {
    errors.push(buildValidationError("password", "required", "Password is required."));
  } else if (!isStrongPassword(password)) {
    errors.push(
      buildValidationError(
        "password",
        "weak_password",
        "Password must be at least 8 characters and include letters and numbers."
      )
    );
  }

  if (!VALID_ROLES.includes(role)) {
    errors.push(buildValidationError("role", "invalid_role", "Select a valid role."));
  }

  return errors;
}

export function generateId(randomUUIDFn) {
  if (typeof randomUUIDFn === "function") {
    return randomUUIDFn();
  }

  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function registerUserAccount(input, options = {}) {
  if (!options.adapter) {
    throw new Error("registerUserAccount requires an adapter option.");
  }

  const nowProvider = typeof options.nowProvider === "function" ? options.nowProvider : () => new Date().toISOString();
  const existingUsers = options.adapter.loadUsers();
  const errors = validateRegistrationInput(input, existingUsers);

  const auditBase = {
    requested_at: nowProvider(),
    email: normalizeEmail(input?.email),
    role: String(input?.role ?? "")
  };

  if (errors.length > 0) {
    try {
      options.adapter.appendAudit({ ...auditBase, status: "validation_failed", errors });
    } catch {
      // Audit failure must not block validation feedback.
    }

    return {
      status: "validation_failed",
      errors,
      message: "Validation failed."
    };
  }

  const user = {
    id: generateId(options.idProvider),
    email: normalizeEmail(input.email),
    password: String(input.password),
    role: String(input.role),
    created_at: nowProvider()
  };

  try {
    options.adapter.saveUsers([...existingUsers, user]);
    options.adapter.appendAudit({ ...auditBase, status: "success", user_id: user.id });

    return {
      status: "success",
      user_id: user.id,
      message: "Account created successfully.",
      errors: []
    };
  } catch (error) {
    const storageError = buildValidationError(
      "system",
      "storage_failure",
      "We could not save your account right now. Please retry."
    );

    try {
      options.adapter.appendAudit({
        ...auditBase,
        status: "storage_failed",
        error: String(error?.message ?? error)
      });
    } catch {
      // Ignore audit write failures on storage failure path.
    }

    return {
      status: "storage_failed",
      errors: [storageError],
      message: "Storage failure. Please retry."
    };
  }
}

export function clearErrorState(elements) {
  elements.summary.textContent = "";
  elements.summary.hidden = true;

  for (const fieldKey of ["email", "password", "role"]) {
    elements.fieldErrors[fieldKey].textContent = "";
    elements.fieldErrors[fieldKey].hidden = true;
  }
}

export function renderErrorState(errors, elements) {
  clearErrorState(elements);

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

export function showSuccessView(elements, email) {
  elements.formContainer.hidden = true;
  elements.successContainer.hidden = false;
  elements.successMessage.textContent = `Account for ${email} registered. Proceed to login.`;
}

export function initRegistrationApp(options = {}) {
  const doc = options.document ?? (typeof document !== "undefined" ? document : null);
  if (!doc) {
    return null;
  }

  const form = doc.getElementById("register-form");
  if (!form) {
    return null;
  }

  const storage =
    options.storage ??
    (typeof window !== "undefined" && window.localStorage ? window.localStorage : null);

  const adapter = options.adapter ?? createLocalStorageAdapter(storage);

  const elements = {
    formContainer: doc.getElementById("form-container"),
    successContainer: doc.getElementById("success-container"),
    successMessage: doc.getElementById("success-message"),
    summary: doc.getElementById("error-summary"),
    fieldErrors: {
      email: doc.getElementById("email-error"),
      password: doc.getElementById("password-error"),
      role: doc.getElementById("role-error")
    },
    inputs: {
      email: doc.getElementById("email"),
      password: doc.getElementById("password"),
      role: doc.getElementById("role")
    }
  };

  const onSubmit = (event) => {
    event?.preventDefault?.();

    const payload = {
      email: elements.inputs.email.value,
      password: elements.inputs.password.value,
      role: elements.inputs.role.value
    };

    const result = registerUserAccount(payload, { adapter });

    if (result.status === "success") {
      clearErrorState(elements);
      showSuccessView(elements, normalizeEmail(payload.email));
      form.reset();
      return result;
    }

    renderErrorState(result.errors, elements);

    if (result.status === "storage_failed") {
      form.reset();
    }

    return result;
  };

  form.addEventListener("submit", onSubmit);
  return { form, onSubmit, adapter, elements };
}
