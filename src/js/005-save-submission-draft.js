const STORAGE_KEYS = {
  drafts: "ece493.drafts",
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

export function validateSaveDraftInput(input) {
  const errors = [];
  const title = normalizeText(input?.title);
  const contactEmail = normalizeEmail(input?.contact_email);
  const keywords = normalizeText(input?.keywords);

  if (!title) {
    errors.push(buildValidationError("title", "required", "Draft title is required."));
  }

  if (!contactEmail) {
    errors.push(buildValidationError("contact_email", "required", "Contact email is required."));
  } else if (!isValidEmailFormat(contactEmail)) {
    errors.push(buildValidationError("contact_email", "invalid_format", "Enter a valid contact email address."));
  }

  if (keywords && keywords.split(",").some((value) => !normalizeText(value))) {
    errors.push(buildValidationError("keywords", "invalid_keywords", "Keywords cannot contain empty entries."));
  }

  return errors;
}

export function createSaveDraftStorageAdapter(storage) {
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
    throw new Error("A LocalStorage-like object is required.");
  }

  return {
    loadDrafts() {
      return safeParseArray(storage.getItem(STORAGE_KEYS.drafts));
    },
    saveDrafts(drafts) {
      storage.setItem(STORAGE_KEYS.drafts, JSON.stringify(drafts));
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
    // Audit failures must not block user-facing draft behavior.
  }
}

function draftFingerprint(input) {
  return [
    normalizeText(input.title).toLowerCase(),
    normalizeEmail(input.contact_email),
    normalizeText(input.abstract).toLowerCase(),
    normalizeText(input.keywords).toLowerCase(),
    normalizeText(input.main_source).toLowerCase()
  ].join("|");
}

export function saveSubmissionDraft(input, options = {}) {
  if (!options.adapter) {
    throw new Error("saveSubmissionDraft requires an adapter option.");
  }

  const nowProvider = typeof options.nowProvider === "function" ? options.nowProvider : () => new Date().toISOString();
  const auditBase = {
    requested_at: nowProvider(),
    contact_email: normalizeEmail(input?.contact_email)
  };

  const validationErrors = validateSaveDraftInput(input);
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

  let existingDrafts;
  try {
    existingDrafts = options.adapter.loadDrafts();
  } catch (error) {
    const serviceError = buildValidationError(
      "system",
      "service_unavailable",
      "Draft service is unavailable. Please retry later."
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

  const ownerEmail = normalizeEmail(input.contact_email);
  const submissionFingerprint = draftFingerprint({
    title: input.title,
    contact_email: input.contact_email,
    abstract: input.abstract,
    keywords: input.keywords,
    main_source: input.main_source
  });

  const existingIndex = existingDrafts.findIndex((draft) => normalizeEmail(draft.contact_email) === ownerEmail);

  const draft = {
    id: existingIndex >= 0 ? existingDrafts[existingIndex].id : generateId(options.idProvider),
    title: normalizeText(input.title),
    contact_email: ownerEmail,
    abstract: normalizeText(input.abstract),
    keywords: normalizeText(input.keywords),
    main_source: normalizeText(input.main_source),
    fingerprint: submissionFingerprint,
    updated_at: nowProvider()
  };

  const nextDrafts = [...existingDrafts];
  if (existingIndex >= 0) {
    nextDrafts[existingIndex] = draft;
  } else {
    nextDrafts.push(draft);
  }

  try {
    options.adapter.saveDrafts(nextDrafts);

    recordAuditSafely(options.adapter, {
      ...auditBase,
      status: "success",
      draft_id: draft.id,
      updated_existing: existingIndex >= 0
    });

    return {
      status: "success",
      message: "Draft saved successfully.",
      errors: [],
      draft_id: draft.id
    };
  } catch (error) {
    const serviceError = buildValidationError(
      "system",
      "service_unavailable",
      "Draft service is unavailable. Please retry later."
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

export function clearSaveDraftErrorState(elements) {
  elements.summary.textContent = "";
  elements.summary.hidden = true;

  for (const fieldKey of ["title", "contact_email", "keywords"]) {
    elements.fieldErrors[fieldKey].textContent = "";
    elements.fieldErrors[fieldKey].hidden = true;
  }
}

export function renderSaveDraftErrorState(errors, elements) {
  clearSaveDraftErrorState(elements);

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

export function showSaveDraftSuccessView(elements) {
  elements.formContainer.hidden = true;
  elements.successContainer.hidden = false;
  elements.successMessage.textContent = "Draft saved successfully.";
}

export function initSaveSubmissionDraftApp(options = {}) {
  const doc = options.document ?? (typeof document !== "undefined" ? document : null);
  if (!doc) {
    return null;
  }

  const form = doc.getElementById("save-draft-form");
  if (!form) {
    return null;
  }

  const storage =
    options.storage ??
    (typeof window !== "undefined" && window.localStorage ? window.localStorage : null);

  const adapter = options.adapter ?? createSaveDraftStorageAdapter(storage);

  const elements = {
    formContainer: doc.getElementById("save-draft-form-container"),
    successContainer: doc.getElementById("save-draft-success-container"),
    successMessage: doc.getElementById("save-draft-success-message"),
    summary: doc.getElementById("save-draft-error-summary"),
    fieldErrors: {
      title: doc.getElementById("save-draft-title-error"),
      contact_email: doc.getElementById("save-draft-contact-email-error"),
      keywords: doc.getElementById("save-draft-keywords-error")
    },
    inputs: {
      title: doc.getElementById("save-draft-title"),
      contact_email: doc.getElementById("save-draft-contact-email"),
      abstract: doc.getElementById("save-draft-abstract"),
      keywords: doc.getElementById("save-draft-keywords"),
      main_source: doc.getElementById("save-draft-main-source")
    }
  };

  const onSubmit = (event) => {
    event?.preventDefault?.();

    const payload = {
      title: elements.inputs.title.value,
      contact_email: elements.inputs.contact_email.value,
      abstract: elements.inputs.abstract.value,
      keywords: elements.inputs.keywords.value,
      main_source: elements.inputs.main_source.value
    };

    const result = saveSubmissionDraft(payload, { adapter });

    if (result.status === "success") {
      clearSaveDraftErrorState(elements);
      showSaveDraftSuccessView(elements);
      form.reset();
      return result;
    }

    renderSaveDraftErrorState(result.errors, elements);
    return result;
  };

  form.addEventListener("submit", onSubmit);
  return { form, onSubmit, adapter, elements };
}
