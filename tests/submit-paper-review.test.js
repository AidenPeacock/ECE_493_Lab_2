import test from "node:test";
import assert from "node:assert/strict";

import {
  buildValidationError,
  clearSubmitPaperReviewErrorState,
  createSubmitPaperReviewStorageAdapter,
  generateId,
  initSubmitPaperReviewApp,
  normalizeEmail,
  normalizeText,
  renderSubmitPaperReviewErrorState,
  showSubmitPaperReviewSuccessView,
  submitPaperReview,
  validateSubmitPaperReviewInput
} from "../src/js/008-submit-paper-review.js";

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
    "submit-review-form": form,
    "submit-review-form-container": createElement(),
    "submit-review-success-container": createElement(),
    "submit-review-success-message": createElement(),
    "submit-review-error-summary": createElement(),
    "submit-review-invitation-error": createElement(),
    "submit-review-paper-id-error": createElement(),
    "submit-review-referee-email-error": createElement(),
    "submit-review-score-error": createElement(),
    "submit-review-comments-error": createElement(),
    "submit-review-invitation-accepted": createElement(),
    "submit-review-paper-id": createElement(),
    "submit-review-referee-email": createElement(),
    "submit-review-score": createElement(),
    "submit-review-comments": createElement()
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
    invitation_accepted: true,
    paper_id: "P-1",
    referee_email: "reviewer@example.com",
    score: 8,
    comments: "Well-structured paper with strong results."
  };
}

test("normalize helpers cover normal and nullish values", () => {
  assert.equal(normalizeText("  x  "), "x");
  assert.equal(normalizeText(null), "");
  assert.equal(normalizeEmail("  USER@EXAMPLE.COM"), "user@example.com");
});

test("validation covers invitation gate, required fields, score range, invalid chars, and valid path", () => {
  const missing = validateSubmitPaperReviewInput({});
  assert.equal(missing.some((e) => e.code === "invitation_not_accepted"), true);
  assert.equal(missing.some((e) => e.code === "required"), true);

  const invalidScoreLow = validateSubmitPaperReviewInput({ ...validPayload(), score: 0 });
  assert.equal(invalidScoreLow.some((e) => e.code === "invalid_score"), true);

  const invalidScoreHigh = validateSubmitPaperReviewInput({ ...validPayload(), score: 11 });
  assert.equal(invalidScoreHigh.some((e) => e.code === "invalid_score"), true);

  const invalidScoreNan = validateSubmitPaperReviewInput({ ...validPayload(), score: "bad" });
  assert.equal(invalidScoreNan.some((e) => e.code === "invalid_score"), true);

  const invalidChars = validateSubmitPaperReviewInput({ ...validPayload(), comments: "bad <tag>" });
  assert.equal(invalidChars.some((e) => e.code === "invalid_characters"), true);

  assert.deepEqual(validateSubmitPaperReviewInput(validPayload()), []);
});

test("adapter handles parse fallback and persistence", () => {
  const storage = new FakeStorage();
  const adapter = createSubmitPaperReviewStorageAdapter(storage);

  assert.deepEqual(adapter.loadReviews(), []);
  storage.setItem("ece493.reviews", "{bad json");
  assert.deepEqual(adapter.loadReviews(), []);
  storage.setItem("ece493.reviews", JSON.stringify({ nope: true }));
  assert.deepEqual(adapter.loadReviews(), []);

  adapter.saveReviews([{ id: "r1" }]);
  assert.equal(adapter.loadReviews().length, 1);

  adapter.appendAudit({ status: "x" });
  assert.equal(JSON.parse(storage.getItem("ece493.audit")).length, 1);
});

test("adapter rejects invalid local storage interfaces", () => {
  assert.throws(() => createSubmitPaperReviewStorageAdapter(null), /LocalStorage-like/);
  assert.throws(() => createSubmitPaperReviewStorageAdapter({}), /LocalStorage-like/);
  assert.throws(() => createSubmitPaperReviewStorageAdapter({ getItem() {} }), /LocalStorage-like/);
});

test("generateId covers provider and fallback", () => {
  assert.equal(generateId(() => "id-1"), "id-1");
  assert.equal(generateId().startsWith("id_"), true);
});

test("submitPaperReview requires adapter", () => {
  assert.throws(() => submitPaperReview(validPayload()), /requires an adapter/);
});

test("submitPaperReview handles validation failure and audit failure tolerance", () => {
  const result = submitPaperReview({}, {
    adapter: {
      appendAudit() {
        throw new Error("audit failed");
      }
    }
  });

  assert.equal(result.status, "validation_failed");
});

test("submitPaperReview handles load failure service unavailable", () => {
  const stringThrow = submitPaperReview(validPayload(), {
    adapter: {
      loadReviews() {
        throw "db down";
      },
      appendAudit() {}
    }
  });
  assert.equal(stringThrow.status, "service_unavailable");

  const errorThrow = submitPaperReview(validPayload(), {
    adapter: {
      loadReviews() {
        throw new Error("db error");
      },
      appendAudit() {}
    }
  });
  assert.equal(errorThrow.status, "service_unavailable");
});

test("submitPaperReview supports idempotent duplicate review prevention", () => {
  const storage = new FakeStorage();
  const adapter = createSubmitPaperReviewStorageAdapter(storage);

  const first = submitPaperReview(validPayload(), {
    adapter,
    idProvider: () => "rev-1",
    nowProvider: () => "2026-01-01T00:00:00.000Z"
  });
  assert.equal(first.status, "success");

  const second = submitPaperReview(validPayload(), {
    adapter,
    idProvider: () => "rev-2",
    nowProvider: () => "2026-01-01T00:00:01.000Z"
  });
  assert.equal(second.status, "success");
  assert.equal(second.review_id, "rev-1");
  assert.equal(adapter.loadReviews().length, 1);
});

test("submitPaperReview handles save failure branches and review update for different reviewer", () => {
  const errorSave = submitPaperReview(validPayload(), {
    adapter: {
      loadReviews() {
        return [];
      },
      saveReviews() {
        throw new Error("write fail");
      },
      appendAudit() {}
    }
  });
  assert.equal(errorSave.status, "service_unavailable");

  const stringSave = submitPaperReview(validPayload(), {
    adapter: {
      loadReviews() {
        return [];
      },
      saveReviews() {
        throw "write string";
      },
      appendAudit() {}
    }
  });
  assert.equal(stringSave.status, "service_unavailable");

  const storage = new FakeStorage();
  const adapter = createSubmitPaperReviewStorageAdapter(storage);
  const first = submitPaperReview(validPayload(), { adapter, idProvider: () => "a" });
  assert.equal(first.status, "success");

  const second = submitPaperReview(
    {
      ...validPayload(),
      referee_email: "another@example.com"
    },
    { adapter, idProvider: () => "b" }
  );
  assert.equal(second.status, "success");
  assert.equal(adapter.loadReviews().length, 2);
});

test("error rendering and clearing handles mapped and unmapped field errors", () => {
  const elements = {
    summary: createElement(),
    fieldErrors: {
      invitation_accepted: createElement(),
      paper_id: createElement(),
      referee_email: createElement(),
      score: createElement(),
      comments: createElement()
    }
  };

  clearSubmitPaperReviewErrorState(elements);
  assert.equal(elements.summary.hidden, true);

  renderSubmitPaperReviewErrorState(
    [
      buildValidationError("paper_id", "required", "Paper ID is required."),
      buildValidationError("system", "service_unavailable", "retry")
    ],
    elements
  );
  assert.equal(elements.summary.hidden, false);
  assert.equal(elements.fieldErrors.paper_id.hidden, false);
  assert.equal(elements.fieldErrors.comments.hidden, true);

  renderSubmitPaperReviewErrorState([], elements);
  assert.equal(elements.summary.hidden, true);
});

test("success view hides form and shows confirmation", () => {
  const elements = {
    formContainer: createElement(),
    successContainer: createElement(),
    successMessage: createElement()
  };

  showSubmitPaperReviewSuccessView(elements);
  assert.equal(elements.formContainer.hidden, true);
  assert.equal(elements.successContainer.hidden, false);
  assert.equal(elements.successMessage.textContent, "Review submitted successfully.");
});

test("init app returns null when document or form missing", () => {
  assert.equal(initSubmitPaperReviewApp({ document: null }), null);
  assert.equal(initSubmitPaperReviewApp({ document: { getElementById: () => null } }), null);
});

test("init app supports global document/window fallback", () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;

  try {
    const doc = createDocumentMock();
    globalThis.document = doc;
    globalThis.window = { localStorage: new FakeStorage() };

    const app = initSubmitPaperReviewApp();
    assert.ok(app);
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  }
});

test("init app throws when storage missing and no adapter", () => {
  const doc = createDocumentMock();
  assert.throws(() => initSubmitPaperReviewApp({ document: doc }), /LocalStorage-like/);
});

test("init app handles window without localStorage", () => {
  const previousWindow = globalThis.window;

  try {
    globalThis.window = {};
    const doc = createDocumentMock();
    assert.throws(() => initSubmitPaperReviewApp({ document: doc }), /LocalStorage-like/);
  } finally {
    globalThis.window = previousWindow;
  }
});

test("init app supports explicit adapter branch", () => {
  const doc = createDocumentMock();
  const app = initSubmitPaperReviewApp({
    document: doc,
    adapter: {
      loadReviews() {
        return [];
      },
      saveReviews() {},
      appendAudit() {}
    }
  });
  assert.ok(app);
});

test("submit flow covers success and validation failure paths", () => {
  const successStorage = new FakeStorage();
  const successDoc = createDocumentMock();
  const successApp = initSubmitPaperReviewApp({ document: successDoc, storage: successStorage });
  assert.ok(successApp);

  successDoc.elements["submit-review-invitation-accepted"].checked = true;
  successDoc.elements["submit-review-paper-id"].value = "P-1";
  successDoc.elements["submit-review-referee-email"].value = "reviewer@example.com";
  successDoc.elements["submit-review-score"].value = "8";
  successDoc.elements["submit-review-comments"].value = "Strong methodology and clear writing.";

  let prevented = false;
  let result = successDoc.form.listener({
    preventDefault() {
      prevented = true;
    }
  });

  assert.equal(prevented, true);
  assert.equal(result.status, "success");
  assert.equal(successDoc.elements["submit-review-form-container"].hidden, true);
  assert.equal(successDoc.elements["submit-review-success-container"].hidden, false);
  assert.equal(successDoc.form.resetCalls, 1);

  const failDoc = createDocumentMock();
  const failStorage = new FakeStorage();
  const failApp = initSubmitPaperReviewApp({ document: failDoc, storage: failStorage });
  assert.ok(failApp);

  failDoc.elements["submit-review-invitation-accepted"].checked = false;
  failDoc.elements["submit-review-paper-id"].value = "";
  failDoc.elements["submit-review-referee-email"].value = "";
  failDoc.elements["submit-review-score"].value = "0";
  failDoc.elements["submit-review-comments"].value = "";

  result = failDoc.form.listener();
  assert.equal(result.status, "validation_failed");
  assert.equal(failDoc.elements["submit-review-error-summary"].hidden, false);
});

test("submit flow handles event without preventDefault", () => {
  const doc = createDocumentMock();
  const app = initSubmitPaperReviewApp({
    document: doc,
    adapter: {
      loadReviews() {
        return [];
      },
      saveReviews() {},
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
