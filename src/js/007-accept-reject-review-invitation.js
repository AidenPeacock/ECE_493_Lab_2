const STORAGE_KEYS = {
  decisions: "ece493.reviewInvitationDecisions",
  reviewerPapers: "ece493.reviewerPapers",
  audit: "ece493.audit",
  session: "ece493.session"
};

const VALID_DECISIONS = ["accept", "reject"];

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

function parseSession(raw) {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const email = normalizeEmail(parsed.email);
    const role = normalizeText(parsed.role).toLowerCase();
    if (!email || !role) {
      return null;
    }

    return { email, role };
  } catch {
    return null;
  }
}

function loadSession(storage) {
  if (!storage || typeof storage.getItem !== "function") {
    return null;
  }

  return parseSession(storage.getItem(STORAGE_KEYS.session));
}

function validateReviewerAccess(refereeEmail, session) {
  if (!session) {
    return buildValidationError(
      "system",
      "not_authenticated",
      "Log in as the invited reviewer to manage review invitations."
    );
  }

  if (session.role !== "reviewer") {
    return buildValidationError(
      "system",
      "not_authorized",
      "Only reviewers can manage review invitations."
    );
  }

  if (refereeEmail && session.email !== normalizeEmail(refereeEmail)) {
    return buildValidationError(
      "referee_email",
      "mismatched_user",
      "Referee email must match the logged-in reviewer."
    );
  }

  return null;
}

function isExpired(expiresAt, nowIso) {
  const expiry = Date.parse(normalizeText(expiresAt));
  const now = Date.parse(nowIso);

  if (!Number.isFinite(expiry) || !Number.isFinite(now)) {
    return true;
  }

  return expiry < now;
}

export function validateReviewInvitationDecision(input, nowIso) {
  const errors = [];
  const invitationId = normalizeText(input?.invitation_id);
  const paperId = normalizeText(input?.paper_id);
  const refereeEmail = normalizeEmail(input?.referee_email);
  const decision = normalizeText(input?.decision).toLowerCase();
  const invitationValid = input?.invitation_valid !== false;
  const reviewerCount = Number(input?.current_reviewer_count ?? 0);

  if (!invitationId) {
    errors.push(buildValidationError("invitation_id", "required", "Invitation ID is required."));
  }

  if (!paperId) {
    errors.push(buildValidationError("paper_id", "required", "Paper ID is required."));
  }

  if (!refereeEmail) {
    errors.push(buildValidationError("referee_email", "required", "Referee email is required."));
  } else if (!isValidEmailFormat(refereeEmail)) {
    errors.push(buildValidationError("referee_email", "invalid_format", "Referee email is invalid."));
  }

  if (!VALID_DECISIONS.includes(decision)) {
    errors.push(buildValidationError("decision", "invalid_decision", "Decision must be accept or reject."));
  }

  if (!invitationValid || isExpired(input?.expires_at, nowIso)) {
    errors.push(
      buildValidationError(
        "invitation",
        "expired_or_invalid",
        "Invitation is expired or invalid."
      )
    );
  }

  if (decision === "accept" && reviewerCount >= 3) {
    errors.push(
      buildValidationError(
        "paper_id",
        "reviewer_limit_reached",
        "This paper already has the maximum number of reviewers."
      )
    );
  }

  return errors;
}

export function createReviewInvitationStorageAdapter(storage) {
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
    throw new Error("A LocalStorage-like object is required.");
  }

  return {
    loadDecisions() {
      return safeParseArray(storage.getItem(STORAGE_KEYS.decisions));
    },
    saveDecisions(decisions) {
      storage.setItem(STORAGE_KEYS.decisions, JSON.stringify(decisions));
    },
    loadReviewerPapers() {
      return safeParseArray(storage.getItem(STORAGE_KEYS.reviewerPapers));
    },
    saveReviewerPapers(entries) {
      storage.setItem(STORAGE_KEYS.reviewerPapers, JSON.stringify(entries));
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
    // Audit failures must not block user-facing invitation behavior.
  }
}

function updateReviewerPaperAssociations(existing, decisionRecord) {
  const base = existing.filter((entry) => entry.invitation_id !== decisionRecord.invitation_id);

  if (decisionRecord.decision !== "accept") {
    return base;
  }

  return [
    ...base,
    {
      invitation_id: decisionRecord.invitation_id,
      paper_id: decisionRecord.paper_id,
      referee_email: decisionRecord.referee_email,
      associated_at: decisionRecord.decided_at
    }
  ];
}

export function decideReviewInvitation(input, options = {}) {
  if (!options.adapter) {
    throw new Error("decideReviewInvitation requires an adapter option.");
  }

  const nowProvider = typeof options.nowProvider === "function" ? options.nowProvider : () => new Date().toISOString();
  const nowIso = nowProvider();

  const auditBase = {
    requested_at: nowIso,
    invitation_id: normalizeText(input?.invitation_id),
    referee_email: normalizeEmail(input?.referee_email)
  };

  const validationErrors = validateReviewInvitationDecision(input, nowIso);
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

  let decisions;
  let reviewerPapers;
  try {
    decisions = options.adapter.loadDecisions();
    reviewerPapers = options.adapter.loadReviewerPapers();
  } catch (error) {
    const serviceError = buildValidationError(
      "system",
      "service_unavailable",
      "Invitation service is unavailable. Please retry later."
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

  const invitationId = normalizeText(input.invitation_id);
  const decision = normalizeText(input.decision).toLowerCase();
  const existing = decisions.find((entry) => entry.invitation_id === invitationId && entry.decision === decision);

  if (existing) {
    recordAuditSafely(options.adapter, {
      ...auditBase,
      status: "success",
      duplicate_of: existing.id
    });

    return {
      status: "success",
      message: decision === "accept" ? "Invitation accepted." : "Invitation rejected.",
      errors: [],
      decision_id: existing.id
    };
  }

  const record = {
    id: generateId(options.idProvider),
    invitation_id: invitationId,
    paper_id: normalizeText(input.paper_id),
    referee_email: normalizeEmail(input.referee_email),
    decision,
    decided_at: nowIso
  };

  try {
    const nextDecisions = [
      ...decisions.filter((entry) => entry.invitation_id !== invitationId),
      record
    ];

    const nextAssociations = updateReviewerPaperAssociations(reviewerPapers, record);

    options.adapter.saveDecisions(nextDecisions);
    options.adapter.saveReviewerPapers(nextAssociations);

    if (decision === "reject") {
      const notifyEditor = typeof options.notifyEditorFn === "function" ? options.notifyEditorFn : () => true;

      try {
        notifyEditor({ invitation_id: invitationId, paper_id: record.paper_id, referee_email: record.referee_email });
      } catch {
        // Notification failure should not convert rejection into an error state.
      }
    }

    recordAuditSafely(options.adapter, {
      ...auditBase,
      status: "success",
      decision,
      decision_id: record.id
    });

    return {
      status: "success",
      message: decision === "accept" ? "Invitation accepted." : "Invitation rejected.",
      errors: [],
      decision_id: record.id
    };
  } catch (error) {
    const serviceError = buildValidationError(
      "system",
      "service_unavailable",
      "Invitation service is unavailable. Please retry later."
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

export function clearInvitationDecisionErrorState(elements) {
  elements.summary.textContent = "";
  elements.summary.hidden = true;

  for (const fieldKey of ["invitation_id", "paper_id", "referee_email", "decision", "invitation"]) {
    elements.fieldErrors[fieldKey].textContent = "";
    elements.fieldErrors[fieldKey].hidden = true;
  }
}

export function renderInvitationDecisionErrorState(errors, elements) {
  clearInvitationDecisionErrorState(elements);

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

export function showInvitationDecisionSuccessView(elements, decision) {
  elements.formContainer.hidden = true;
  elements.successContainer.hidden = false;
  elements.successMessage.textContent = decision === "accept" ? "Invitation accepted." : "Invitation rejected.";
}

export function initAcceptRejectReviewInvitationApp(options = {}) {
  const doc = options.document ?? (typeof document !== "undefined" ? document : null);
  if (!doc) {
    return null;
  }

  const form = doc.getElementById("review-invitation-form");
  if (!form) {
    return null;
  }

  const storage =
    options.storage ??
    (typeof window !== "undefined" && window.localStorage ? window.localStorage : null);

  const adapter = options.adapter ?? createReviewInvitationStorageAdapter(storage);

  const elements = {
    formContainer: doc.getElementById("review-invitation-form-container"),
    successContainer: doc.getElementById("review-invitation-success-container"),
    successMessage: doc.getElementById("review-invitation-success-message"),
    summary: doc.getElementById("review-invitation-error-summary"),
    fieldErrors: {
      invitation_id: doc.getElementById("review-invitation-id-error"),
      paper_id: doc.getElementById("review-invitation-paper-id-error"),
      referee_email: doc.getElementById("review-invitation-email-error"),
      decision: doc.getElementById("review-invitation-decision-error"),
      invitation: doc.getElementById("review-invitation-state-error")
    },
    inputs: {
      invitation_id: doc.getElementById("review-invitation-id"),
      paper_id: doc.getElementById("review-invitation-paper-id"),
      referee_email: doc.getElementById("review-invitation-email"),
      decision: doc.getElementById("review-invitation-decision"),
      current_reviewer_count: doc.getElementById("review-invitation-reviewer-count"),
      invitation_valid: doc.getElementById("review-invitation-valid"),
      expires_at: doc.getElementById("review-invitation-expires-at")
    }
  };

  const onSubmit = (event) => {
    event?.preventDefault?.();

    const session = loadSession(storage);
    const payload = {
      invitation_id: elements.inputs.invitation_id.value,
      paper_id: elements.inputs.paper_id.value,
      referee_email: elements.inputs.referee_email.value,
      decision: elements.inputs.decision.value,
      current_reviewer_count: elements.inputs.current_reviewer_count.value,
      invitation_valid: elements.inputs.invitation_valid.checked,
      expires_at: elements.inputs.expires_at.value
    };

    const accessError = validateReviewerAccess(payload.referee_email, session);
    if (accessError) {
      renderInvitationDecisionErrorState([accessError], elements);
      return {
        status: "validation_failed",
        message: "Validation failed.",
        errors: [accessError]
      };
    }

    const result = decideReviewInvitation(payload, { adapter });

    if (result.status === "success") {
      clearInvitationDecisionErrorState(elements);
      showInvitationDecisionSuccessView(elements, normalizeText(payload.decision).toLowerCase());
      form.reset();
      return result;
    }

    renderInvitationDecisionErrorState(result.errors, elements);
    return result;
  };

  form.addEventListener("submit", onSubmit);
  return { form, onSubmit, adapter, elements };
}
