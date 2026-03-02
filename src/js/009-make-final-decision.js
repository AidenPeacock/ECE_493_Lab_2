const STORAGE_KEYS = {
  reviews: "ece493.reviews",
  finalDecisions: "ece493.finalDecisions",
  audit: "ece493.audit"
};

const VALID_DECISIONS = new Set(["accept", "reject", "revise"]);

export function normalizeText(value) {
  return String(value ?? "").trim();
}

export function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
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

export function validateMakeFinalDecisionInput(input) {
  const errors = [];
  const paperId = normalizeText(input?.paper_id);
  const editorEmail = normalizeEmail(input?.editor_email);
  const decision = normalizeText(input?.decision).toLowerCase();
  const reviewCount = Number(input?.review_count ?? 0);
  const notificationDelivered = input?.notification_delivered === true;

  if (!paperId) {
    errors.push(buildValidationError("paper_id", "required", "Paper ID is required."));
  }

  if (!editorEmail) {
    errors.push(buildValidationError("editor_email", "required", "Editor email is required."));
  }

  if (!VALID_DECISIONS.has(decision)) {
    errors.push(
      buildValidationError("decision", "invalid_decision", "Decision must be accept, reject, or revise.")
    );
  }

  if (!Number.isInteger(reviewCount) || reviewCount < 3) {
    errors.push(
      buildValidationError(
        "review_count",
        "insufficient_reviews",
        "At least three completed reviews are required before making a final decision."
      )
    );
  }

  if (!notificationDelivered) {
    errors.push(
      buildValidationError(
        "notification_delivered",
        "notification_failed",
        "Author notification must succeed before storing the final decision."
      )
    );
  }

  return errors;
}

export function createMakeFinalDecisionStorageAdapter(storage) {
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
    throw new Error("A LocalStorage-like object is required.");
  }

  return {
    loadReviews() {
      return safeParseArray(storage.getItem(STORAGE_KEYS.reviews));
    },
    loadFinalDecisions() {
      return safeParseArray(storage.getItem(STORAGE_KEYS.finalDecisions));
    },
    saveFinalDecisions(records) {
      storage.setItem(STORAGE_KEYS.finalDecisions, JSON.stringify(records));
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

function recordAuditSafely(adapter, payload) {
  try {
    adapter.appendAudit(payload);
  } catch {
    // Audit failures must never block the primary flow.
  }
}

function decisionFingerprint(input) {
  return normalizeText(input.paper_id).toLowerCase();
}

export function makeFinalDecision(input, options = {}) {
  if (!options.adapter) {
    throw new Error("makeFinalDecision requires an adapter option.");
  }

  const nowProvider = typeof options.nowProvider === "function" ? options.nowProvider : () => new Date().toISOString();
  const nowIso = nowProvider();

  const auditBase = {
    requested_at: nowIso,
    paper_id: normalizeText(input?.paper_id),
    editor_email: normalizeEmail(input?.editor_email)
  };

  const validationErrors = validateMakeFinalDecisionInput(input);
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

  let reviews;
  let decisions;
  try {
    reviews = options.adapter.loadReviews();
    decisions = options.adapter.loadFinalDecisions();
  } catch (error) {
    const serviceError = buildValidationError(
      "system",
      "service_unavailable",
      "Decision service is unavailable. Please retry later."
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

  const paperId = normalizeText(input.paper_id);
  const completedReviewCount = reviews.filter((review) => normalizeText(review?.paper_id) === paperId).length;

  if (completedReviewCount < 3) {
    const prerequisiteError = buildValidationError(
      "review_count",
      "insufficient_reviews",
      "At least three completed reviews are required before making a final decision."
    );

    recordAuditSafely(options.adapter, {
      ...auditBase,
      status: "validation_failed",
      errors: [prerequisiteError]
    });

    return {
      status: "validation_failed",
      message: "Validation failed.",
      errors: [prerequisiteError]
    };
  }

  const fingerprint = decisionFingerprint(input);
  const duplicate = decisions.find((decisionRecord) => decisionRecord.fingerprint === fingerprint);
  if (duplicate) {
    recordAuditSafely(options.adapter, {
      ...auditBase,
      status: "success",
      duplicate_of: duplicate.id
    });

    return {
      status: "success",
      message: "Final decision already recorded.",
      errors: [],
      decision_id: duplicate.id
    };
  }

  const record = {
    id: generateId(options.idProvider),
    paper_id: paperId,
    editor_email: normalizeEmail(input.editor_email),
    decision: normalizeText(input.decision).toLowerCase(),
    review_count: Number(input.review_count),
    notification_delivered: true,
    fingerprint,
    decided_at: nowIso
  };

  try {
    options.adapter.saveFinalDecisions([...decisions, record]);

    recordAuditSafely(options.adapter, {
      ...auditBase,
      status: "success",
      decision_id: record.id
    });

    return {
      status: "success",
      message: "Final decision recorded successfully.",
      errors: [],
      decision_id: record.id
    };
  } catch (error) {
    const serviceError = buildValidationError(
      "system",
      "service_unavailable",
      "Decision service is unavailable. Please retry later."
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

export function clearMakeFinalDecisionErrorState(elements) {
  elements.summary.textContent = "";
  elements.summary.hidden = true;

  for (const fieldKey of ["paper_id", "editor_email", "decision", "review_count", "notification_delivered"]) {
    elements.fieldErrors[fieldKey].textContent = "";
    elements.fieldErrors[fieldKey].hidden = true;
  }
}

export function renderMakeFinalDecisionErrorState(errors, elements) {
  clearMakeFinalDecisionErrorState(elements);

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

export function showMakeFinalDecisionSuccessView(elements) {
  elements.formContainer.hidden = true;
  elements.successContainer.hidden = false;
  elements.successMessage.textContent = "Final decision recorded successfully.";
}

export function initMakeFinalDecisionApp(options = {}) {
  const doc = options.document ?? (typeof document !== "undefined" ? document : null);
  if (!doc) {
    return null;
  }

  const form = doc.getElementById("make-final-decision-form");
  if (!form) {
    return null;
  }

  const storage =
    options.storage ??
    (typeof window !== "undefined" && window.localStorage ? window.localStorage : null);

  const adapter = options.adapter ?? createMakeFinalDecisionStorageAdapter(storage);

  const elements = {
    formContainer: doc.getElementById("make-final-decision-form-container"),
    successContainer: doc.getElementById("make-final-decision-success-container"),
    successMessage: doc.getElementById("make-final-decision-success-message"),
    summary: doc.getElementById("make-final-decision-error-summary"),
    fieldErrors: {
      paper_id: doc.getElementById("make-final-decision-paper-id-error"),
      editor_email: doc.getElementById("make-final-decision-editor-email-error"),
      decision: doc.getElementById("make-final-decision-decision-error"),
      review_count: doc.getElementById("make-final-decision-review-count-error"),
      notification_delivered: doc.getElementById("make-final-decision-notification-error")
    },
    inputs: {
      paper_id: doc.getElementById("make-final-decision-paper-id"),
      editor_email: doc.getElementById("make-final-decision-editor-email"),
      decision: doc.getElementById("make-final-decision-decision"),
      review_count: doc.getElementById("make-final-decision-review-count"),
      notification_delivered: doc.getElementById("make-final-decision-notification-delivered")
    }
  };

  const onSubmit = (event) => {
    event?.preventDefault?.();

    const payload = {
      paper_id: elements.inputs.paper_id.value,
      editor_email: elements.inputs.editor_email.value,
      decision: elements.inputs.decision.value,
      review_count: elements.inputs.review_count.value,
      notification_delivered: elements.inputs.notification_delivered.checked
    };

    const result = makeFinalDecision(payload, { adapter });

    if (result.status === "success") {
      clearMakeFinalDecisionErrorState(elements);
      showMakeFinalDecisionSuccessView(elements);
      form.reset();
      return result;
    }

    renderMakeFinalDecisionErrorState(result.errors, elements);
    return result;
  };

  form.addEventListener("submit", onSubmit);
  return { form, onSubmit, adapter, elements };
}
