const STORAGE_KEYS = {
  finalDecisions: "ece493.finalDecisions",
  schedules: "ece493.schedules",
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

function isIsoDateString(value) {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && String(date.toISOString()) === String(value);
}

function acceptedPapersFromDecisions(decisions) {
  return decisions
    .filter((decision) => normalizeText(decision?.decision).toLowerCase() === "accept")
    .map((decision) => ({
      paper_id: normalizeText(decision?.paper_id),
      title: normalizeText(decision?.title) || normalizeText(decision?.paper_id)
    }))
    .filter((paper) => paper.paper_id);
}

export function validateGenerateScheduleInput(input) {
  const errors = [];

  const organizerEmail = normalizeEmail(input?.organizer_email);
  const conferenceStartIso = normalizeText(input?.conference_start_iso);
  const slotMinutes = Number(input?.slot_minutes ?? 0);
  const algorithmReady = input?.algorithm_ready === true;
  const emailDeliveryReady = input?.email_delivery_ready === true;

  if (!organizerEmail) {
    errors.push(
      buildValidationError("organizer_email", "required", "Organizer email is required.")
    );
  }

  if (!conferenceStartIso) {
    errors.push(
      buildValidationError("conference_start_iso", "required", "Conference start time is required.")
    );
  } else if (!isIsoDateString(conferenceStartIso)) {
    errors.push(
      buildValidationError(
        "conference_start_iso",
        "invalid_datetime",
        "Conference start time must be a valid ISO-8601 timestamp."
      )
    );
  }

  if (!Number.isInteger(slotMinutes) || slotMinutes <= 0) {
    errors.push(
      buildValidationError(
        "slot_minutes",
        "invalid_slot_minutes",
        "Slot length must be a positive whole number of minutes."
      )
    );
  }

  if (!algorithmReady) {
    errors.push(
      buildValidationError(
        "algorithm_ready",
        "algorithm_failed",
        "Scheduling algorithm failed. Please retry after resolving the issue."
      )
    );
  }

  if (!emailDeliveryReady) {
    errors.push(
      buildValidationError(
        "email_delivery_ready",
        "email_delivery_failed",
        "Author notification delivery failed. Please retry."
      )
    );
  }

  return errors;
}

export function createGenerateScheduleStorageAdapter(storage) {
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
    throw new Error("A LocalStorage-like object is required.");
  }

  return {
    loadFinalDecisions() {
      return safeParseArray(storage.getItem(STORAGE_KEYS.finalDecisions));
    },
    loadSchedules() {
      return safeParseArray(storage.getItem(STORAGE_KEYS.schedules));
    },
    saveSchedules(schedules) {
      storage.setItem(STORAGE_KEYS.schedules, JSON.stringify(schedules));
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
    // Audit failures must never block schedule generation.
  }
}

function scheduleFingerprint(input, acceptedPapers) {
  return [
    normalizeText(input?.conference_start_iso),
    String(Number(input.slot_minutes)),
    acceptedPapers
      .map((paper) => `${paper.paper_id}:${paper.title}`)
      .sort((left, right) => left.localeCompare(right))
      .join("|")
  ].join("#");
}

function generateScheduleRows(acceptedPapers, conferenceStartIso, slotMinutes) {
  const baseMs = new Date(conferenceStartIso).getTime();
  return acceptedPapers
    .slice()
    .sort((left, right) => left.title.localeCompare(right.title))
    .map((paper, index) => {
      const slotStart = new Date(baseMs + index * slotMinutes * 60 * 1000).toISOString();
      return {
        paper_id: paper.paper_id,
        title: paper.title,
        slot_start: slotStart
      };
    });
}

function scheduleHtmlFromRows(rows) {
  const rowHtml = rows
    .map(
      (row) =>
        `<tr><td>${row.slot_start}</td><td>${row.paper_id}</td><td>${row.title}</td></tr>`
    )
    .join("");

  return `<table><thead><tr><th>Start</th><th>Paper ID</th><th>Title</th></tr></thead><tbody>${rowHtml}</tbody></table>`;
}

export function generateSchedule(input, options = {}) {
  if (!options.adapter) {
    throw new Error("generateSchedule requires an adapter option.");
  }

  const nowProvider = typeof options.nowProvider === "function" ? options.nowProvider : () => new Date().toISOString();
  const nowIso = nowProvider();

  const auditBase = {
    requested_at: nowIso,
    organizer_email: normalizeEmail(input?.organizer_email)
  };

  const validationErrors = validateGenerateScheduleInput(input);
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

  let finalDecisions;
  let schedules;
  try {
    finalDecisions = options.adapter.loadFinalDecisions();
    schedules = options.adapter.loadSchedules();
  } catch (error) {
    const serviceError = buildValidationError(
      "system",
      "service_unavailable",
      "Schedule service is unavailable. Please retry later."
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

  const acceptedPapers = acceptedPapersFromDecisions(finalDecisions);
  if (!acceptedPapers.length) {
    const acceptedPapersError = buildValidationError(
      "accepted_papers",
      "none_accepted",
      "No accepted papers exist. Generate schedule is unavailable."
    );

    recordAuditSafely(options.adapter, {
      ...auditBase,
      status: "validation_failed",
      errors: [acceptedPapersError]
    });

    return {
      status: "validation_failed",
      message: "Validation failed.",
      errors: [acceptedPapersError]
    };
  }

  const fingerprint = scheduleFingerprint(input, acceptedPapers);
  const duplicate = schedules.find((schedule) => schedule.fingerprint === fingerprint);

  if (duplicate) {
    recordAuditSafely(options.adapter, {
      ...auditBase,
      status: "success",
      duplicate_of: duplicate.id
    });

    return {
      status: "success",
      message: "Schedule already generated.",
      errors: [],
      schedule_id: duplicate.id,
      schedule_html: duplicate.schedule_html
    };
  }

  const rows = generateScheduleRows(
    acceptedPapers,
    normalizeText(input.conference_start_iso),
    Number(input.slot_minutes)
  );
  const scheduleHtml = scheduleHtmlFromRows(rows);

  const scheduleRecord = {
    id: generateId(options.idProvider),
    organizer_email: normalizeEmail(input.organizer_email),
    conference_start_iso: normalizeText(input.conference_start_iso),
    slot_minutes: Number(input.slot_minutes),
    accepted_count: acceptedPapers.length,
    schedule_rows: rows,
    schedule_html: scheduleHtml,
    fingerprint,
    generated_at: nowIso
  };

  try {
    options.adapter.saveSchedules([...schedules, scheduleRecord]);

    recordAuditSafely(options.adapter, {
      ...auditBase,
      status: "success",
      schedule_id: scheduleRecord.id
    });

    return {
      status: "success",
      message: "Schedule generated successfully.",
      errors: [],
      schedule_id: scheduleRecord.id,
      schedule_html: scheduleRecord.schedule_html
    };
  } catch (error) {
    const serviceError = buildValidationError(
      "system",
      "service_unavailable",
      "Schedule service is unavailable. Please retry later."
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

export function clearGenerateScheduleErrorState(elements) {
  elements.summary.textContent = "";
  elements.summary.hidden = true;

  for (const fieldKey of [
    "organizer_email",
    "conference_start_iso",
    "slot_minutes",
    "algorithm_ready",
    "email_delivery_ready",
    "accepted_papers"
  ]) {
    elements.fieldErrors[fieldKey].textContent = "";
    elements.fieldErrors[fieldKey].hidden = true;
  }
}

export function renderGenerateScheduleErrorState(errors, elements) {
  clearGenerateScheduleErrorState(elements);

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

export function showGenerateScheduleSuccessView(result, elements) {
  elements.formContainer.hidden = true;
  elements.successContainer.hidden = false;
  elements.successMessage.textContent = "Schedule generated successfully.";
  elements.generatedHtmlContainer.innerHTML = result.schedule_html ?? "";
}

export function initGenerateScheduleApp(options = {}) {
  const doc = options.document ?? (typeof document !== "undefined" ? document : null);
  if (!doc) {
    return null;
  }

  const form = doc.getElementById("generate-schedule-form");
  if (!form) {
    return null;
  }

  const storage =
    options.storage ??
    (typeof window !== "undefined" && window.localStorage ? window.localStorage : null);

  const adapter = options.adapter ?? createGenerateScheduleStorageAdapter(storage);

  const elements = {
    formContainer: doc.getElementById("generate-schedule-form-container"),
    successContainer: doc.getElementById("generate-schedule-success-container"),
    successMessage: doc.getElementById("generate-schedule-success-message"),
    generatedHtmlContainer: doc.getElementById("generate-schedule-generated-html"),
    summary: doc.getElementById("generate-schedule-error-summary"),
    fieldErrors: {
      organizer_email: doc.getElementById("generate-schedule-organizer-email-error"),
      conference_start_iso: doc.getElementById("generate-schedule-start-time-error"),
      slot_minutes: doc.getElementById("generate-schedule-slot-minutes-error"),
      algorithm_ready: doc.getElementById("generate-schedule-algorithm-error"),
      email_delivery_ready: doc.getElementById("generate-schedule-email-error"),
      accepted_papers: doc.getElementById("generate-schedule-accepted-papers-error")
    },
    inputs: {
      organizer_email: doc.getElementById("generate-schedule-organizer-email"),
      conference_start_iso: doc.getElementById("generate-schedule-start-time"),
      slot_minutes: doc.getElementById("generate-schedule-slot-minutes"),
      algorithm_ready: doc.getElementById("generate-schedule-algorithm-ready"),
      email_delivery_ready: doc.getElementById("generate-schedule-email-ready")
    }
  };

  const onSubmit = (event) => {
    event?.preventDefault?.();

    const payload = {
      organizer_email: elements.inputs.organizer_email.value,
      conference_start_iso: elements.inputs.conference_start_iso.value,
      slot_minutes: elements.inputs.slot_minutes.value,
      algorithm_ready: elements.inputs.algorithm_ready.checked,
      email_delivery_ready: elements.inputs.email_delivery_ready.checked
    };

    const result = generateSchedule(payload, { adapter });

    if (result.status === "success") {
      clearGenerateScheduleErrorState(elements);
      showGenerateScheduleSuccessView(result, elements);
      form.reset();
      return result;
    }

    renderGenerateScheduleErrorState(result.errors, elements);
    return result;
  };

  form.addEventListener("submit", onSubmit);
  return { form, onSubmit, adapter, elements };
}
