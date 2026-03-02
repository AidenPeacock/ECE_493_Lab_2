const STORAGE_KEYS = {
  submissions: "ece493.submissions",
  audit: "ece493.audit"
};

const ALLOWED_EXTENSIONS = ["pdf", "doc", "docx", "tex"];
const MAX_FILE_SIZE_BYTES = 7 * 1024 * 1024;

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

function extensionFromFileName(fileName) {
  const parts = normalizeText(fileName).toLowerCase().split(".");
  return parts.length > 1 ? parts.at(-1) : "";
}

export function isAllowedManuscriptType(fileType, fileName) {
  const normalizedType = normalizeText(fileType).toLowerCase();
  const extension = extensionFromFileName(fileName);

  if (ALLOWED_EXTENSIONS.includes(extension)) {
    return true;
  }

  const allowedMimeTypes = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/x-tex", "text/x-tex"];
  return allowedMimeTypes.includes(normalizedType);
}

export function validateSubmitPaperInput(input) {
  const errors = [];
  const authors = normalizeText(input?.authors);
  const affiliations = normalizeText(input?.affiliations);
  const contactEmail = normalizeEmail(input?.contact_email);
  const abstractText = normalizeText(input?.abstract);
  const keywords = normalizeText(input?.keywords);
  const mainSource = normalizeText(input?.main_source);
  const fileName = normalizeText(input?.file_name);
  const fileType = normalizeText(input?.file_type);
  const fileSizeBytes = Number(input?.file_size_bytes ?? 0);

  if (!authors) {
    errors.push(buildValidationError("authors", "required", "Authors are required."));
  }

  if (!affiliations) {
    errors.push(buildValidationError("affiliations", "required", "Affiliations are required."));
  }

  if (!contactEmail) {
    errors.push(buildValidationError("contact_email", "required", "Contact email is required."));
  } else if (!isValidEmailFormat(contactEmail)) {
    errors.push(buildValidationError("contact_email", "invalid_format", "Enter a valid contact email address."));
  }

  if (!abstractText) {
    errors.push(buildValidationError("abstract", "required", "Abstract is required."));
  }

  if (!keywords) {
    errors.push(buildValidationError("keywords", "required", "Keywords are required."));
  }

  if (!mainSource) {
    errors.push(buildValidationError("main_source", "required", "Main source is required."));
  }

  if (!fileName) {
    errors.push(buildValidationError("manuscript_file", "required", "Manuscript file is required."));
  } else if (!isAllowedManuscriptType(fileType, fileName)) {
    errors.push(buildValidationError("manuscript_file", "invalid_file_type", "Only PDF, Word, and LaTeX files are allowed."));
  }

  if (fileName) {
    if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
      errors.push(buildValidationError("manuscript_file", "invalid_file_size", "Uploaded file size is invalid."));
    } else if (fileSizeBytes > MAX_FILE_SIZE_BYTES) {
      errors.push(buildValidationError("manuscript_file", "file_too_large", "Manuscript must be 7MB or smaller."));
    }
  }

  return errors;
}

export function createSubmitPaperStorageAdapter(storage) {
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
    throw new Error("A LocalStorage-like object is required.");
  }

  return {
    loadSubmissions() {
      return safeParseArray(storage.getItem(STORAGE_KEYS.submissions));
    },
    saveSubmissions(submissions) {
      storage.setItem(STORAGE_KEYS.submissions, JSON.stringify(submissions));
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

function createSubmissionFingerprint(input) {
  return [
    normalizeText(input.authors).toLowerCase(),
    normalizeText(input.affiliations).toLowerCase(),
    normalizeEmail(input.contact_email),
    normalizeText(input.abstract).toLowerCase(),
    normalizeText(input.keywords).toLowerCase(),
    normalizeText(input.main_source).toLowerCase(),
    normalizeText(input.file_name).toLowerCase(),
    normalizeText(input.file_type).toLowerCase(),
    String(Number(input.file_size_bytes))
  ].join("|");
}

function recordAuditSafely(adapter, payload) {
  try {
    adapter.appendAudit(payload);
  } catch {
    // Audit failures must not block user-facing submission behavior.
  }
}

export function submitPaperManuscript(input, options = {}) {
  if (!options.adapter) {
    throw new Error("submitPaperManuscript requires an adapter option.");
  }

  const nowProvider = typeof options.nowProvider === "function" ? options.nowProvider : () => new Date().toISOString();

  const auditBase = {
    requested_at: nowProvider(),
    contact_email: normalizeEmail(input?.contact_email)
  };

  const validationErrors = validateSubmitPaperInput(input);

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

  let existingSubmissions;
  try {
    existingSubmissions = options.adapter.loadSubmissions();
  } catch (error) {
    const storageError = buildValidationError(
      "system",
      "storage_failure",
      "We could not store your submission right now. Please retry."
    );

    recordAuditSafely(options.adapter, {
      ...auditBase,
      status: "storage_failed",
      error: String(error?.message ?? error)
    });

    return {
      status: "storage_failed",
      message: "Storage failure. Please retry.",
      errors: [storageError]
    };
  }

  const fingerprint = createSubmissionFingerprint(input);
  const duplicate = existingSubmissions.find((submission) => submission.fingerprint === fingerprint);

  if (duplicate) {
    recordAuditSafely(options.adapter, {
      ...auditBase,
      status: "success",
      duplicate_of: duplicate.id
    });

    return {
      status: "success",
      message: "Submission already exists.",
      errors: [],
      submission_id: duplicate.id
    };
  }

  const submission = {
    id: generateId(options.idProvider),
    authors: normalizeText(input.authors),
    affiliations: normalizeText(input.affiliations),
    contact_email: normalizeEmail(input.contact_email),
    abstract: normalizeText(input.abstract),
    keywords: normalizeText(input.keywords),
    main_source: normalizeText(input.main_source),
    file_name: normalizeText(input.file_name),
    file_type: normalizeText(input.file_type),
    file_size_bytes: Number(input.file_size_bytes),
    fingerprint,
    submitted_at: nowProvider()
  };

  try {
    options.adapter.saveSubmissions([...existingSubmissions, submission]);

    recordAuditSafely(options.adapter, {
      ...auditBase,
      status: "success",
      submission_id: submission.id
    });

    return {
      status: "success",
      message: "Submission successful.",
      errors: [],
      submission_id: submission.id
    };
  } catch (error) {
    const storageError = buildValidationError(
      "system",
      "storage_failure",
      "We could not store your submission right now. Please retry."
    );

    recordAuditSafely(options.adapter, {
      ...auditBase,
      status: "storage_failed",
      error: String(error?.message ?? error)
    });

    return {
      status: "storage_failed",
      message: "Storage failure. Please retry.",
      errors: [storageError]
    };
  }
}

export function clearSubmitPaperErrorState(elements) {
  elements.summary.textContent = "";
  elements.summary.hidden = true;

  for (const fieldKey of [
    "authors",
    "affiliations",
    "contact_email",
    "abstract",
    "keywords",
    "main_source",
    "manuscript_file"
  ]) {
    elements.fieldErrors[fieldKey].textContent = "";
    elements.fieldErrors[fieldKey].hidden = true;
  }
}

export function renderSubmitPaperErrorState(errors, elements) {
  clearSubmitPaperErrorState(elements);

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

export function showSubmitPaperSuccessView(elements) {
  elements.formContainer.hidden = true;
  elements.successContainer.hidden = false;
  elements.successMessage.textContent = "Submission successful.";
}

function extractFilePayload(fileInput) {
  const file = fileInput?.files?.[0] ?? null;
  if (!file) {
    return {
      file_name: normalizeText(fileInput?.value),
      file_type: "",
      file_size_bytes: 0
    };
  }

  return {
    file_name: normalizeText(file.name),
    file_type: normalizeText(file.type),
    file_size_bytes: Number(file.size)
  };
}

export function initSubmitPaperManuscriptApp(options = {}) {
  const doc = options.document ?? (typeof document !== "undefined" ? document : null);
  if (!doc) {
    return null;
  }

  const form = doc.getElementById("submit-paper-form");
  if (!form) {
    return null;
  }

  const storage =
    options.storage ??
    (typeof window !== "undefined" && window.localStorage ? window.localStorage : null);

  const adapter = options.adapter ?? createSubmitPaperStorageAdapter(storage);

  const elements = {
    formContainer: doc.getElementById("submit-paper-form-container"),
    successContainer: doc.getElementById("submit-paper-success-container"),
    successMessage: doc.getElementById("submit-paper-success-message"),
    summary: doc.getElementById("submit-paper-error-summary"),
    fieldErrors: {
      authors: doc.getElementById("submit-paper-authors-error"),
      affiliations: doc.getElementById("submit-paper-affiliations-error"),
      contact_email: doc.getElementById("submit-paper-contact-email-error"),
      abstract: doc.getElementById("submit-paper-abstract-error"),
      keywords: doc.getElementById("submit-paper-keywords-error"),
      main_source: doc.getElementById("submit-paper-main-source-error"),
      manuscript_file: doc.getElementById("submit-paper-file-error")
    },
    inputs: {
      authors: doc.getElementById("submit-paper-authors"),
      affiliations: doc.getElementById("submit-paper-affiliations"),
      contact_email: doc.getElementById("submit-paper-contact-email"),
      abstract: doc.getElementById("submit-paper-abstract"),
      keywords: doc.getElementById("submit-paper-keywords"),
      main_source: doc.getElementById("submit-paper-main-source"),
      manuscript_file: doc.getElementById("submit-paper-file")
    }
  };

  const onSubmit = (event) => {
    event?.preventDefault?.();

    const filePayload = extractFilePayload(elements.inputs.manuscript_file);
    const payload = {
      authors: elements.inputs.authors.value,
      affiliations: elements.inputs.affiliations.value,
      contact_email: elements.inputs.contact_email.value,
      abstract: elements.inputs.abstract.value,
      keywords: elements.inputs.keywords.value,
      main_source: elements.inputs.main_source.value,
      ...filePayload
    };

    const result = submitPaperManuscript(payload, { adapter });

    if (result.status === "success") {
      clearSubmitPaperErrorState(elements);
      showSubmitPaperSuccessView(elements);
      form.reset();
      return result;
    }

    renderSubmitPaperErrorState(result.errors, elements);
    return result;
  };

  form.addEventListener("submit", onSubmit);
  return { form, onSubmit, adapter, elements };
}
