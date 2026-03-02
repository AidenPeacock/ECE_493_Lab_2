const STORAGE_KEYS = {
  assignments: "ece493.assignments",
  audit: "ece493.audit"
};

export function normalizeText(value) {
  return String(value ?? "").trim();
}

export function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
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

function normalizedDirectory(input) {
  if (!Array.isArray(input?.referee_directory)) {
    return null;
  }

  return input.referee_directory.map((entry) => normalizeEmail(entry)).filter(Boolean);
}

export function validateAssignRefereesInput(input) {
  const errors = [];
  const paperId = normalizeText(input?.paper_id);
  const referees = Array.isArray(input?.referees) ? input.referees : [];
  const directory = normalizedDirectory(input);

  if (!paperId) {
    errors.push(buildValidationError("paper_id", "required", "Paper ID is required."));
  }

  if (referees.length !== 3) {
    errors.push(
      buildValidationError("referees", "exact_three_required", "Exactly three referees are required.")
    );
    return errors;
  }

  const seen = new Set();

  referees.forEach((referee, index) => {
    const fieldPrefix = `referee_${index + 1}`;
    const email = normalizeEmail(referee?.email);
    const assignedPapers = Number(referee?.current_assigned_papers ?? 0);

    if (!email) {
      errors.push(buildValidationError(fieldPrefix, "required", `Referee ${index + 1} email is required.`));
      return;
    }

    if (!isValidEmailFormat(email)) {
      errors.push(buildValidationError(fieldPrefix, "invalid_format", `Referee ${index + 1} email is invalid.`));
      return;
    }

    if (directory && !directory.includes(email)) {
      errors.push(buildValidationError(fieldPrefix, "unknown_referee", `Referee ${index + 1} was not found.`));
      return;
    }

    if (!Number.isFinite(assignedPapers) || assignedPapers < 0) {
      errors.push(buildValidationError(fieldPrefix, "invalid_load", `Referee ${index + 1} load is invalid.`));
      return;
    }

    if (assignedPapers >= 5) {
      errors.push(
        buildValidationError(
          fieldPrefix,
          "max_assigned_exceeded",
          `Referee ${index + 1} cannot exceed 5 assigned papers.`
        )
      );
      return;
    }

    if (seen.has(email)) {
      errors.push(buildValidationError(fieldPrefix, "duplicate_referee", "Each referee must be unique."));
      return;
    }

    seen.add(email);
  });

  return errors;
}

export function createAssignRefereesStorageAdapter(storage) {
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
    throw new Error("A LocalStorage-like object is required.");
  }

  return {
    loadAssignments() {
      return safeParseArray(storage.getItem(STORAGE_KEYS.assignments));
    },
    saveAssignments(assignments) {
      storage.setItem(STORAGE_KEYS.assignments, JSON.stringify(assignments));
    },
    appendAudit(entry) {
      const auditLog = safeParseArray(storage.getItem(STORAGE_KEYS.audit));
      auditLog.push(entry);
      storage.setItem(STORAGE_KEYS.audit, JSON.stringify(auditLog));
    }
  };
}

export function generateId(randomUUIDFn) {
  if (typeof randomUUIDFn === "function") {
    return randomUUIDFn();
  }

  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function assignmentFingerprint(input) {
  const emails = input.referees.map((referee) => normalizeEmail(referee.email));
  return [normalizeText(input.paper_id).toLowerCase(), ...emails].join("|");
}

function recordAuditSafely(adapter, payload) {
  try {
    adapter.appendAudit(payload);
  } catch {
    // Audit failures must not block user-facing assignment behavior.
  }
}

export function assignReferees(input, options = {}) {
  if (!options.adapter) {
    throw new Error("assignReferees requires an adapter option.");
  }

  const nowProvider = typeof options.nowProvider === "function" ? options.nowProvider : () => new Date().toISOString();
  const auditBase = {
    requested_at: nowProvider(),
    paper_id: normalizeText(input?.paper_id)
  };

  const validationErrors = validateAssignRefereesInput(input);
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

  let assignments;
  try {
    assignments = options.adapter.loadAssignments();
  } catch (error) {
    const serviceError = buildValidationError(
      "system",
      "service_unavailable",
      "Assignment service is unavailable. Please retry later."
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

  const fingerprint = assignmentFingerprint(input);
  const duplicate = assignments.find((entry) => entry.fingerprint === fingerprint);
  if (duplicate) {
    recordAuditSafely(options.adapter, {
      ...auditBase,
      status: "success",
      duplicate_of: duplicate.id
    });

    return {
      status: "success",
      message: "Assignments already exist.",
      errors: [],
      assignment_id: duplicate.id
    };
  }

  const deliveryFn = typeof options.deliveryFn === "function" ? options.deliveryFn : () => true;

  let deliveryFailure = null;

  input.referees.forEach((referee) => {
    if (deliveryFailure) {
      return;
    }

    const email = normalizeEmail(referee.email);

    try {
      if (!deliveryFn(email, input.paper_id)) {
        const deliveryError = buildValidationError(
          "system",
          "delivery_failed",
          "Invitation delivery failed. Please retry."
        );

        recordAuditSafely(options.adapter, {
          ...auditBase,
          status: "delivery_failed",
          referee_email: email
        });

        deliveryFailure = {
          status: "delivery_failed",
          message: "Invitation delivery failed.",
          errors: [deliveryError]
        };
      }
    } catch (error) {
      const deliveryError = buildValidationError(
        "system",
        "delivery_failed",
        "Invitation delivery failed. Please retry."
      );

      recordAuditSafely(options.adapter, {
        ...auditBase,
        status: "delivery_failed",
        referee_email: email,
        error: String(error?.message ?? error)
      });

      deliveryFailure = {
        status: "delivery_failed",
        message: "Invitation delivery failed.",
        errors: [deliveryError]
      };
    }
  });

  if (deliveryFailure) {
    return deliveryFailure;
  }

  const assignment = {
    id: generateId(options.idProvider),
    paper_id: normalizeText(input.paper_id),
    referees: input.referees.map((referee) => ({
      email: normalizeEmail(referee.email),
      status: "invited"
    })),
    fingerprint,
    created_at: nowProvider()
  };

  try {
    options.adapter.saveAssignments([...assignments, assignment]);

    recordAuditSafely(options.adapter, {
      ...auditBase,
      status: "success",
      assignment_id: assignment.id
    });

    return {
      status: "success",
      message: "Referees assigned successfully.",
      errors: [],
      assignment_id: assignment.id
    };
  } catch (error) {
    const serviceError = buildValidationError(
      "system",
      "service_unavailable",
      "Assignment service is unavailable. Please retry later."
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

export function clearAssignRefereesErrorState(elements) {
  elements.summary.textContent = "";
  elements.summary.hidden = true;

  for (const fieldKey of ["paper_id", "referee_1", "referee_2", "referee_3", "referees"]) {
    elements.fieldErrors[fieldKey].textContent = "";
    elements.fieldErrors[fieldKey].hidden = true;
  }
}

export function renderAssignRefereesErrorState(errors, elements) {
  clearAssignRefereesErrorState(elements);

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

export function showAssignRefereesSuccessView(elements) {
  elements.formContainer.hidden = true;
  elements.successContainer.hidden = false;
  elements.successMessage.textContent = "Referee invitations sent successfully.";
}

export function initAssignRefereesApp(options = {}) {
  const doc = options.document ?? (typeof document !== "undefined" ? document : null);
  if (!doc) {
    return null;
  }

  const form = doc.getElementById("assign-referees-form");
  if (!form) {
    return null;
  }

  const storage =
    options.storage ??
    (typeof window !== "undefined" && window.localStorage ? window.localStorage : null);

  const adapter = options.adapter ?? createAssignRefereesStorageAdapter(storage);

  const elements = {
    formContainer: doc.getElementById("assign-referees-form-container"),
    successContainer: doc.getElementById("assign-referees-success-container"),
    successMessage: doc.getElementById("assign-referees-success-message"),
    summary: doc.getElementById("assign-referees-error-summary"),
    fieldErrors: {
      paper_id: doc.getElementById("assign-referees-paper-id-error"),
      referees: doc.getElementById("assign-referees-referees-error"),
      referee_1: doc.getElementById("assign-referees-referee-1-error"),
      referee_2: doc.getElementById("assign-referees-referee-2-error"),
      referee_3: doc.getElementById("assign-referees-referee-3-error")
    },
    inputs: {
      paper_id: doc.getElementById("assign-referees-paper-id"),
      referee_1_email: doc.getElementById("assign-referees-referee-1-email"),
      referee_1_load: doc.getElementById("assign-referees-referee-1-load"),
      referee_2_email: doc.getElementById("assign-referees-referee-2-email"),
      referee_2_load: doc.getElementById("assign-referees-referee-2-load"),
      referee_3_email: doc.getElementById("assign-referees-referee-3-email"),
      referee_3_load: doc.getElementById("assign-referees-referee-3-load")
    }
  };

  const onSubmit = (event) => {
    event?.preventDefault?.();

    const payload = {
      paper_id: elements.inputs.paper_id.value,
      referees: [
        {
          email: elements.inputs.referee_1_email.value,
          current_assigned_papers: elements.inputs.referee_1_load.value
        },
        {
          email: elements.inputs.referee_2_email.value,
          current_assigned_papers: elements.inputs.referee_2_load.value
        },
        {
          email: elements.inputs.referee_3_email.value,
          current_assigned_papers: elements.inputs.referee_3_load.value
        }
      ]
    };

    const result = assignReferees(payload, { adapter });

    if (result.status === "success") {
      clearAssignRefereesErrorState(elements);
      showAssignRefereesSuccessView(elements);
      form.reset();
      return result;
    }

    renderAssignRefereesErrorState(result.errors, elements);
    return result;
  };

  form.addEventListener("submit", onSubmit);
  return { form, onSubmit, adapter, elements };
}
