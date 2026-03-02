import test from "node:test";
import assert from "node:assert/strict";

import {
  buildValidationError,
  clearGenerateScheduleErrorState,
  createGenerateScheduleStorageAdapter,
  generateId,
  generateSchedule,
  initGenerateScheduleApp,
  normalizeEmail,
  normalizeText,
  renderGenerateScheduleErrorState,
  showGenerateScheduleSuccessView,
  validateGenerateScheduleInput
} from "../src/js/010-generate-schedule.js";

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
  return { value: initialValue, hidden: true, textContent: "", checked: false, innerHTML: "" };
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
    "generate-schedule-form": form,
    "generate-schedule-form-container": createElement(),
    "generate-schedule-success-container": createElement(),
    "generate-schedule-success-message": createElement(),
    "generate-schedule-generated-html": createElement(),
    "generate-schedule-error-summary": createElement(),
    "generate-schedule-organizer-email-error": createElement(),
    "generate-schedule-start-time-error": createElement(),
    "generate-schedule-slot-minutes-error": createElement(),
    "generate-schedule-algorithm-error": createElement(),
    "generate-schedule-email-error": createElement(),
    "generate-schedule-accepted-papers-error": createElement(),
    "generate-schedule-organizer-email": createElement(),
    "generate-schedule-start-time": createElement(),
    "generate-schedule-slot-minutes": createElement(),
    "generate-schedule-algorithm-ready": createElement(),
    "generate-schedule-email-ready": createElement()
  };

  return {
    form,
    elements,
    getElementById(id) {
      return Object.prototype.hasOwnProperty.call(elements, id) ? elements[id] : null;
    }
  };
}

function validPayload() {
  return {
    organizer_email: "editor@example.com",
    conference_start_iso: "2026-08-01T09:00:00.000Z",
    slot_minutes: 15,
    algorithm_ready: true,
    email_delivery_ready: true
  };
}

function acceptedDecisions() {
  return [
    { paper_id: "P-3", title: "Zeta Methods", decision: "accept" },
    { paper_id: "P-1", title: "Alpha Systems", decision: "accept" },
    { paper_id: "P-2", title: "Beta Networks", decision: "accept" }
  ];
}

test("normalize helpers cover normal and nullish values", () => {
  assert.equal(normalizeText("  x  "), "x");
  assert.equal(normalizeText(null), "");
  assert.equal(normalizeEmail("  USER@EXAMPLE.COM"), "user@example.com");
});

test("validation covers required fields, datetime, slot minutes, algorithm/email checks, and valid path", () => {
  const missing = validateGenerateScheduleInput({});
  assert.equal(missing.some((e) => e.code === "required"), true);
  assert.equal(missing.some((e) => e.code === "invalid_slot_minutes"), true);
  assert.equal(missing.some((e) => e.code === "algorithm_failed"), true);
  assert.equal(missing.some((e) => e.code === "email_delivery_failed"), true);

  const invalidDate = validateGenerateScheduleInput({
    ...validPayload(),
    conference_start_iso: "2026-08-01"
  });
  assert.equal(invalidDate.some((e) => e.code === "invalid_datetime"), true);

  const invalidSlot = validateGenerateScheduleInput({ ...validPayload(), slot_minutes: 0 });
  assert.equal(invalidSlot.some((e) => e.code === "invalid_slot_minutes"), true);

  const noAlgorithm = validateGenerateScheduleInput({ ...validPayload(), algorithm_ready: false });
  assert.equal(noAlgorithm.some((e) => e.code === "algorithm_failed"), true);

  const noEmail = validateGenerateScheduleInput({ ...validPayload(), email_delivery_ready: false });
  assert.equal(noEmail.some((e) => e.code === "email_delivery_failed"), true);

  assert.deepEqual(validateGenerateScheduleInput(validPayload()), []);
});

test("adapter handles parse fallback and persistence", () => {
  const storage = new FakeStorage();
  const adapter = createGenerateScheduleStorageAdapter(storage);

  assert.deepEqual(adapter.loadFinalDecisions(), []);
  assert.deepEqual(adapter.loadSchedules(), []);

  storage.setItem("ece493.finalDecisions", "{bad json");
  assert.deepEqual(adapter.loadFinalDecisions(), []);

  storage.setItem("ece493.schedules", JSON.stringify({ nope: true }));
  assert.deepEqual(adapter.loadSchedules(), []);

  adapter.saveSchedules([{ id: "s1" }]);
  assert.equal(adapter.loadSchedules().length, 1);

  adapter.appendAudit({ status: "x" });
  assert.equal(JSON.parse(storage.getItem("ece493.audit")).length, 1);
});

test("adapter rejects invalid local storage interfaces", () => {
  assert.throws(() => createGenerateScheduleStorageAdapter(null), /LocalStorage-like/);
  assert.throws(() => createGenerateScheduleStorageAdapter({}), /LocalStorage-like/);
  assert.throws(() => createGenerateScheduleStorageAdapter({ getItem() {} }), /LocalStorage-like/);
});

test("generateId covers provider and fallback", () => {
  assert.equal(generateId(() => "id-1"), "id-1");
  assert.equal(generateId().startsWith("id_"), true);
});

test("generateSchedule requires adapter", () => {
  assert.throws(() => generateSchedule(validPayload()), /requires an adapter/);
});

test("generateSchedule handles validation failure and audit failure tolerance", () => {
  const result = generateSchedule({}, {
    adapter: {
      appendAudit() {
        throw new Error("audit failed");
      }
    }
  });

  assert.equal(result.status, "validation_failed");
});

test("generateSchedule handles load failures as service unavailable", () => {
  const stringThrow = generateSchedule(validPayload(), {
    adapter: {
      loadFinalDecisions() {
        throw "db down";
      },
      loadSchedules() {
        return [];
      },
      appendAudit() {}
    }
  });
  assert.equal(stringThrow.status, "service_unavailable");

  const errorThrow = generateSchedule(validPayload(), {
    adapter: {
      loadFinalDecisions() {
        return [];
      },
      loadSchedules() {
        throw new Error("db error");
      },
      appendAudit() {}
    }
  });
  assert.equal(errorThrow.status, "service_unavailable");
});

test("generateSchedule blocks when no accepted papers exist", () => {
  const storage = new FakeStorage();
  storage.setItem(
    "ece493.finalDecisions",
    JSON.stringify([{ paper_id: "P-1", decision: "reject" }])
  );
  const adapter = createGenerateScheduleStorageAdapter(storage);

  const result = generateSchedule(validPayload(), { adapter });
  assert.equal(result.status, "validation_failed");
  assert.equal(result.errors.some((e) => e.code === "none_accepted"), true);
  assert.equal(adapter.loadSchedules().length, 0);
});

test("generateSchedule supports idempotent duplicate schedule generation", () => {
  const storage = new FakeStorage();
  storage.setItem("ece493.finalDecisions", JSON.stringify(acceptedDecisions()));
  const adapter = createGenerateScheduleStorageAdapter(storage);

  const first = generateSchedule(validPayload(), {
    adapter,
    idProvider: () => "sched-1",
    nowProvider: () => "2026-01-01T00:00:00.000Z"
  });
  assert.equal(first.status, "success");

  const second = generateSchedule(validPayload(), {
    adapter,
    idProvider: () => "sched-2",
    nowProvider: () => "2026-01-01T00:00:01.000Z"
  });
  assert.equal(second.status, "success");
  assert.equal(second.schedule_id, "sched-1");
  assert.equal(adapter.loadSchedules().length, 1);
});

test("generateSchedule orders papers by title and assigns sequential slots", () => {
  const storage = new FakeStorage();
  storage.setItem("ece493.finalDecisions", JSON.stringify(acceptedDecisions()));
  const adapter = createGenerateScheduleStorageAdapter(storage);

  const result = generateSchedule(validPayload(), {
    adapter,
    idProvider: () => "sched-order"
  });

  assert.equal(result.status, "success");
  assert.equal(result.schedule_html.includes("Alpha Systems"), true);
  assert.equal(result.schedule_html.indexOf("Alpha Systems") < result.schedule_html.indexOf("Beta Networks"), true);

  const record = adapter.loadSchedules()[0];
  assert.equal(record.schedule_rows[0].title, "Alpha Systems");
  assert.equal(record.schedule_rows[1].slot_start, "2026-08-01T09:15:00.000Z");
});

test("generateSchedule handles save failure branches and fallback title from paper id", () => {
  const saveError = generateSchedule(validPayload(), {
    adapter: {
      loadFinalDecisions() {
        return acceptedDecisions();
      },
      loadSchedules() {
        return [];
      },
      saveSchedules() {
        throw new Error("write fail");
      },
      appendAudit() {}
    }
  });
  assert.equal(saveError.status, "service_unavailable");

  const saveStringError = generateSchedule(validPayload(), {
    adapter: {
      loadFinalDecisions() {
        return acceptedDecisions();
      },
      loadSchedules() {
        return [];
      },
      saveSchedules() {
        throw "write string";
      },
      appendAudit() {}
    }
  });
  assert.equal(saveStringError.status, "service_unavailable");

  const storage = new FakeStorage();
  storage.setItem(
    "ece493.finalDecisions",
    JSON.stringify([
      { paper_id: "P-9", decision: "accept" },
      { paper_id: "P-8", title: "A Title", decision: "accept" }
    ])
  );

  const adapter = createGenerateScheduleStorageAdapter(storage);
  const success = generateSchedule(validPayload(), {
    adapter,
    idProvider: () => "sched-fallback"
  });
  assert.equal(success.status, "success");
  assert.equal(adapter.loadSchedules()[0].schedule_rows[1].title, "P-9");
});

test("error rendering and clearing handles mapped and unmapped field errors", () => {
  const elements = {
    summary: createElement(),
    fieldErrors: {
      organizer_email: createElement(),
      conference_start_iso: createElement(),
      slot_minutes: createElement(),
      algorithm_ready: createElement(),
      email_delivery_ready: createElement(),
      accepted_papers: createElement()
    }
  };

  clearGenerateScheduleErrorState(elements);
  assert.equal(elements.summary.hidden, true);

  renderGenerateScheduleErrorState(
    [
      buildValidationError("organizer_email", "required", "Organizer email is required."),
      buildValidationError("system", "service_unavailable", "retry")
    ],
    elements
  );
  assert.equal(elements.summary.hidden, false);
  assert.equal(elements.fieldErrors.organizer_email.hidden, false);
  assert.equal(elements.fieldErrors.slot_minutes.hidden, true);

  renderGenerateScheduleErrorState([], elements);
  assert.equal(elements.summary.hidden, true);
});

test("success view hides form, shows confirmation, and renders generated html", () => {
  const elements = {
    formContainer: createElement(),
    successContainer: createElement(),
    successMessage: createElement(),
    generatedHtmlContainer: createElement()
  };

  showGenerateScheduleSuccessView({ schedule_html: "<table></table>" }, elements);
  assert.equal(elements.formContainer.hidden, true);
  assert.equal(elements.successContainer.hidden, false);
  assert.equal(elements.successMessage.textContent, "Schedule generated successfully.");
  assert.equal(elements.generatedHtmlContainer.innerHTML, "<table></table>");

  showGenerateScheduleSuccessView({}, elements);
  assert.equal(elements.generatedHtmlContainer.innerHTML, "");
});

test("init app returns null when document or form missing", () => {
  assert.equal(initGenerateScheduleApp({ document: null }), null);
  assert.equal(initGenerateScheduleApp({ document: { getElementById: () => null } }), null);
});

test("init app supports global document/window fallback", () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;

  try {
    const doc = createDocumentMock();
    globalThis.document = doc;
    globalThis.window = { localStorage: new FakeStorage() };

    const app = initGenerateScheduleApp();
    assert.ok(app);
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  }
});

test("init app throws when storage missing and no adapter", () => {
  const doc = createDocumentMock();
  assert.throws(() => initGenerateScheduleApp({ document: doc }), /LocalStorage-like/);
});

test("init app handles window without localStorage", () => {
  const previousWindow = globalThis.window;

  try {
    globalThis.window = {};
    const doc = createDocumentMock();
    assert.throws(() => initGenerateScheduleApp({ document: doc }), /LocalStorage-like/);
  } finally {
    globalThis.window = previousWindow;
  }
});

test("init app supports explicit adapter branch", () => {
  const doc = createDocumentMock();
  const app = initGenerateScheduleApp({
    document: doc,
    adapter: {
      loadFinalDecisions() {
        return [];
      },
      loadSchedules() {
        return [];
      },
      saveSchedules() {},
      appendAudit() {}
    }
  });
  assert.ok(app);
});

test("submit flow covers success and validation failure paths", () => {
  const successStorage = new FakeStorage();
  successStorage.setItem("ece493.finalDecisions", JSON.stringify(acceptedDecisions()));
  const successDoc = createDocumentMock();
  const successApp = initGenerateScheduleApp({ document: successDoc, storage: successStorage });
  assert.ok(successApp);

  successDoc.elements["generate-schedule-organizer-email"].value = "editor@example.com";
  successDoc.elements["generate-schedule-start-time"].value = "2026-08-01T09:00:00.000Z";
  successDoc.elements["generate-schedule-slot-minutes"].value = "15";
  successDoc.elements["generate-schedule-algorithm-ready"].checked = true;
  successDoc.elements["generate-schedule-email-ready"].checked = true;

  let prevented = false;
  let result = successDoc.form.listener({
    preventDefault() {
      prevented = true;
    }
  });

  assert.equal(prevented, true);
  assert.equal(result.status, "success");
  assert.equal(successDoc.elements["generate-schedule-form-container"].hidden, true);
  assert.equal(successDoc.elements["generate-schedule-success-container"].hidden, false);
  assert.equal(successDoc.form.resetCalls, 1);

  const failDoc = createDocumentMock();
  const failStorage = new FakeStorage();
  const failApp = initGenerateScheduleApp({ document: failDoc, storage: failStorage });
  assert.ok(failApp);

  failDoc.elements["generate-schedule-organizer-email"].value = "";
  failDoc.elements["generate-schedule-start-time"].value = "";
  failDoc.elements["generate-schedule-slot-minutes"].value = "0";
  failDoc.elements["generate-schedule-algorithm-ready"].checked = false;
  failDoc.elements["generate-schedule-email-ready"].checked = false;

  result = failDoc.form.listener();
  assert.equal(result.status, "validation_failed");
  assert.equal(failDoc.elements["generate-schedule-error-summary"].hidden, false);
});

test("submit flow handles event without preventDefault", () => {
  const doc = createDocumentMock();
  const app = initGenerateScheduleApp({
    document: doc,
    adapter: {
      loadFinalDecisions() {
        return [];
      },
      loadSchedules() {
        return [];
      },
      saveSchedules() {},
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
