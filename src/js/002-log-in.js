const STORAGE_KEYS = {
  users: "ece493.users",
  session: "ece493.session",
  audit: "ece493.audit"
};

export function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function isValidEmailFormat(email) {
  const value = normalizeEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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

export function buildValidationError(field, code, message) {
  return { field, code, message };
}

export function createLoginStorageAdapter(storage) {
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
    throw new Error("A LocalStorage-like object is required.");
  }

  return {
    loadUsers() {
      return safeParseArray(storage.getItem(STORAGE_KEYS.users));
    },
    saveSession(session) {
      storage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
    },
    clearSession() {
      storage.setItem(STORAGE_KEYS.session, "");
    },
    appendAudit(entry) {
      const auditLog = safeParseArray(storage.getItem(STORAGE_KEYS.audit));
      auditLog.push(entry);
      storage.setItem(STORAGE_KEYS.audit, JSON.stringify(auditLog));
    }
  };
}

export function validateLoginInput(input) {
  const errors = [];
  const email = normalizeEmail(input?.email);
  const password = String(input?.password ?? "");

  if (!email) {
    errors.push(buildValidationError("email", "required", "Email is required."));
  } else if (!isValidEmailFormat(email)) {
    errors.push(buildValidationError("email", "invalid_format", "Enter a valid email address."));
  }

  if (!password) {
    errors.push(buildValidationError("password", "required", "Password is required."));
  }

  return errors;
}

export function authenticateUser(input, users) {
  const email = normalizeEmail(input?.email);
  const password = String(input?.password ?? "");

  const user = users.find((candidate) => normalizeEmail(candidate.email) === email);
  if (!user || String(user.password) !== password) {
    return null;
  }

  return user;
}

export function generateId(randomUUIDFn) {
  if (typeof randomUUIDFn === "function") {
    return randomUUIDFn();
  }

  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function recordAuditSafely(adapter, payload) {
  try {
    adapter.appendAudit(payload);
  } catch {
    // Audit failures do not block user-facing auth behavior.
  }
}

export function loginUser(input, options = {}) {
  if (!options.adapter) {
    throw new Error("loginUser requires an adapter option.");
  }

  const nowProvider = typeof options.nowProvider === "function" ? options.nowProvider : () => new Date().toISOString();
  const auditBase = {
    requested_at: nowProvider(),
    email: normalizeEmail(input?.email)
  };

  let users;
  try {
    users = options.adapter.loadUsers();
  } catch (error) {
    const serviceError = buildValidationError(
      "system",
      "service_unavailable",
      "Authentication service is currently unavailable. Please retry later."
    );

    recordAuditSafely(options.adapter, {
      ...auditBase,
      status: "service_unavailable",
      error: String(error?.message ?? error)
    });

    return {
      status: "service_unavailable",
      message: "Service unavailable. Please retry later.",
      errors: [serviceError]
    };
  }

  const validationErrors = validateLoginInput(input);
  if (validationErrors.length > 0) {
    recordAuditSafely(options.adapter, {
      ...auditBase,
      status: "validation_failed",
      errors: validationErrors
    });

    return {
      status: "validation_failed",
      message: "Validation failed.",
      errors: validationErrors
    };
  }

  const authenticatedUser = authenticateUser(input, users);
  if (!authenticatedUser) {
    const invalidCredentialsError = buildValidationError(
      "system",
      "invalid_credentials",
      "Invalid credentials."
    );

    recordAuditSafely(options.adapter, {
      ...auditBase,
      status: "invalid_credentials"
    });

    return {
      status: "invalid_credentials",
      message: "Invalid credentials.",
      errors: [invalidCredentialsError]
    };
  }

  const session = {
    id: generateId(options.idProvider),
    email: normalizeEmail(authenticatedUser.email),
    role: String(authenticatedUser.role ?? "attendee"),
    created_at: nowProvider()
  };

  try {
    options.adapter.saveSession(session);
    recordAuditSafely(options.adapter, {
      ...auditBase,
      status: "success",
      session_id: session.id
    });

    return {
      status: "success",
      message: "Login successful.",
      errors: [],
      home_view: `${session.role}-home`
    };
  } catch (error) {
    const serviceError = buildValidationError(
      "system",
      "service_unavailable",
      "Authentication service is currently unavailable. Please retry later."
    );

    recordAuditSafely(options.adapter, {
      ...auditBase,
      status: "service_unavailable",
      error: String(error?.message ?? error)
    });

    return {
      status: "service_unavailable",
      message: "Service unavailable. Please retry later.",
      errors: [serviceError]
    };
  }
}

export function clearLoginErrorState(elements) {
  elements.summary.textContent = "";
  elements.summary.hidden = true;

  for (const fieldKey of ["email", "password"]) {
    elements.fieldErrors[fieldKey].textContent = "";
    elements.fieldErrors[fieldKey].hidden = true;
  }
}

export function renderLoginErrorState(errors, elements) {
  clearLoginErrorState(elements);

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

export function showLoginSuccessView(elements, homeView) {
  elements.formContainer.hidden = true;
  elements.successContainer.hidden = false;
  elements.successMessage.textContent = `Authenticated. Redirecting to ${homeView}.`;
}

export function emitSessionChanged(eventTarget) {
  if (!eventTarget || typeof eventTarget.dispatchEvent !== "function") {
    return;
  }

  try {
    eventTarget.dispatchEvent(new Event("ece493:session-changed"));
  } catch {
    // Ignore event dispatch failures in non-browser environments.
  }
}

export function initLoginApp(options = {}) {
  const doc = options.document ?? (typeof document !== "undefined" ? document : null);
  if (!doc) {
    return null;
  }

  const form = doc.getElementById("login-form");
  if (!form) {
    return null;
  }

  const storage =
    options.storage ??
    (typeof window !== "undefined" && window.localStorage ? window.localStorage : null);
  const eventTarget = options.eventTarget ?? (typeof window !== "undefined" ? window : null);

  const adapter = options.adapter ?? createLoginStorageAdapter(storage);

  const elements = {
    formContainer: doc.getElementById("login-form-container"),
    successContainer: doc.getElementById("login-success-container"),
    successMessage: doc.getElementById("login-success-message"),
    summary: doc.getElementById("login-error-summary"),
    fieldErrors: {
      email: doc.getElementById("login-email-error"),
      password: doc.getElementById("login-password-error")
    },
    inputs: {
      email: doc.getElementById("login-email"),
      password: doc.getElementById("login-password")
    }
  };

  const onSubmit = (event) => {
    event?.preventDefault?.();

    const payload = {
      email: elements.inputs.email.value,
      password: elements.inputs.password.value
    };

    const result = loginUser(payload, { adapter });

    if (result.status === "success") {
      clearLoginErrorState(elements);
      showLoginSuccessView(elements, result.home_view);
      form.reset();
      emitSessionChanged(eventTarget);
      return result;
    }

    renderLoginErrorState(result.errors, elements);
    adapter.clearSession();
    form.reset();
    emitSessionChanged(eventTarget);
    return result;
  };

  form.addEventListener("submit", onSubmit);
  return { form, onSubmit, adapter, elements };
}
