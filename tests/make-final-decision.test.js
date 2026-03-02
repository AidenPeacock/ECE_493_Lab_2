import test from "node:test";
import assert from "node:assert/strict";

import {
  buildValidationError,
  clearMakeFinalDecisionErrorState,
  createMakeFinalDecisionStorageAdapter,
  generateId,
  initMakeFinalDecisionApp,
  makeFinalDecision,
  normalizeEmail,
  normalizeText,
  renderMakeFinalDecisionErrorState,
  showMakeFinalDecisionSuccessView,
  validateMakeFinalDecisionInput
} from "../src/js/009-make-final-decision.js";

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
    "make-final-decision-form": form,
    "make-final-decision-form-container": createElement(),
    "make-final-decision-success-container": createElement(),
    "make-final-decision-success-message": createElement(),
    "make-final-decision-error-summary": createElement(),
    "make-final-decision-paper-id-error": createElement(),
    "make-final-decision-editor-email-error": createElement(),
    "make-final-decision-decision-error": createElement(),
    "make-final-decision-review-count-error": createElement(),
    "make-final-decision-notification-error": createElement(),
    "make-final-decision-paper-id": createElement(),
    "make-final-decision-editor-email": createElement(),
    "make-final-decision-decision": createElement(),
    "make-final-decision-review-count": createElement(),
    "make-final-decision-notification-delivered": createElement()
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
    paper_id: "P-9",
    editor_email: "editor@example.com",
    decision: "accept",
    review_count: 3,
    notification_delivered: true
  };
}

function reviewsForPaper(paperId, count = 3) {
  return Array.from({ length: count }).map((_, index) => ({
    id: `r-${index + 1}`,
    paper_id: paperId,
    referee_email: `ref-${index + 1}@example.com`
  }));
}

test("normalize helpers cover normal and nullish values", () => {
  assert.equal(normalizeText("  x  "), "x");
  assert.equal(normalizeText(null), "");
  assert.equal(normalizeEmail("  USER@EXAMPLE.COM"), "user@example.com");
});

test("validation covers required fields, allowed decisions, review count, notification gate, and valid path", () => {
  const missing = validateMakeFinalDecisionInput({});
  assert.equal(missing.some((e) => e.code === "required"), true);
  assert.equal(missing.some((e) => e.code === "invalid_decision"), true);
  assert.equal(missing.some((e) => e.code === "insufficient_reviews"), true);
  assert.equal(missing.some((e) => e.code === "notification_failed"), true);

  const nonInteger = validateMakeFinalDecisionInput({ ...validPayload(), review_count: 3.4 });
  assert.equal(nonInteger.some((e) => e.code === "insufficient_reviews"), true);

  const lowCount = validateMakeFinalDecisionInput({ ...validPayload(), review_count: 2 });
  assert.equal(lowCount.some((e) => e.code === "insufficient_reviews"), true);

  const invalidDecision = validateMakeFinalDecisionInput({ ...validPayload(), decision: "maybe" });
  assert.equal(invalidDecision.some((e) => e.code === "invalid_decision"), true);

  const noNotification = validateMakeFinalDecisionInput({
    ...validPayload(),
    notification_delivered: false
  });
  assert.equal(noNotification.some((e) => e.code === "notification_failed"), true);

  assert.deepEqual(validateMakeFinalDecisionInput(validPayload()), []);
});

test("adapter handles parse fallback and persistence", () => {
  const storage = new FakeStorage();
  const adapter = createMakeFinalDecisionStorageAdapter(storage);

  assert.deepEqual(adapter.loadReviews(), []);
  assert.deepEqual(adapter.loadFinalDecisions(), []);

  storage.setItem("ece493.reviews", "{bad json");
  assert.deepEqual(adapter.loadReviews(), []);

  storage.setItem("ece493.finalDecisions", JSON.stringify({ nope: true }));
  assert.deepEqual(adapter.loadFinalDecisions(), []);

  adapter.saveFinalDecisions([{ id: "d1" }]);
  assert.equal(adapter.loadFinalDecisions().length, 1);

  adapter.appendAudit({ status: "x" });
  assert.equal(JSON.parse(storage.getItem("ece493.audit")).length, 1);
});

test("adapter rejects invalid local storage interfaces", () => {
  assert.throws(() => createMakeFinalDecisionStorageAdapter(null), /LocalStorage-like/);
  assert.throws(() => createMakeFinalDecisionStorageAdapter({}), /LocalStorage-like/);
  assert.throws(() => createMakeFinalDecisionStorageAdapter({ getItem() {} }), /LocalStorage-like/);
});

test("generateId covers provider and fallback", () => {
  assert.equal(generateId(() => "id-1"), "id-1");
  assert.equal(generateId().startsWith("id_"), true);
});

test("makeFinalDecision requires adapter", () => {
  assert.throws(() => makeFinalDecision(validPayload()), /requires an adapter/);
});

test("makeFinalDecision handles validation failure and audit failure tolerance", () => {
  const result = makeFinalDecision({}, {
    adapter: {
      appendAudit() {
        throw new Error("audit failed");
      }
    }
  });

  assert.equal(result.status, "validation_failed");
});

test("makeFinalDecision handles load failure service unavailable", () => {
  const stringThrow = makeFinalDecision(validPayload(), {
    adapter: {
      loadReviews() {
        throw "db down";
      },
      loadFinalDecisions() {
        return [];
      },
      appendAudit() {}
    }
  });
  assert.equal(stringThrow.status, "service_unavailable");

  const errorThrow = makeFinalDecision(validPayload(), {
    adapter: {
      loadReviews() {
        return [];
      },
      loadFinalDecisions() {
        throw new Error("db error");
      },
      appendAudit() {}
    }
  });
  assert.equal(errorThrow.status, "service_unavailable");
});

test("makeFinalDecision blocks persistence when storage reviews are insufficient", () => {
  const storage = new FakeStorage();
  storage.setItem("ece493.reviews", JSON.stringify(reviewsForPaper("P-9", 2)));
  const adapter = createMakeFinalDecisionStorageAdapter(storage);

  const result = makeFinalDecision(validPayload(), { adapter });
  assert.equal(result.status, "validation_failed");
  assert.equal(result.errors.some((e) => e.code === "insufficient_reviews"), true);
  assert.equal(adapter.loadFinalDecisions().length, 0);
});

test("makeFinalDecision supports idempotent duplicate prevention per paper", () => {
  const storage = new FakeStorage();
  storage.setItem("ece493.reviews", JSON.stringify(reviewsForPaper("P-9", 3)));
  const adapter = createMakeFinalDecisionStorageAdapter(storage);

  const first = makeFinalDecision(validPayload(), {
    adapter,
    idProvider: () => "decision-1",
    nowProvider: () => "2026-01-01T00:00:00.000Z"
  });
  assert.equal(first.status, "success");

  const second = makeFinalDecision(
    {
      ...validPayload(),
      decision: "reject"
    },
    {
      adapter,
      idProvider: () => "decision-2",
      nowProvider: () => "2026-01-01T00:00:01.000Z"
    }
  );

  assert.equal(second.status, "success");
  assert.equal(second.decision_id, "decision-1");
  assert.equal(adapter.loadFinalDecisions().length, 1);
});

test("makeFinalDecision handles save failure and allows another paper success", () => {
  const saveError = makeFinalDecision(validPayload(), {
    adapter: {
      loadReviews() {
        return reviewsForPaper("P-9", 3);
      },
      loadFinalDecisions() {
        return [];
      },
      saveFinalDecisions() {
        throw new Error("write fail");
      },
      appendAudit() {}
    }
  });
  assert.equal(saveError.status, "service_unavailable");

  const saveStringError = makeFinalDecision(validPayload(), {
    adapter: {
      loadReviews() {
        return reviewsForPaper("P-9", 3);
      },
      loadFinalDecisions() {
        return [];
      },
      saveFinalDecisions() {
        throw "write string";
      },
      appendAudit() {}
    }
  });
  assert.equal(saveStringError.status, "service_unavailable");

  const storage = new FakeStorage();
  storage.setItem("ece493.reviews", JSON.stringify([...reviewsForPaper("P-9", 3), ...reviewsForPaper("P-10", 3)]));
  const adapter = createMakeFinalDecisionStorageAdapter(storage);

  const first = makeFinalDecision(validPayload(), {
    adapter,
    idProvider: () => "d-1"
  });
  assert.equal(first.status, "success");

  const second = makeFinalDecision(
    {
      ...validPayload(),
      paper_id: "P-10"
    },
    {
      adapter,
      idProvider: () => "d-2"
    }
  );

  assert.equal(second.status, "success");
  assert.equal(adapter.loadFinalDecisions().length, 2);
});

test("error rendering and clearing handles mapped and unmapped field errors", () => {
  const elements = {
    summary: createElement(),
    fieldErrors: {
      paper_id: createElement(),
      editor_email: createElement(),
      decision: createElement(),
      review_count: createElement(),
      notification_delivered: createElement()
    }
  };

  clearMakeFinalDecisionErrorState(elements);
  assert.equal(elements.summary.hidden, true);

  renderMakeFinalDecisionErrorState(
    [
      buildValidationError("paper_id", "required", "Paper ID is required."),
      buildValidationError("system", "service_unavailable", "retry")
    ],
    elements
  );

  assert.equal(elements.summary.hidden, false);
  assert.equal(elements.fieldErrors.paper_id.hidden, false);
  assert.equal(elements.fieldErrors.decision.hidden, true);

  renderMakeFinalDecisionErrorState([], elements);
  assert.equal(elements.summary.hidden, true);
});

test("success view hides form and shows confirmation", () => {
  const elements = {
    formContainer: createElement(),
    successContainer: createElement(),
    successMessage: createElement()
  };

  showMakeFinalDecisionSuccessView(elements);
  assert.equal(elements.formContainer.hidden, true);
  assert.equal(elements.successContainer.hidden, false);
  assert.equal(elements.successMessage.textContent, "Final decision recorded successfully.");
});

test("init app returns null when document or form missing", () => {
  assert.equal(initMakeFinalDecisionApp({ document: null }), null);
  assert.equal(initMakeFinalDecisionApp({ document: { getElementById: () => null } }), null);
});

test("init app supports global document/window fallback", () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;

  try {
    const doc = createDocumentMock();
    globalThis.document = doc;
    globalThis.window = { localStorage: new FakeStorage() };

    const app = initMakeFinalDecisionApp();
    assert.ok(app);
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  }
});

test("init app throws when storage missing and no adapter", () => {
  const doc = createDocumentMock();
  assert.throws(() => initMakeFinalDecisionApp({ document: doc }), /LocalStorage-like/);
});

test("init app handles window without localStorage", () => {
  const previousWindow = globalThis.window;

  try {
    globalThis.window = {};
    const doc = createDocumentMock();
    assert.throws(() => initMakeFinalDecisionApp({ document: doc }), /LocalStorage-like/);
  } finally {
    globalThis.window = previousWindow;
  }
});

test("init app supports explicit adapter branch", () => {
  const doc = createDocumentMock();
  const app = initMakeFinalDecisionApp({
    document: doc,
    adapter: {
      loadReviews() {
        return [];
      },
      loadFinalDecisions() {
        return [];
      },
      saveFinalDecisions() {},
      appendAudit() {}
    }
  });
  assert.ok(app);
});

test("submit flow covers success and validation failure paths", () => {
  const successStorage = new FakeStorage();
  successStorage.setItem("ece493.reviews", JSON.stringify(reviewsForPaper("P-9", 3)));
  const successDoc = createDocumentMock();
  const successApp = initMakeFinalDecisionApp({ document: successDoc, storage: successStorage });
  assert.ok(successApp);

  successDoc.elements["make-final-decision-paper-id"].value = "P-9";
  successDoc.elements["make-final-decision-editor-email"].value = "editor@example.com";
  successDoc.elements["make-final-decision-decision"].value = "accept";
  successDoc.elements["make-final-decision-review-count"].value = "3";
  successDoc.elements["make-final-decision-notification-delivered"].checked = true;

  let prevented = false;
  let result = successDoc.form.listener({
    preventDefault() {
      prevented = true;
    }
  });

  assert.equal(prevented, true);
  assert.equal(result.status, "success");
  assert.equal(successDoc.elements["make-final-decision-form-container"].hidden, true);
  assert.equal(successDoc.elements["make-final-decision-success-container"].hidden, false);
  assert.equal(successDoc.form.resetCalls, 1);

  const failDoc = createDocumentMock();
  const failStorage = new FakeStorage();
  const failApp = initMakeFinalDecisionApp({ document: failDoc, storage: failStorage });
  assert.ok(failApp);

  failDoc.elements["make-final-decision-paper-id"].value = "";
  failDoc.elements["make-final-decision-editor-email"].value = "";
  failDoc.elements["make-final-decision-decision"].value = "";
  failDoc.elements["make-final-decision-review-count"].value = "0";
  failDoc.elements["make-final-decision-notification-delivered"].checked = false;

  result = failDoc.form.listener();
  assert.equal(result.status, "validation_failed");
  assert.equal(failDoc.elements["make-final-decision-error-summary"].hidden, false);
});

test("submit flow handles event without preventDefault", () => {
  const doc = createDocumentMock();
  const app = initMakeFinalDecisionApp({
    document: doc,
    adapter: {
      loadReviews() {
        return [];
      },
      loadFinalDecisions() {
        return [];
      },
      saveFinalDecisions() {},
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
