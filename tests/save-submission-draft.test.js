import test from "node:test";
import assert from "node:assert/strict";

import {
  buildValidationError,
  clearSaveDraftErrorState,
  createSaveDraftStorageAdapter,
  generateId,
  initSaveSubmissionDraftApp,
  isValidEmailFormat,
  normalizeEmail,
  normalizeText,
  renderSaveDraftErrorState,
  saveSubmissionDraft,
  validateSaveDraftInput
} from "../src/js/005-save-submission-draft.js";

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
    "save-draft-form": form,
    "save-draft-form-container": createElement(),
    "save-draft-success-container": createElement(),
    "save-draft-success-message": createElement(),
    "save-draft-error-summary": createElement(),
    "save-draft-title-error": createElement(),
    "save-draft-contact-email-error": createElement(),
    "save-draft-keywords-error": createElement(),
    "save-draft-title": createElement(),
    "save-draft-contact-email": createElement(),
    "save-draft-abstract": createElement(),
    "save-draft-keywords": createElement(),
    "save-draft-main-source": createElement()
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
    title: "Draft Paper Title",
    contact_email: "author@example.com",
    abstract: "Draft abstract.",
    keywords: "security,review",
    main_source: "latex"
  };
}

test("text/email helpers normalize and validate", () => {
  assert.equal(normalizeText("  a  "), "a");
  assert.equal(normalizeText(null), "");
  assert.equal(normalizeEmail("  USER@EXAMPLE.COM"), "user@example.com");
  assert.equal(isValidEmailFormat("bad"), false);
  assert.equal(isValidEmailFormat("ok@example.com"), true);
});

test("validation covers required, format, invalid keywords, and valid path", () => {
  const required = validateSaveDraftInput({});
  assert.equal(required.some((e) => e.code === "required"), true);

  const invalidEmail = validateSaveDraftInput({ ...validPayload(), contact_email: "invalid" });
  assert.equal(invalidEmail.some((e) => e.code === "invalid_format"), true);

  const invalidKeywords = validateSaveDraftInput({ ...validPayload(), keywords: "a, ,b" });
  assert.equal(invalidKeywords.some((e) => e.code === "invalid_keywords"), true);

  assert.deepEqual(validateSaveDraftInput(validPayload()), []);
});

test("adapter handles parse fallback and persistence", () => {
  const storage = new FakeStorage();
  const adapter = createSaveDraftStorageAdapter(storage);

  assert.deepEqual(adapter.loadDrafts(), []);
  storage.setItem("ece493.drafts", "{bad json");
  assert.deepEqual(adapter.loadDrafts(), []);
  storage.setItem("ece493.drafts", JSON.stringify({ nope: true }));
  assert.deepEqual(adapter.loadDrafts(), []);

  adapter.saveDrafts([{ id: "d1" }]);
  assert.equal(adapter.loadDrafts().length, 1);

  adapter.appendAudit({ status: "x" });
  assert.equal(JSON.parse(storage.getItem("ece493.audit")).length, 1);
});

test("adapter rejects invalid local storage interface", () => {
  assert.throws(() => createSaveDraftStorageAdapter(null), /LocalStorage-like/);
  assert.throws(() => createSaveDraftStorageAdapter({}), /LocalStorage-like/);
  assert.throws(() => createSaveDraftStorageAdapter({ getItem() {} }), /LocalStorage-like/);
});

test("generateId covers provider and fallback", () => {
  assert.equal(generateId(() => "x"), "x");
  assert.equal(generateId().startsWith("id_"), true);
});

test("saveSubmissionDraft requires adapter", () => {
  assert.throws(() => saveSubmissionDraft(validPayload()), /requires an adapter/);
});

test("saveSubmissionDraft handles validation failure and audit failure tolerance", () => {
  const adapter = {
    appendAudit() {
      throw new Error("audit failed");
    }
  };

  const result = saveSubmissionDraft({}, { adapter });
  assert.equal(result.status, "validation_failed");
});

test("saveSubmissionDraft handles load and save service failures", () => {
  const loadFail = saveSubmissionDraft(validPayload(), {
    adapter: {
      loadDrafts() {
        throw "db down";
      },
      appendAudit() {}
    }
  });
  assert.equal(loadFail.status, "service_unavailable");

  const loadFailError = saveSubmissionDraft(validPayload(), {
    adapter: {
      loadDrafts() {
        throw new Error("db down error");
      },
      appendAudit() {}
    }
  });
  assert.equal(loadFailError.status, "service_unavailable");

  const saveFail = saveSubmissionDraft(validPayload(), {
    adapter: {
      loadDrafts() {
        return [];
      },
      saveDrafts() {
        throw new Error("write broke");
      },
      appendAudit() {}
    }
  });
  assert.equal(saveFail.status, "service_unavailable");

  const saveFailString = saveSubmissionDraft(validPayload(), {
    adapter: {
      loadDrafts() {
        return [];
      },
      saveDrafts() {
        throw "write broke string";
      },
      appendAudit() {}
    }
  });
  assert.equal(saveFailString.status, "service_unavailable");
});

test("saveSubmissionDraft creates then updates same-owner draft idempotently", () => {
  const storage = new FakeStorage();
  const adapter = createSaveDraftStorageAdapter(storage);

  const first = saveSubmissionDraft(validPayload(), {
    adapter,
    idProvider: () => "draft-1",
    nowProvider: () => "2026-03-02T00:00:00.000Z"
  });
  assert.equal(first.status, "success");
  assert.equal(first.draft_id, "draft-1");

  const second = saveSubmissionDraft(
    {
      ...validPayload(),
      abstract: "updated abstract",
      keywords: "updated,keywords"
    },
    {
      adapter,
      idProvider: () => "draft-2",
      nowProvider: () => "2026-03-02T00:00:01.000Z"
    }
  );
  assert.equal(second.status, "success");
  assert.equal(second.draft_id, "draft-1");

  const drafts = adapter.loadDrafts();
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].abstract, "updated abstract");
});

test("saveSubmissionDraft appends second record for different owner", () => {
  const storage = new FakeStorage();
  const adapter = createSaveDraftStorageAdapter(storage);

  const first = saveSubmissionDraft(validPayload(), {
    adapter,
    idProvider: () => "draft-1"
  });
  assert.equal(first.status, "success");

  const second = saveSubmissionDraft(
    {
      ...validPayload(),
      contact_email: "other@example.com",
      title: "Other"
    },
    {
      adapter,
      idProvider: () => "draft-2"
    }
  );
  assert.equal(second.status, "success");

  assert.equal(adapter.loadDrafts().length, 2);
});

test("error rendering and clearing handles field and system errors", () => {
  const elements = {
    summary: createElement(),
    fieldErrors: {
      title: createElement(),
      contact_email: createElement(),
      keywords: createElement()
    }
  };

  clearSaveDraftErrorState(elements);
  assert.equal(elements.summary.hidden, true);

  renderSaveDraftErrorState(
    [
      buildValidationError("title", "required", "Draft title is required."),
      buildValidationError("system", "service_unavailable", "retry")
    ],
    elements
  );

  assert.equal(elements.summary.hidden, false);
  assert.equal(elements.fieldErrors.title.hidden, false);
  assert.equal(elements.fieldErrors.keywords.hidden, true);

  renderSaveDraftErrorState([], elements);
  assert.equal(elements.summary.hidden, true);
});

test("init app returns null when document or form missing", () => {
  assert.equal(initSaveSubmissionDraftApp({ document: null }), null);
  assert.equal(initSaveSubmissionDraftApp({ document: { getElementById: () => null } }), null);
});

test("init app supports global document/window fallback", () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;

  try {
    const doc = createDocumentMock();
    globalThis.document = doc;
    globalThis.window = { localStorage: new FakeStorage() };

    const app = initSaveSubmissionDraftApp();
    assert.ok(app);
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  }
});

test("init app throws when storage is unavailable and no adapter provided", () => {
  const doc = createDocumentMock();
  assert.throws(() => initSaveSubmissionDraftApp({ document: doc }), /LocalStorage-like/);
});

test("init app handles window without localStorage", () => {
  const previousWindow = globalThis.window;

  try {
    globalThis.window = {};
    const doc = createDocumentMock();
    assert.throws(() => initSaveSubmissionDraftApp({ document: doc }), /LocalStorage-like/);
  } finally {
    globalThis.window = previousWindow;
  }
});

test("init app supports explicit adapter branch", () => {
  const doc = createDocumentMock();
  const app = initSaveSubmissionDraftApp({
    document: doc,
    adapter: {
      loadDrafts() {
        return [];
      },
      saveDrafts() {},
      appendAudit() {}
    }
  });
  assert.ok(app);
});

test("submit handler covers success and failure paths", () => {
  const successStorage = new FakeStorage();
  const successDoc = createDocumentMock();

  const successApp = initSaveSubmissionDraftApp({ document: successDoc, storage: successStorage });
  assert.ok(successApp);

  successDoc.elements["save-draft-title"].value = "Draft";
  successDoc.elements["save-draft-contact-email"].value = "author@example.com";
  successDoc.elements["save-draft-abstract"].value = "abstract";
  successDoc.elements["save-draft-keywords"].value = "one,two";
  successDoc.elements["save-draft-main-source"].value = "latex";

  let prevented = false;
  let result = successDoc.form.listener({
    preventDefault() {
      prevented = true;
    }
  });

  assert.equal(prevented, true);
  assert.equal(result.status, "success");
  assert.equal(successDoc.elements["save-draft-form-container"].hidden, true);
  assert.equal(successDoc.elements["save-draft-success-container"].hidden, false);
  assert.equal(successDoc.form.resetCalls, 1);

  const failDoc = createDocumentMock();
  const failStorage = new FakeStorage();
  const failApp = initSaveSubmissionDraftApp({ document: failDoc, storage: failStorage });
  assert.ok(failApp);

  failDoc.elements["save-draft-title"].value = "";
  failDoc.elements["save-draft-contact-email"].value = "bad";
  result = failDoc.form.listener();
  assert.equal(result.status, "validation_failed");
  assert.equal(failDoc.elements["save-draft-error-summary"].hidden, false);
});

test("submit handler accepts event without preventDefault", () => {
  const doc = createDocumentMock();
  const app = initSaveSubmissionDraftApp({
    document: doc,
    adapter: {
      loadDrafts() {
        return [];
      },
      saveDrafts() {},
      appendAudit() {}
    }
  });
  assert.ok(app);

  doc.elements["save-draft-title"].value = "";
  doc.elements["save-draft-contact-email"].value = "";

  const result = doc.form.listener({});
  assert.equal(result.status, "validation_failed");
});

test("helper mocks cover untaken listener and missing element branches", () => {
  const form = createFormMock();
  form.addEventListener("click", () => {});
  assert.equal(form.listener, null);

  const doc = createDocumentMock();
  assert.equal(doc.getElementById("missing-id"), null);
});
