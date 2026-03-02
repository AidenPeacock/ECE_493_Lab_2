const STORAGE_KEYS = {
  reviews: "ece493.reviews",
  audit: "ece493.audit"
};

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

function hasInvalidChars(value) {
  return /[<>]/.test(value);
}

export function validateSubmitPaperReviewInput(input) {
  const errors = [];
  const invitationAccepted = input?.invitation_accepted === true;
  const paperId = normalizeText(input?.paper_id);
  const refereeEmail = normalizeEmail(input?.referee_email);
  const score = Number(input?.score ?? 0);
  const comments = normalizeText(input?.comments);

  if (!invitationAccepted) {
    errors.push(
      buildValidationError(
        "invitation_accepted",
        "invitation_not_accepted",
        "You must accept the invitation before submitting a review."
      )
    );
  }

  if (!paperId) {
    errors.push(buildValidationError("paper_id", "required", "Paper ID is required."));
  }

  if (!refereeEmail) {
    errors.push(buildValidationError("referee_email", "required", "Referee email is required."));
  }

  if (!Number.isFinite(score) || score < 1 || score > 10) {
    errors.push(buildValidationError("score", "invalid_score", "Score must be between 1 and 10."));
  }

  if (!comments) {
    errors.push(buildValidationError("comments", "required", "Review comments are required."));
  } else if (hasInvalidChars(comments)) {
    errors.push(
      buildValidationError(
        "comments",
        "invalid_characters",
        "Review comments include unsupported characters."
      )
    );
  }

  return errors;
}

export function createSubmitPaperReviewStorageAdapter(storage) {
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
    throw new Error("A LocalStorage-like object is required.");
  }

  return {
    loadReviews() {
      return safeParseArray(storage.getItem(STORAGE_KEYS.reviews));
    },
    saveReviews(reviews) {
      storage.setItem(STORAGE_KEYS.reviews, JSON.stringify(reviews));
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

function reviewFingerprint(input) {
  return [normalizeText(input.paper_id).toLowerCase(), normalizeEmail(input.referee_email)].join("|");
}

function recordAuditSafely(adapter, payload) {
  try {
    adapter.appendAudit(payload);
  } catch {
    // Audit failures must not block user-facing review behavior.
  }
}

export function submitPaperReview(input, options = {}) {
  if (!options.adapter) {
    throw new Error("submitPaperReview requires an adapter option.");
  }

  const nowProvider = typeof options.nowProvider === "function" ? options.nowProvider : () => new Date().toISOString();
  const nowIso = nowProvider();

  const auditBase = {
    requested_at: nowIso,
    paper_id: normalizeText(input?.paper_id),
    referee_email: normalizeEmail(input?.referee_email)
  };

  const validationErrors = validateSubmitPaperReviewInput(input);
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
  try {
    reviews = options.adapter.loadReviews();
  } catch (error) {
    const serviceError = buildValidationError(
      "system",
      "service_unavailable",
      "Review service is unavailable. Please retry later."
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

  const fingerprint = reviewFingerprint(input);
  const duplicate = reviews.find((review) => review.fingerprint === fingerprint);
  if (duplicate) {
    recordAuditSafely(options.adapter, {
      ...auditBase,
      status: "success",
      duplicate_of: duplicate.id
    });

    return {
      status: "success",
      message: "Review already submitted.",
      errors: [],
      review_id: duplicate.id
    };
  }

  const review = {
    id: generateId(options.idProvider),
    paper_id: normalizeText(input.paper_id),
    referee_email: normalizeEmail(input.referee_email),
    score: Number(input.score),
    comments: normalizeText(input.comments),
    fingerprint,
    submitted_at: nowIso
  };

  try {
    options.adapter.saveReviews([...reviews, review]);

    recordAuditSafely(options.adapter, {
      ...auditBase,
      status: "success",
      review_id: review.id
    });

    return {
      status: "success",
      message: "Review submitted successfully.",
      errors: [],
      review_id: review.id
    };
  } catch (error) {
    const serviceError = buildValidationError(
      "system",
      "service_unavailable",
      "Review service is unavailable. Please retry later."
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

export function clearSubmitPaperReviewErrorState(elements) {
  elements.summary.textContent = "";
  elements.summary.hidden = true;

  for (const fieldKey of ["invitation_accepted", "paper_id", "referee_email", "score", "comments"]) {
    elements.fieldErrors[fieldKey].textContent = "";
    elements.fieldErrors[fieldKey].hidden = true;
  }
}

export function renderSubmitPaperReviewErrorState(errors, elements) {
  clearSubmitPaperReviewErrorState(elements);

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

export function showSubmitPaperReviewSuccessView(elements) {
  elements.formContainer.hidden = true;
  elements.successContainer.hidden = false;
  elements.successMessage.textContent = "Review submitted successfully.";
}

export function initSubmitPaperReviewApp(options = {}) {
  const doc = options.document ?? (typeof document !== "undefined" ? document : null);
  if (!doc) {
    return null;
  }

  const form = doc.getElementById("submit-review-form");
  if (!form) {
    return null;
  }

  const storage =
    options.storage ??
    (typeof window !== "undefined" && window.localStorage ? window.localStorage : null);

  const adapter = options.adapter ?? createSubmitPaperReviewStorageAdapter(storage);

  const elements = {
    formContainer: doc.getElementById("submit-review-form-container"),
    successContainer: doc.getElementById("submit-review-success-container"),
    successMessage: doc.getElementById("submit-review-success-message"),
    summary: doc.getElementById("submit-review-error-summary"),
    fieldErrors: {
      invitation_accepted: doc.getElementById("submit-review-invitation-error"),
      paper_id: doc.getElementById("submit-review-paper-id-error"),
      referee_email: doc.getElementById("submit-review-referee-email-error"),
      score: doc.getElementById("submit-review-score-error"),
      comments: doc.getElementById("submit-review-comments-error")
    },
    inputs: {
      invitation_accepted: doc.getElementById("submit-review-invitation-accepted"),
      paper_id: doc.getElementById("submit-review-paper-id"),
      referee_email: doc.getElementById("submit-review-referee-email"),
      score: doc.getElementById("submit-review-score"),
      comments: doc.getElementById("submit-review-comments")
    }
  };

  const onSubmit = (event) => {
    event?.preventDefault?.();

    const payload = {
      invitation_accepted: elements.inputs.invitation_accepted.checked,
      paper_id: elements.inputs.paper_id.value,
      referee_email: elements.inputs.referee_email.value,
      score: elements.inputs.score.value,
      comments: elements.inputs.comments.value
    };

    const result = submitPaperReview(payload, { adapter });

    if (result.status === "success") {
      clearSubmitPaperReviewErrorState(elements);
      showSubmitPaperReviewSuccessView(elements);
      form.reset();
      return result;
    }

    renderSubmitPaperReviewErrorState(result.errors, elements);
    return result;
  };

  form.addEventListener("submit", onSubmit);
  return { form, onSubmit, adapter, elements };
}
