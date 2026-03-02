const STORAGE_KEYS = {
  schedules: "ece493.schedules",
  publishedSchedules: "ece493.publishedSchedules",
  audit: "ece493.audit"
};

export function normalizeText(value) {
  return String(value ?? "").trim();
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

export function parseScheduleEntriesJson(rawEntries) {
  const raw = normalizeText(rawEntries);
  if (!raw) {
    return { entries: [], errors: [] };
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return {
        entries: [],
        errors: [
          buildValidationError("entries", "invalid_json", "Schedule entries must be a JSON array.")
        ]
      };
    }

    return { entries: parsed, errors: [] };
  } catch {
    return {
      entries: [],
      errors: [
        buildValidationError("entries", "invalid_json", "Schedule entries must be valid JSON.")
      ]
    };
  }
}

function normalizeEntry(entry) {
  return {
    entry_id: normalizeText(entry?.entry_id),
    title: normalizeText(entry?.title),
    room: normalizeText(entry?.room),
    start_time: normalizeText(entry?.start_time),
    end_time: normalizeText(entry?.end_time)
  };
}

function hasIsoDateTime(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return false;
  }

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return String(date.toISOString()) === normalized;
}

function overlaps(left, right) {
  return left.start < right.end && right.start < left.end;
}

export function validateEditPublishScheduleInput(input) {
  const errors = [];

  const scheduleId = normalizeText(input?.schedule_id);
  const version = Number(input?.version ?? 0);
  const entries = Array.isArray(input?.entries) ? input.entries : [];

  if (!scheduleId) {
    errors.push(buildValidationError("schedule_id", "required", "Schedule ID is required."));
  }

  if (!Number.isInteger(version) || version < 1) {
    errors.push(
      buildValidationError(
        "version",
        "invalid_version",
        "Version must be a positive whole number."
      )
    );
  }

  if (!entries.length) {
    errors.push(
      buildValidationError(
        "entries",
        "required",
        "At least one schedule entry is required."
      )
    );
    return errors;
  }

  const normalizedEntries = entries.map(normalizeEntry);

  normalizedEntries.forEach((entry, index) => {
    const fieldPrefix = `entries[${index}]`;

    if (!entry.entry_id) {
      errors.push(
        buildValidationError(`${fieldPrefix}.entry_id`, "required", "Entry ID is required.")
      );
    }

    if (!entry.title) {
      errors.push(
        buildValidationError(`${fieldPrefix}.title`, "required", "Entry title is required.")
      );
    }

    if (!entry.room) {
      errors.push(
        buildValidationError(`${fieldPrefix}.room`, "required", "Room is required.")
      );
    }

    if (!hasIsoDateTime(entry.start_time) || !hasIsoDateTime(entry.end_time)) {
      errors.push(
        buildValidationError(
          `${fieldPrefix}.time`,
          "invalid_datetime",
          "Entry start/end must be valid ISO timestamps."
        )
      );
      return;
    }

    const start = new Date(entry.start_time).getTime();
    const end = new Date(entry.end_time).getTime();
    if (!(start < end)) {
      errors.push(
        buildValidationError(
          `${fieldPrefix}.time_order`,
          "invalid_time_order",
          "Entry start time must be earlier than end time."
        )
      );
    }
  });

  const intervalsByRoom = new Map();
  normalizedEntries.forEach((entry, index) => {
    if (!entry.room || !hasIsoDateTime(entry.start_time) || !hasIsoDateTime(entry.end_time)) {
      return;
    }

    const item = {
      index,
      start: new Date(entry.start_time).getTime(),
      end: new Date(entry.end_time).getTime()
    };

    const roomItems = intervalsByRoom.get(entry.room) ?? [];
    roomItems.push(item);
    intervalsByRoom.set(entry.room, roomItems);
  });

  for (const [room, intervals] of intervalsByRoom.entries()) {
    for (let i = 0; i < intervals.length; i += 1) {
      for (let j = i + 1; j < intervals.length; j += 1) {
        if (overlaps(intervals[i], intervals[j])) {
          errors.push(
            buildValidationError(
              "entries",
              "room_time_collision",
              `Room ${room} has overlapping entries (${intervals[i].index + 1} and ${intervals[j].index + 1}).`
            )
          );
          i = intervals.length;
          break;
        }
      }
    }
  }

  return errors;
}

export function createEditPublishScheduleStorageAdapter(storage) {
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
    throw new Error("A LocalStorage-like object is required.");
  }

  return {
    loadSchedules() {
      return safeParseArray(storage.getItem(STORAGE_KEYS.schedules));
    },
    loadPublishedSchedules() {
      return safeParseArray(storage.getItem(STORAGE_KEYS.publishedSchedules));
    },
    savePublishedSchedules(published) {
      storage.setItem(STORAGE_KEYS.publishedSchedules, JSON.stringify(published));
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
    // Audit failures should not block user-visible responses.
  }
}

function publishFingerprint(input) {
  return [
    normalizeText(input.schedule_id),
    String(Number(input.version)),
    JSON.stringify(input.entries)
  ].join("#");
}

function latestVersionForSchedule(scheduleId, published) {
  const versions = published
    .filter((item) => normalizeText(item?.schedule_id) === scheduleId)
    .map((item) => Number(item.version ?? 0));

  return versions.length ? Math.max(...versions) : 0;
}

function hasExistingSchedule(scheduleId, schedules, published) {
  const generatedExists = schedules.some((item) => normalizeText(item?.id) === scheduleId);
  const publishedExists = published.some((item) => normalizeText(item?.schedule_id) === scheduleId);
  return generatedExists || publishedExists;
}

export function editAndPublishSchedule(input, options = {}) {
  if (!options.adapter) {
    throw new Error("editAndPublishSchedule requires an adapter option.");
  }

  const nowProvider = typeof options.nowProvider === "function" ? options.nowProvider : () => new Date().toISOString();
  const nowIso = nowProvider();

  const auditBase = {
    requested_at: nowIso,
    schedule_id: normalizeText(input?.schedule_id)
  };

  const validationErrors = validateEditPublishScheduleInput(input);
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

  let schedules;
  let published;
  try {
    schedules = options.adapter.loadSchedules();
    published = options.adapter.loadPublishedSchedules();
  } catch (error) {
    const serviceError = buildValidationError(
      "system",
      "service_unavailable",
      "Schedule publish service is unavailable. Please retry later."
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

  const scheduleId = normalizeText(input.schedule_id);
  if (!hasExistingSchedule(scheduleId, schedules, published)) {
    const missingError = buildValidationError(
      "schedule_id",
      "schedule_not_found",
      "A generated or previously published schedule is required before editing."
    );

    recordAuditSafely(options.adapter, {
      ...auditBase,
      status: "validation_failed",
      errors: [missingError]
    });

    return {
      status: "validation_failed",
      message: "Validation failed.",
      errors: [missingError]
    };
  }

  const fingerprint = publishFingerprint(input);
  const duplicate = published.find((item) => item.fingerprint === fingerprint);
  if (duplicate) {
    recordAuditSafely(options.adapter, {
      ...auditBase,
      status: "success",
      duplicate_of: duplicate.id
    });

    return {
      status: "success",
      message: "Schedule publish already recorded.",
      errors: [],
      schedule_id: duplicate.schedule_id,
      version: duplicate.version,
      published_at: duplicate.published_at
    };
  }

  const currentLatestVersion = latestVersionForSchedule(scheduleId, published);
  const expectedVersion = currentLatestVersion + 1;
  const incomingVersion = Number(input.version);

  if (incomingVersion !== expectedVersion) {
    const versionCode = incomingVersion < expectedVersion ? "stale_version" : "version_gap";
    const versionError = buildValidationError(
      "version",
      versionCode,
      `Version must be ${expectedVersion} for this schedule.`
    );

    recordAuditSafely(options.adapter, {
      ...auditBase,
      status: "validation_failed",
      errors: [versionError]
    });

    return {
      status: "validation_failed",
      message: "Validation failed.",
      errors: [versionError]
    };
  }

  if (input.simulate_announcement_failure === true) {
    const announcementError = buildValidationError(
      "system",
      "announcement_failed",
      "Schedule announcement failed. Please retry."
    );

    recordAuditSafely(options.adapter, {
      ...auditBase,
      status: "announcement_failed",
      errors: [announcementError]
    });

    return {
      status: "announcement_failed",
      message: "Announcement failed. Please retry.",
      errors: [announcementError]
    };
  }

  if (input.simulate_save_failure === true) {
    const storageError = buildValidationError(
      "system",
      "storage_failed",
      "Could not save schedule changes. Please retry."
    );

    recordAuditSafely(options.adapter, {
      ...auditBase,
      status: "storage_failed",
      errors: [storageError]
    });

    return {
      status: "storage_failed",
      message: "Storage failure. Please retry.",
      errors: [storageError]
    };
  }

  const record = {
    id: generateId(options.idProvider),
    schedule_id: scheduleId,
    version: incomingVersion,
    entries: input.entries,
    fingerprint,
    published_at: nowIso
  };

  try {
    options.adapter.savePublishedSchedules([...published, record]);

    recordAuditSafely(options.adapter, {
      ...auditBase,
      status: "success",
      version: record.version,
      publish_id: record.id
    });

    return {
      status: "success",
      message: "Schedule published successfully.",
      errors: [],
      schedule_id: record.schedule_id,
      version: record.version,
      published_at: record.published_at
    };
  } catch (error) {
    const storageError = buildValidationError(
      "system",
      "storage_failed",
      "Could not save schedule changes. Please retry."
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

export function clearEditPublishScheduleErrorState(elements) {
  elements.summary.textContent = "";
  elements.summary.hidden = true;

  for (const fieldKey of ["schedule_id", "version", "entries", "simulate_save_failure", "simulate_announcement_failure"]) {
    elements.fieldErrors[fieldKey].textContent = "";
    elements.fieldErrors[fieldKey].hidden = true;
  }
}

export function renderEditPublishScheduleErrorState(errors, elements) {
  clearEditPublishScheduleErrorState(elements);

  if (!errors.length) {
    return;
  }

  elements.summary.hidden = false;
  elements.summary.textContent = errors.map((error) => error.message).join(" ");

  for (const error of errors) {
    const fieldKey = error.field === "system" ? "simulate_save_failure" : error.field;
    if (Object.prototype.hasOwnProperty.call(elements.fieldErrors, fieldKey)) {
      elements.fieldErrors[fieldKey].textContent = error.message;
      elements.fieldErrors[fieldKey].hidden = false;
    }
  }
}

export function showEditPublishScheduleSuccessView(result, elements) {
  elements.formContainer.hidden = true;
  elements.successContainer.hidden = false;
  elements.successMessage.textContent = "Schedule published successfully.";
  elements.successMeta.textContent = `Version ${result.version} published at ${result.published_at}.`;
}

export function initEditPublishScheduleApp(options = {}) {
  const doc = options.document ?? (typeof document !== "undefined" ? document : null);
  if (!doc) {
    return null;
  }

  const form = doc.getElementById("edit-publish-schedule-form");
  if (!form) {
    return null;
  }

  const storage =
    options.storage ??
    (typeof window !== "undefined" && window.localStorage ? window.localStorage : null);

  const adapter = options.adapter ?? createEditPublishScheduleStorageAdapter(storage);

  const elements = {
    formContainer: doc.getElementById("edit-publish-schedule-form-container"),
    successContainer: doc.getElementById("edit-publish-schedule-success-container"),
    successMessage: doc.getElementById("edit-publish-schedule-success-message"),
    successMeta: doc.getElementById("edit-publish-schedule-success-meta"),
    summary: doc.getElementById("edit-publish-schedule-error-summary"),
    fieldErrors: {
      schedule_id: doc.getElementById("edit-publish-schedule-id-error"),
      version: doc.getElementById("edit-publish-schedule-version-error"),
      entries: doc.getElementById("edit-publish-schedule-entries-error"),
      simulate_save_failure: doc.getElementById("edit-publish-schedule-save-error"),
      simulate_announcement_failure: doc.getElementById("edit-publish-schedule-announcement-error")
    },
    inputs: {
      schedule_id: doc.getElementById("edit-publish-schedule-id"),
      version: doc.getElementById("edit-publish-schedule-version"),
      entries_json: doc.getElementById("edit-publish-schedule-entries"),
      simulate_save_failure: doc.getElementById("edit-publish-schedule-simulate-save-failure"),
      simulate_announcement_failure: doc.getElementById("edit-publish-schedule-simulate-announcement-failure")
    }
  };

  const onSubmit = (event) => {
    event?.preventDefault?.();

    const parsedEntries = parseScheduleEntriesJson(elements.inputs.entries_json.value);
    if (parsedEntries.errors.length > 0) {
      renderEditPublishScheduleErrorState(parsedEntries.errors, elements);
      return {
        status: "validation_failed",
        message: "Validation failed.",
        errors: parsedEntries.errors
      };
    }

    const payload = {
      schedule_id: elements.inputs.schedule_id.value,
      version: elements.inputs.version.value,
      entries: parsedEntries.entries,
      simulate_save_failure: elements.inputs.simulate_save_failure.checked,
      simulate_announcement_failure: elements.inputs.simulate_announcement_failure.checked
    };

    const result = editAndPublishSchedule(payload, { adapter });

    if (result.status === "success") {
      clearEditPublishScheduleErrorState(elements);
      showEditPublishScheduleSuccessView(result, elements);
      form.reset();
      return result;
    }

    renderEditPublishScheduleErrorState(result.errors, elements);
    return result;
  };

  form.addEventListener("submit", onSubmit);
  return { form, onSubmit, adapter, elements };
}
