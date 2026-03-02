import test from "node:test";
import assert from "node:assert/strict";

import {
  assignReferees,
  buildValidationError,
  clearAssignRefereesErrorState,
  createAssignRefereesStorageAdapter,
  generateId,
  initAssignRefereesApp,
  isValidEmailFormat,
  normalizeEmail,
  normalizeText,
  renderAssignRefereesErrorState,
  validateAssignRefereesInput
} from "../src/js/006-assign-referees.js";

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
  return { value: initialValue, hidden: true, textContent: "" };
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
    "assign-referees-form": form,
    "assign-referees-form-container": createElement(),
    "assign-referees-success-container": createElement(),
    "assign-referees-success-message": createElement(),
    "assign-referees-error-summary": createElement(),
    "assign-referees-paper-id-error": createElement(),
    "assign-referees-referees-error": createElement(),
    "assign-referees-referee-1-error": createElement(),
    "assign-referees-referee-2-error": createElement(),
    "assign-referees-referee-3-error": createElement(),
    "assign-referees-paper-id": createElement(),
    "assign-referees-referee-1-email": createElement(),
    "assign-referees-referee-1-load": createElement(),
    "assign-referees-referee-2-email": createElement(),
    "assign-referees-referee-2-load": createElement(),
    "assign-referees-referee-3-email": createElement(),
    "assign-referees-referee-3-load": createElement()
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
    paper_id: "P-1",
    referees: [
      { email: "r1@example.com", current_assigned_papers: 1 },
      { email: "r2@example.com", current_assigned_papers: 2 },
      { email: "r3@example.com", current_assigned_papers: 0 }
    ],
    referee_directory: ["r1@example.com", "r2@example.com", "r3@example.com"]
  };
}

test("text and email helpers normalize and validate", () => {
  assert.equal(normalizeText("  hi  "), "hi");
  assert.equal(normalizeText(null), "");
  assert.equal(normalizeEmail("  USER@EXAMPLE.COM"), "user@example.com");
  assert.equal(isValidEmailFormat("bad"), false);
  assert.equal(isValidEmailFormat("ok@example.com"), true);
});

test("validation enforces required paper id and exactly three referees", () => {
  const missingPaper = validateAssignRefereesInput({ paper_id: "", referees: [] });
  assert.equal(missingPaper.some((e) => e.code === "required"), true);
  assert.equal(missingPaper.some((e) => e.code === "exact_three_required"), true);

  const notArray = validateAssignRefereesInput({ paper_id: "P-1", referees: null });
  assert.equal(notArray.some((e) => e.code === "exact_three_required"), true);
});

test("validation covers invalid format, unknown referee, load, max, and duplicates", () => {
  const invalidFormat = validateAssignRefereesInput({
    ...validPayload(),
    referees: [
      { email: "bad", current_assigned_papers: 1 },
      { email: "r2@example.com", current_assigned_papers: 1 },
      { email: "r3@example.com", current_assigned_papers: 1 }
    ]
  });
  assert.equal(invalidFormat.some((e) => e.code === "invalid_format"), true);

  const unknown = validateAssignRefereesInput({
    ...validPayload(),
    referee_directory: ["r2@example.com", "r3@example.com", "x@example.com"],
    referees: [
      { email: "r1@example.com", current_assigned_papers: 1 },
      { email: "r2@example.com", current_assigned_papers: 1 },
      { email: "r3@example.com", current_assigned_papers: 1 }
    ]
  });
  assert.equal(unknown.some((e) => e.code === "unknown_referee"), true);

  const invalidLoad = validateAssignRefereesInput({
    ...validPayload(),
    referees: [
      { email: "r1@example.com", current_assigned_papers: "NaN" },
      { email: "r2@example.com", current_assigned_papers: 1 },
      { email: "r3@example.com", current_assigned_papers: 1 }
    ]
  });
  assert.equal(invalidLoad.some((e) => e.code === "invalid_load"), true);

  const negativeLoad = validateAssignRefereesInput({
    ...validPayload(),
    referees: [
      { email: "r1@example.com", current_assigned_papers: -1 },
      { email: "r2@example.com", current_assigned_papers: 1 },
      { email: "r3@example.com", current_assigned_papers: 1 }
    ]
  });
  assert.equal(negativeLoad.some((e) => e.code === "invalid_load"), true);

  const defaultLoad = validateAssignRefereesInput({
    ...validPayload(),
    referees: [
      { email: "r1@example.com" },
      { email: "r2@example.com", current_assigned_papers: 1 },
      { email: "r3@example.com", current_assigned_papers: 1 }
    ]
  });
  assert.deepEqual(defaultLoad, []);

  const maxExceeded = validateAssignRefereesInput({
    ...validPayload(),
    referees: [
      { email: "r1@example.com", current_assigned_papers: 5 },
      { email: "r2@example.com", current_assigned_papers: 1 },
      { email: "r3@example.com", current_assigned_papers: 1 }
    ]
  });
  assert.equal(maxExceeded.some((e) => e.code === "max_assigned_exceeded"), true);

  const duplicate = validateAssignRefereesInput({
    ...validPayload(),
    referees: [
      { email: "r1@example.com", current_assigned_papers: 1 },
      { email: "r1@example.com", current_assigned_papers: 1 },
      { email: "r3@example.com", current_assigned_papers: 1 }
    ]
  });
  assert.equal(duplicate.some((e) => e.code === "duplicate_referee"), true);

  assert.deepEqual(validateAssignRefereesInput(validPayload()), []);
});

test("validation covers missing referee email branch", () => {
  const result = validateAssignRefereesInput({
    ...validPayload(),
    referees: [
      { email: "", current_assigned_papers: 1 },
      { email: "r2@example.com", current_assigned_papers: 1 },
      { email: "r3@example.com", current_assigned_papers: 1 }
    ]
  });
  assert.equal(result.some((e) => e.code === "required"), true);
});

test("adapter handles parse fallback and persistence", () => {
  const storage = new FakeStorage();
  const adapter = createAssignRefereesStorageAdapter(storage);

  assert.deepEqual(adapter.loadAssignments(), []);
  storage.setItem("ece493.assignments", "{bad json");
  assert.deepEqual(adapter.loadAssignments(), []);
  storage.setItem("ece493.assignments", JSON.stringify({ nope: true }));
  assert.deepEqual(adapter.loadAssignments(), []);

  adapter.saveAssignments([{ id: "a1" }]);
  assert.equal(adapter.loadAssignments().length, 1);

  adapter.appendAudit({ status: "x" });
  assert.equal(JSON.parse(storage.getItem("ece493.audit")).length, 1);
});

test("adapter rejects invalid local storage interface", () => {
  assert.throws(() => createAssignRefereesStorageAdapter(null), /LocalStorage-like/);
  assert.throws(() => createAssignRefereesStorageAdapter({}), /LocalStorage-like/);
  assert.throws(() => createAssignRefereesStorageAdapter({ getItem() {} }), /LocalStorage-like/);
});

test("generateId covers provider and fallback", () => {
  assert.equal(generateId(() => "id-1"), "id-1");
  assert.equal(generateId().startsWith("id_"), true);
});

test("assignReferees requires adapter", () => {
  assert.throws(() => assignReferees(validPayload()), /requires an adapter/);
});

test("assignReferees handles validation failure and audit failure tolerance", () => {
  const result = assignReferees({ paper_id: "", referees: [] }, {
    adapter: {
      appendAudit() {
        throw new Error("audit failed");
      }
    }
  });

  assert.equal(result.status, "validation_failed");

  const undefinedInput = assignReferees(undefined, {
    adapter: {
      appendAudit() {}
    }
  });
  assert.equal(undefinedInput.status, "validation_failed");
});

test("assignReferees handles service unavailable when loading assignments", () => {
  const stringThrow = assignReferees(validPayload(), {
    adapter: {
      loadAssignments() {
        throw "db down";
      },
      appendAudit() {}
    }
  });
  assert.equal(stringThrow.status, "service_unavailable");

  const errorThrow = assignReferees(validPayload(), {
    adapter: {
      loadAssignments() {
        throw new Error("db down error");
      },
      appendAudit() {}
    }
  });
  assert.equal(errorThrow.status, "service_unavailable");
});

test("assignReferees handles duplicate idempotent submission", () => {
  const storage = new FakeStorage();
  const adapter = createAssignRefereesStorageAdapter(storage);

  const first = assignReferees(validPayload(), {
    adapter,
    idProvider: () => "as-1",
    nowProvider: () => "2026-03-02T00:00:00.000Z"
  });
  assert.equal(first.status, "success");

  const second = assignReferees(validPayload(), {
    adapter,
    idProvider: () => "as-2",
    nowProvider: () => "2026-03-02T00:00:01.000Z"
  });
  assert.equal(second.status, "success");
  assert.equal(second.assignment_id, "as-1");
  assert.equal(adapter.loadAssignments().length, 1);
});

test("assignReferees handles delivery failure return false and throw", () => {
  const adapter = {
    loadAssignments() {
      return [];
    },
    saveAssignments() {
      throw new Error("should not save on delivery failure");
    },
    appendAudit() {}
  };

  const falseResult = assignReferees(validPayload(), {
    adapter,
    deliveryFn() {
      return false;
    }
  });
  assert.equal(falseResult.status, "delivery_failed");

  const throwResult = assignReferees(validPayload(), {
    adapter: {
      loadAssignments() {
        return [];
      },
      appendAudit() {}
    },
    deliveryFn() {
      throw "mail error";
    }
  });
  assert.equal(throwResult.status, "delivery_failed");

  const throwErrorObject = assignReferees(validPayload(), {
    adapter: {
      loadAssignments() {
        return [];
      },
      appendAudit() {}
    },
    deliveryFn() {
      throw new Error("mail error object");
    }
  });
  assert.equal(throwErrorObject.status, "delivery_failed");
});

test("assignReferees handles save failure and success path", () => {
  const saveFailError = assignReferees(validPayload(), {
    adapter: {
      loadAssignments() {
        return [];
      },
      saveAssignments() {
        throw new Error("write error");
      },
      appendAudit() {}
    }
  });
  assert.equal(saveFailError.status, "service_unavailable");

  const saveFailString = assignReferees(validPayload(), {
    adapter: {
      loadAssignments() {
        return [];
      },
      saveAssignments() {
        throw "write string";
      },
      appendAudit() {}
    }
  });
  assert.equal(saveFailString.status, "service_unavailable");

  const storage = new FakeStorage();
  const adapter = createAssignRefereesStorageAdapter(storage);
  const success = assignReferees(validPayload(), {
    adapter,
    idProvider: () => "as-1",
    nowProvider: () => "2026-03-02T00:00:00.000Z"
  });
  assert.equal(success.status, "success");
  assert.equal(adapter.loadAssignments().length, 1);
});

test("error rendering and clearing handles mapped and unmapped fields", () => {
  const elements = {
    summary: createElement(),
    fieldErrors: {
      paper_id: createElement(),
      referees: createElement(),
      referee_1: createElement(),
      referee_2: createElement(),
      referee_3: createElement()
    }
  };

  clearAssignRefereesErrorState(elements);
  assert.equal(elements.summary.hidden, true);

  renderAssignRefereesErrorState(
    [
      buildValidationError("referee_1", "invalid_format", "bad"),
      buildValidationError("system", "service_unavailable", "retry")
    ],
    elements
  );

  assert.equal(elements.summary.hidden, false);
  assert.equal(elements.fieldErrors.referee_1.hidden, false);
  assert.equal(elements.fieldErrors.referee_2.hidden, true);

  renderAssignRefereesErrorState([], elements);
  assert.equal(elements.summary.hidden, true);
});

test("init app returns null when document or form missing", () => {
  assert.equal(initAssignRefereesApp({ document: null }), null);
  assert.equal(initAssignRefereesApp({ document: { getElementById: () => null } }), null);
});

test("init app supports global document/window fallback", () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;

  try {
    const doc = createDocumentMock();
    globalThis.document = doc;
    globalThis.window = { localStorage: new FakeStorage() };

    const app = initAssignRefereesApp();
    assert.ok(app);
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  }
});

test("init app throws when storage is unavailable and no adapter provided", () => {
  const doc = createDocumentMock();
  assert.throws(() => initAssignRefereesApp({ document: doc }), /LocalStorage-like/);
});

test("init app handles window without localStorage", () => {
  const previousWindow = globalThis.window;

  try {
    globalThis.window = {};
    const doc = createDocumentMock();
    assert.throws(() => initAssignRefereesApp({ document: doc }), /LocalStorage-like/);
  } finally {
    globalThis.window = previousWindow;
  }
});

test("init app supports explicit adapter branch", () => {
  const doc = createDocumentMock();
  const app = initAssignRefereesApp({
    document: doc,
    adapter: {
      loadAssignments() {
        return [];
      },
      saveAssignments() {},
      appendAudit() {}
    }
  });

  assert.ok(app);
});

test("submit handler covers success and failure paths", () => {
  const successStorage = new FakeStorage();
  const successDoc = createDocumentMock();
  const successApp = initAssignRefereesApp({ document: successDoc, storage: successStorage });
  assert.ok(successApp);

  successDoc.elements["assign-referees-paper-id"].value = "P-1";
  successDoc.elements["assign-referees-referee-1-email"].value = "r1@example.com";
  successDoc.elements["assign-referees-referee-1-load"].value = "1";
  successDoc.elements["assign-referees-referee-2-email"].value = "r2@example.com";
  successDoc.elements["assign-referees-referee-2-load"].value = "1";
  successDoc.elements["assign-referees-referee-3-email"].value = "r3@example.com";
  successDoc.elements["assign-referees-referee-3-load"].value = "1";

  let prevented = false;
  let result = successDoc.form.listener({
    preventDefault() {
      prevented = true;
    }
  });

  assert.equal(prevented, true);
  assert.equal(result.status, "success");
  assert.equal(successDoc.elements["assign-referees-form-container"].hidden, true);
  assert.equal(successDoc.elements["assign-referees-success-container"].hidden, false);
  assert.equal(successDoc.form.resetCalls, 1);

  const failDoc = createDocumentMock();
  const failStorage = new FakeStorage();
  const failApp = initAssignRefereesApp({ document: failDoc, storage: failStorage });
  assert.ok(failApp);

  failDoc.elements["assign-referees-paper-id"].value = "";
  failDoc.elements["assign-referees-referee-1-email"].value = "bad";
  failDoc.elements["assign-referees-referee-2-email"].value = "";
  failDoc.elements["assign-referees-referee-3-email"].value = "";

  result = failDoc.form.listener();
  assert.equal(result.status, "validation_failed");
  assert.equal(failDoc.elements["assign-referees-error-summary"].hidden, false);
});

test("submit handler accepts event without preventDefault", () => {
  const doc = createDocumentMock();
  const app = initAssignRefereesApp({
    document: doc,
    adapter: {
      loadAssignments() {
        return [];
      },
      saveAssignments() {},
      appendAudit() {}
    }
  });
  assert.ok(app);

  doc.elements["assign-referees-paper-id"].value = "";
  const result = doc.form.listener({});
  assert.equal(result.status, "validation_failed");
});

test("helper mocks cover untaken listener and missing id branches", () => {
  const form = createFormMock();
  form.addEventListener("click", () => {});
  assert.equal(form.listener, null);

  const doc = createDocumentMock();
  assert.equal(doc.getElementById("missing"), null);
});
