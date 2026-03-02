import test from "node:test";
import assert from "node:assert/strict";

import {
  buildValidationError,
  clearEditPublishScheduleErrorState,
  createEditPublishScheduleStorageAdapter,
  editAndPublishSchedule,
  generateId,
  initEditPublishScheduleApp,
  normalizeText,
  parseScheduleEntriesJson,
  renderEditPublishScheduleErrorState,
  showEditPublishScheduleSuccessView,
  validateEditPublishScheduleInput
} from "../src/js/011-edit-publish-schedule.js";

class FakeStorage {
  constructor() {
    this.data = new Map();
    this.failWrites = false;
  }

  getItem(key) {
    return this.data.has(key) ? this.data.get(key) : null;
  }

  setItem(key, value) {
    if (this.failWrites) {
      throw new Error("write failed");
    }

    this.data.set(key, value);
  }
}

function createElement(initialValue = "") {
  return { value: initialValue, hidden: true, textContent: "", checked: false };
}

function createFormMock() {
  return {
    listener: null,
    resetCalls: 0,
    addEventListener(eventName, callback) {
      if (eventName === "submit") {
        this.listener = callback;
      }
    },
    reset() {
      this.resetCalls += 1;
    }
  };
}

function createDocumentMock() {
  const form = createFormMock();
  const elements = {
    "edit-publish-schedule-form": form,
    "edit-publish-schedule-form-container": createElement(),
    "edit-publish-schedule-success-container": createElement(),
    "edit-publish-schedule-success-message": createElement(),
    "edit-publish-schedule-success-meta": createElement(),
    "edit-publish-schedule-error-summary": createElement(),
    "edit-publish-schedule-id-error": createElement(),
    "edit-publish-schedule-version-error": createElement(),
    "edit-publish-schedule-entries-error": createElement(),
    "edit-publish-schedule-save-error": createElement(),
    "edit-publish-schedule-announcement-error": createElement(),
    "edit-publish-schedule-id": createElement(),
    "edit-publish-schedule-version": createElement(),
    "edit-publish-schedule-entries": createElement(),
    "edit-publish-schedule-simulate-save-failure": createElement(),
    "edit-publish-schedule-simulate-announcement-failure": createElement()
  };

  return {
    form,
    elements,
    getElementById(id) {
      return Object.prototype.hasOwnProperty.call(elements, id) ? elements[id] : null;
    }
  };
}

function validEntries() {
  return [
    {
      entry_id: "e1",
      title: "Opening",
      room: "A",
      start_time: "2026-08-01T09:00:00.000Z",
      end_time: "2026-08-01T09:30:00.000Z"
    },
    {
      entry_id: "e2",
      title: "Session",
      room: "A",
      start_time: "2026-08-01T09:30:00.000Z",
      end_time: "2026-08-01T10:00:00.000Z"
    }
  ];
}

function validPayload() {
  return {
    schedule_id: "sched-1",
    version: 1,
    entries: validEntries(),
    simulate_save_failure: false,
    simulate_announcement_failure: false
  };
}

test("normalize helper trims nullish values", () => {
  assert.equal(normalizeText("  hello  "), "hello");
  assert.equal(normalizeText(null), "");
});

test("parseScheduleEntriesJson covers empty, valid, invalid json, and non-array payload", () => {
  assert.deepEqual(parseScheduleEntriesJson("").entries, []);

  const valid = parseScheduleEntriesJson('[{"entry_id":"e1"}]');
  assert.equal(valid.errors.length, 0);
  assert.equal(valid.entries.length, 1);

  const invalidJson = parseScheduleEntriesJson("{bad");
  assert.equal(invalidJson.errors[0].code, "invalid_json");

  const nonArray = parseScheduleEntriesJson('{"entry_id":"e1"}');
  assert.equal(nonArray.errors[0].code, "invalid_json");
});

test("validation covers required fields, version, entry details, time order, collisions, and valid path", () => {
  const undefinedInput = validateEditPublishScheduleInput();
  assert.equal(undefinedInput.some((e) => e.code === "required"), true);

  const missing = validateEditPublishScheduleInput({});
  assert.equal(missing.some((e) => e.code === "required"), true);
  assert.equal(missing.some((e) => e.code === "invalid_version"), true);

  const invalidEntry = validateEditPublishScheduleInput({
    schedule_id: "sched-1",
    version: 1,
    entries: [{}]
  });
  assert.equal(invalidEntry.some((e) => e.code === "required"), true);
  assert.equal(invalidEntry.some((e) => e.code === "invalid_datetime"), true);

  const nullEntry = validateEditPublishScheduleInput({
    schedule_id: "sched-1",
    version: 1,
    entries: [null]
  });
  assert.equal(nullEntry.some((e) => e.code === "required"), true);
  assert.equal(nullEntry.some((e) => e.code === "invalid_datetime"), true);

  const unparsableDate = validateEditPublishScheduleInput({
    schedule_id: "sched-1",
    version: 1,
    entries: [
      {
        entry_id: "e-parse",
        title: "Bad date",
        room: "A",
        start_time: "not-a-date",
        end_time: "still-not-a-date"
      }
    ]
  });
  assert.equal(unparsableDate.some((e) => e.code === "invalid_datetime"), true);

  const invalidEndOnly = validateEditPublishScheduleInput({
    schedule_id: "sched-1",
    version: 1,
    entries: [
      {
        entry_id: "e-end",
        title: "Bad end date",
        room: "A",
        start_time: "2026-08-01T09:00:00.000Z",
        end_time: "not-a-date"
      }
    ]
  });
  assert.equal(invalidEndOnly.some((e) => e.code === "invalid_datetime"), true);

  const timeOrder = validateEditPublishScheduleInput({
    schedule_id: "sched-1",
    version: 1,
    entries: [
      {
        entry_id: "e1",
        title: "bad",
        room: "A",
        start_time: "2026-08-01T10:00:00.000Z",
        end_time: "2026-08-01T09:00:00.000Z"
      }
    ]
  });
  assert.equal(timeOrder.some((e) => e.code === "invalid_time_order"), true);

  const collision = validateEditPublishScheduleInput({
    schedule_id: "sched-1",
    version: 1,
    entries: [
      {
        entry_id: "e1",
        title: "one",
        room: "A",
        start_time: "2026-08-01T09:00:00.000Z",
        end_time: "2026-08-01T09:45:00.000Z"
      },
      {
        entry_id: "e2",
        title: "two",
        room: "A",
        start_time: "2026-08-01T09:30:00.000Z",
        end_time: "2026-08-01T10:00:00.000Z"
      }
    ]
  });
  assert.equal(collision.some((e) => e.code === "room_time_collision"), true);

  const reversedNonOverlap = validateEditPublishScheduleInput({
    schedule_id: "sched-1",
    version: 1,
    entries: [
      {
        entry_id: "late",
        title: "Late Slot",
        room: "A",
        start_time: "2026-08-01T11:00:00.000Z",
        end_time: "2026-08-01T12:00:00.000Z"
      },
      {
        entry_id: "early",
        title: "Early Slot",
        room: "A",
        start_time: "2026-08-01T08:00:00.000Z",
        end_time: "2026-08-01T09:00:00.000Z"
      }
    ]
  });
  assert.equal(reversedNonOverlap.some((e) => e.code === "room_time_collision"), false);

  assert.deepEqual(validateEditPublishScheduleInput(validPayload()), []);
});

test("adapter handles parse fallback and persistence", () => {
  const storage = new FakeStorage();
  const adapter = createEditPublishScheduleStorageAdapter(storage);

  assert.deepEqual(adapter.loadSchedules(), []);
  assert.deepEqual(adapter.loadPublishedSchedules(), []);

  storage.setItem("ece493.schedules", "{bad");
  assert.deepEqual(adapter.loadSchedules(), []);

  storage.setItem("ece493.publishedSchedules", JSON.stringify({ nope: true }));
  assert.deepEqual(adapter.loadPublishedSchedules(), []);

  adapter.savePublishedSchedules([{ id: "pub-1" }]);
  assert.equal(adapter.loadPublishedSchedules().length, 1);

  adapter.appendAudit({ status: "x" });
  assert.equal(JSON.parse(storage.getItem("ece493.audit")).length, 1);
});

test("adapter rejects invalid storage objects", () => {
  assert.throws(() => createEditPublishScheduleStorageAdapter(null), /LocalStorage-like/);
  assert.throws(() => createEditPublishScheduleStorageAdapter({}), /LocalStorage-like/);
  assert.throws(() => createEditPublishScheduleStorageAdapter({ getItem() {} }), /LocalStorage-like/);
});

test("generateId covers provider and fallback", () => {
  assert.equal(generateId(() => "fixed"), "fixed");
  assert.equal(generateId().startsWith("id_"), true);
});

test("editAndPublishSchedule requires adapter", () => {
  assert.throws(() => editAndPublishSchedule(validPayload()), /requires an adapter/);
});

test("editAndPublishSchedule handles validation failure and audit failure tolerance", () => {
  const result = editAndPublishSchedule({}, {
    adapter: {
      appendAudit() {
        throw new Error("audit failed");
      }
    }
  });

  assert.equal(result.status, "validation_failed");
});

test("editAndPublishSchedule handles load failures as service unavailable", () => {
  const stringError = editAndPublishSchedule(validPayload(), {
    adapter: {
      loadSchedules() {
        throw "db down";
      },
      loadPublishedSchedules() {
        return [];
      },
      appendAudit() {}
    }
  });
  assert.equal(stringError.status, "service_unavailable");

  const errorObject = editAndPublishSchedule(validPayload(), {
    adapter: {
      loadSchedules() {
        return [];
      },
      loadPublishedSchedules() {
        throw new Error("db err");
      },
      appendAudit() {}
    }
  });
  assert.equal(errorObject.status, "service_unavailable");
});

test("editAndPublishSchedule requires existing generated or published schedule", () => {
  const storage = new FakeStorage();
  const adapter = createEditPublishScheduleStorageAdapter(storage);

  const result = editAndPublishSchedule(validPayload(), { adapter });
  assert.equal(result.status, "validation_failed");
  assert.equal(result.errors.some((e) => e.code === "schedule_not_found"), true);
});

test("editAndPublishSchedule allows publish when schedule exists only in published history", () => {
  const storage = new FakeStorage();
  storage.setItem(
    "ece493.publishedSchedules",
    JSON.stringify([
      {
        id: "pub-0",
        schedule_id: "sched-1",
        version: 1,
        entries: validEntries(),
        fingerprint: "old"
      }
    ])
  );
  const adapter = createEditPublishScheduleStorageAdapter(storage);

  const result = editAndPublishSchedule({ ...validPayload(), version: 2 }, { adapter });
  assert.equal(result.status, "success");
  assert.equal(result.version, 2);
});

test("editAndPublishSchedule treats missing historical version as zero", () => {
  const storage = new FakeStorage();
  storage.setItem(
    "ece493.publishedSchedules",
    JSON.stringify([
      {
        id: "pub-no-version",
        schedule_id: "sched-1",
        entries: validEntries(),
        fingerprint: "old-fp"
      }
    ])
  );
  const adapter = createEditPublishScheduleStorageAdapter(storage);

  const result = editAndPublishSchedule({ ...validPayload(), version: 1 }, { adapter });
  assert.equal(result.status, "success");
  assert.equal(result.version, 1);
});

test("editAndPublishSchedule enforces latest-only versioning (stale and gap)", () => {
  const storage = new FakeStorage();
  storage.setItem("ece493.schedules", JSON.stringify([{ id: "sched-1" }]));
  storage.setItem(
    "ece493.publishedSchedules",
    JSON.stringify([{ id: "p1", schedule_id: "sched-1", version: 2, fingerprint: "old" }])
  );
  const adapter = createEditPublishScheduleStorageAdapter(storage);

  const stale = editAndPublishSchedule({ ...validPayload(), version: 2 }, { adapter });
  assert.equal(stale.status, "validation_failed");
  assert.equal(stale.errors[0].code, "stale_version");

  const gap = editAndPublishSchedule({ ...validPayload(), version: 4 }, { adapter });
  assert.equal(gap.status, "validation_failed");
  assert.equal(gap.errors[0].code, "version_gap");
});

test("editAndPublishSchedule handles duplicate publish idempotently", () => {
  const payload = validPayload();
  const duplicateFingerprint = [
    payload.schedule_id,
    String(payload.version),
    JSON.stringify(payload.entries)
  ].join("#");

  const storage = new FakeStorage();
  storage.setItem("ece493.schedules", JSON.stringify([{ id: "sched-1" }]));
  storage.setItem(
    "ece493.publishedSchedules",
    JSON.stringify([
      {
        id: "pub-1",
        schedule_id: "sched-1",
        version: 1,
        fingerprint: duplicateFingerprint,
        published_at: "2026-08-01T00:00:00.000Z"
      }
    ])
  );
  const adapter = createEditPublishScheduleStorageAdapter(storage);

  const result = editAndPublishSchedule(payload, { adapter });
  assert.equal(result.status, "success");
  assert.equal(result.version, 1);
});

test("editAndPublishSchedule handles simulated failure paths with no state change", () => {
  const storage = new FakeStorage();
  storage.setItem("ece493.schedules", JSON.stringify([{ id: "sched-1" }]));
  const adapter = createEditPublishScheduleStorageAdapter(storage);

  const announcementFailed = editAndPublishSchedule(
    { ...validPayload(), simulate_announcement_failure: true },
    { adapter }
  );
  assert.equal(announcementFailed.status, "announcement_failed");
  assert.equal(adapter.loadPublishedSchedules().length, 0);

  const saveFailed = editAndPublishSchedule(
    { ...validPayload(), simulate_save_failure: true },
    { adapter }
  );
  assert.equal(saveFailed.status, "storage_failed");
  assert.equal(adapter.loadPublishedSchedules().length, 0);
});

test("editAndPublishSchedule handles save exception branches and success publish", () => {
  const saveError = editAndPublishSchedule(validPayload(), {
    adapter: {
      loadSchedules() {
        return [{ id: "sched-1" }];
      },
      loadPublishedSchedules() {
        return [];
      },
      savePublishedSchedules() {
        throw new Error("write failed");
      },
      appendAudit() {}
    }
  });
  assert.equal(saveError.status, "storage_failed");

  const saveString = editAndPublishSchedule(validPayload(), {
    adapter: {
      loadSchedules() {
        return [{ id: "sched-1" }];
      },
      loadPublishedSchedules() {
        return [];
      },
      savePublishedSchedules() {
        throw "write failed";
      },
      appendAudit() {}
    }
  });
  assert.equal(saveString.status, "storage_failed");

  const storage = new FakeStorage();
  storage.setItem("ece493.schedules", JSON.stringify([{ id: "sched-1" }, { id: "sched-2" }]));
  const adapter = createEditPublishScheduleStorageAdapter(storage);

  const first = editAndPublishSchedule(validPayload(), {
    adapter,
    idProvider: () => "pub-a",
    nowProvider: () => "2026-08-01T09:00:00.000Z"
  });
  assert.equal(first.status, "success");

  const second = editAndPublishSchedule(
    {
      ...validPayload(),
      schedule_id: "sched-2",
      entries: [
        {
          entry_id: "e1",
          title: "A",
          room: "B",
          start_time: "2026-08-01T10:00:00.000Z",
          end_time: "2026-08-01T11:00:00.000Z"
        }
      ]
    },
    {
      adapter,
      idProvider: () => "pub-b",
      nowProvider: () => "2026-08-01T09:30:00.000Z"
    }
  );
  assert.equal(second.status, "success");
  assert.equal(adapter.loadPublishedSchedules().length, 2);
});

test("error rendering/clearing handles mapped and unmapped fields", () => {
  const elements = {
    summary: createElement(),
    fieldErrors: {
      schedule_id: createElement(),
      version: createElement(),
      entries: createElement(),
      simulate_save_failure: createElement(),
      simulate_announcement_failure: createElement()
    }
  };

  clearEditPublishScheduleErrorState(elements);
  assert.equal(elements.summary.hidden, true);

  renderEditPublishScheduleErrorState(
    [
      buildValidationError("schedule_id", "required", "Schedule ID is required."),
      buildValidationError("system", "storage_failed", "storage"),
      buildValidationError("unknown_field", "x", "ignored")
    ],
    elements
  );

  assert.equal(elements.summary.hidden, false);
  assert.equal(elements.fieldErrors.schedule_id.hidden, false);
  assert.equal(elements.fieldErrors.simulate_save_failure.hidden, false);

  renderEditPublishScheduleErrorState([], elements);
  assert.equal(elements.summary.hidden, true);
});

test("success view hides form and shows summary info", () => {
  const elements = {
    formContainer: createElement(),
    successContainer: createElement(),
    successMessage: createElement(),
    successMeta: createElement()
  };

  showEditPublishScheduleSuccessView(
    { version: 2, published_at: "2026-08-01T10:00:00.000Z" },
    elements
  );

  assert.equal(elements.formContainer.hidden, true);
  assert.equal(elements.successContainer.hidden, false);
  assert.equal(elements.successMessage.textContent, "Schedule published successfully.");
  assert.equal(
    elements.successMeta.textContent,
    "Version 2 published at 2026-08-01T10:00:00.000Z."
  );
});

test("init app returns null when document or form missing", () => {
  assert.equal(initEditPublishScheduleApp({ document: null }), null);
  assert.equal(initEditPublishScheduleApp({ document: { getElementById: () => null } }), null);
});

test("init app supports global document/window fallback", () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;

  try {
    const doc = createDocumentMock();
    globalThis.document = doc;
    globalThis.window = { localStorage: new FakeStorage() };

    const app = initEditPublishScheduleApp();
    assert.ok(app);
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  }
});

test("init app throws when storage missing and no adapter", () => {
  const doc = createDocumentMock();
  assert.throws(() => initEditPublishScheduleApp({ document: doc }), /LocalStorage-like/);
});

test("init app handles window without localStorage", () => {
  const previousWindow = globalThis.window;

  try {
    globalThis.window = {};
    const doc = createDocumentMock();
    assert.throws(() => initEditPublishScheduleApp({ document: doc }), /LocalStorage-like/);
  } finally {
    globalThis.window = previousWindow;
  }
});

test("init app handles undefined global window fallback", () => {
  const previousWindow = globalThis.window;

  try {
    globalThis.window = undefined;
    const doc = createDocumentMock();
    assert.throws(() => initEditPublishScheduleApp({ document: doc }), /LocalStorage-like/);
  } finally {
    globalThis.window = previousWindow;
  }
});

test("init app supports explicit adapter branch", () => {
  const doc = createDocumentMock();
  const app = initEditPublishScheduleApp({
    document: doc,
    adapter: {
      loadSchedules() {
        return [];
      },
      loadPublishedSchedules() {
        return [];
      },
      savePublishedSchedules() {},
      appendAudit() {}
    }
  });
  assert.ok(app);
});

test("submit flow covers success, parse failure, and validation failure paths", () => {
  const successStorage = new FakeStorage();
  successStorage.setItem("ece493.schedules", JSON.stringify([{ id: "sched-1" }]));
  const successDoc = createDocumentMock();
  const successApp = initEditPublishScheduleApp({ document: successDoc, storage: successStorage });
  assert.ok(successApp);

  successDoc.elements["edit-publish-schedule-id"].value = "sched-1";
  successDoc.elements["edit-publish-schedule-version"].value = "1";
  successDoc.elements["edit-publish-schedule-entries"].value = JSON.stringify(validEntries());

  let prevented = false;
  let result = successDoc.form.listener({
    preventDefault() {
      prevented = true;
    }
  });

  assert.equal(prevented, true);
  assert.equal(result.status, "success");
  assert.equal(successDoc.elements["edit-publish-schedule-form-container"].hidden, true);
  assert.equal(successDoc.elements["edit-publish-schedule-success-container"].hidden, false);
  assert.equal(successDoc.form.resetCalls, 1);

  const parseDoc = createDocumentMock();
  const parseApp = initEditPublishScheduleApp({
    document: parseDoc,
    storage: successStorage
  });
  assert.ok(parseApp);
  parseDoc.elements["edit-publish-schedule-entries"].value = "{bad";
  result = parseDoc.form.listener();
  assert.equal(result.status, "validation_failed");

  const failStorage = new FakeStorage();
  const failDoc = createDocumentMock();
  const failApp = initEditPublishScheduleApp({ document: failDoc, storage: failStorage });
  assert.ok(failApp);

  failDoc.elements["edit-publish-schedule-id"].value = "";
  failDoc.elements["edit-publish-schedule-version"].value = "0";
  failDoc.elements["edit-publish-schedule-entries"].value = "[]";

  result = failDoc.form.listener();
  assert.equal(result.status, "validation_failed");
  assert.equal(failDoc.elements["edit-publish-schedule-error-summary"].hidden, false);
});

test("submit flow handles event without preventDefault", () => {
  const doc = createDocumentMock();
  const app = initEditPublishScheduleApp({
    document: doc,
    adapter: {
      loadSchedules() {
        return [];
      },
      loadPublishedSchedules() {
        return [];
      },
      savePublishedSchedules() {},
      appendAudit() {}
    }
  });
  assert.ok(app);

  const result = doc.form.listener({});
  assert.equal(result.status, "validation_failed");
});

test("helper mocks cover untaken branches", () => {
  const form = createFormMock();
  form.addEventListener("click", () => {});
  assert.equal(form.listener, null);

  const doc = createDocumentMock();
  assert.equal(doc.getElementById("does-not-exist"), null);
});
