import test from "node:test";
import assert from "node:assert/strict";

import {
  buildValidationError,
  clearSubmitPaperErrorState,
  createSubmitPaperStorageAdapter,
  generateId,
  initSubmitPaperManuscriptApp,
  isAllowedManuscriptType,
  isValidEmailFormat,
  normalizeEmail,
  normalizeText,
  renderSubmitPaperErrorState,
  submitPaperManuscript,
  validateSubmitPaperInput
} from "../src/js/004-submit-paper-manuscript.js";

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
  return { value: initialValue, hidden: true, textContent: "", files: [] };
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
    "submit-paper-form": form,
    "submit-paper-form-container": createElement(),
    "submit-paper-success-container": createElement(),
    "submit-paper-success-message": createElement(),
    "submit-paper-error-summary": createElement(),
    "submit-paper-authors-error": createElement(),
    "submit-paper-affiliations-error": createElement(),
    "submit-paper-contact-email-error": createElement(),
    "submit-paper-abstract-error": createElement(),
    "submit-paper-keywords-error": createElement(),
    "submit-paper-main-source-error": createElement(),
    "submit-paper-file-error": createElement(),
    "submit-paper-authors": createElement(),
    "submit-paper-affiliations": createElement(),
    "submit-paper-contact-email": createElement(),
    "submit-paper-abstract": createElement(),
    "submit-paper-keywords": createElement(),
    "submit-paper-main-source": createElement(),
    "submit-paper-file": createElement()
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
    authors: "Nora Jones",
    affiliations: "University X",
    contact_email: "nora@example.com",
    abstract: "A concise abstract.",
    keywords: "security, review",
    main_source: "latex",
    file_name: "paper.tex",
    file_type: "text/x-tex",
    file_size_bytes: 1024
  };
}

test("text/email helpers normalize and validate input", () => {
  assert.equal(normalizeText("  hi  "), "hi");
  assert.equal(normalizeText(null), "");
  assert.equal(normalizeEmail("  USER@EXAMPLE.COM "), "user@example.com");
  assert.equal(isValidEmailFormat("bad-email"), false);
  assert.equal(isValidEmailFormat("ok@example.com"), true);
});

test("file type validator accepts extension and mime alternatives", () => {
  assert.equal(isAllowedManuscriptType("", "paper.pdf"), true);
  assert.equal(isAllowedManuscriptType("application/msword", "paper.unknown"), true);
  assert.equal(isAllowedManuscriptType("", "paper"), false);
  assert.equal(isAllowedManuscriptType("text/plain", "paper.txt"), false);
});

test("validation covers required, format, type, size, and valid branches", () => {
  const required = validateSubmitPaperInput({});
  assert.equal(required.some((e) => e.code === "required"), true);

  const invalidEmail = validateSubmitPaperInput({
    ...validPayload(),
    contact_email: "wrong"
  });
  assert.equal(invalidEmail.some((e) => e.code === "invalid_format"), true);

  const invalidType = validateSubmitPaperInput({
    ...validPayload(),
    file_name: "paper.txt",
    file_type: "text/plain"
  });
  assert.equal(invalidType.some((e) => e.code === "invalid_file_type"), true);

  const invalidSize = validateSubmitPaperInput({
    ...validPayload(),
    file_size_bytes: 0
  });
  assert.equal(invalidSize.some((e) => e.code === "invalid_file_size"), true);

  const nonNumericSize = validateSubmitPaperInput({
    ...validPayload(),
    file_size_bytes: "not-a-number"
  });
  assert.equal(nonNumericSize.some((e) => e.code === "invalid_file_size"), true);

  const tooLarge = validateSubmitPaperInput({
    ...validPayload(),
    file_size_bytes: 7 * 1024 * 1024 + 1
  });
  assert.equal(tooLarge.some((e) => e.code === "file_too_large"), true);

  const valid = validateSubmitPaperInput(validPayload());
  assert.deepEqual(valid, []);
});

test("adapter handles parse fallback and persistence", () => {
  const storage = new FakeStorage();
  const adapter = createSubmitPaperStorageAdapter(storage);

  assert.deepEqual(adapter.loadSubmissions(), []);
  storage.setItem("ece493.submissions", "{bad json");
  assert.deepEqual(adapter.loadSubmissions(), []);
  storage.setItem("ece493.submissions", JSON.stringify({ nope: true }));
  assert.deepEqual(adapter.loadSubmissions(), []);

  adapter.saveSubmissions([{ id: "s1" }]);
  assert.equal(adapter.loadSubmissions().length, 1);

  adapter.appendAudit({ status: "x" });
  assert.equal(JSON.parse(storage.getItem("ece493.audit")).length, 1);
});

test("adapter rejects invalid local storage interfaces", () => {
  assert.throws(() => createSubmitPaperStorageAdapter(null), /LocalStorage-like/);
  assert.throws(() => createSubmitPaperStorageAdapter({}), /LocalStorage-like/);
  assert.throws(() => createSubmitPaperStorageAdapter({ getItem() {} }), /LocalStorage-like/);
});

test("generateId covers provider and fallback", () => {
  assert.equal(generateId(() => "abc"), "abc");
  assert.equal(generateId().startsWith("id_"), true);
});

test("submitPaperManuscript requires adapter option", () => {
  assert.throws(() => submitPaperManuscript(validPayload()), /requires an adapter/);
});

test("submitPaperManuscript returns validation_failed and tolerates audit write failures", () => {
  const adapter = {
    appendAudit() {
      throw new Error("audit failed");
    }
  };

  const result = submitPaperManuscript({}, { adapter });
  assert.equal(result.status, "validation_failed");
});

test("submitPaperManuscript handles load failure and save failure branches", () => {
  const loadFailResult = submitPaperManuscript(validPayload(), {
    adapter: {
      loadSubmissions() {
        throw "load failed";
      },
      appendAudit() {}
    }
  });
  assert.equal(loadFailResult.status, "storage_failed");

  const loadFailErrorObject = submitPaperManuscript(validPayload(), {
    adapter: {
      loadSubmissions() {
        throw new Error("load failed with error object");
      },
      appendAudit() {}
    }
  });
  assert.equal(loadFailErrorObject.status, "storage_failed");

  const saveFailResult = submitPaperManuscript(validPayload(), {
    adapter: {
      loadSubmissions() {
        return [];
      },
      saveSubmissions() {
        throw new Error("save failed");
      },
      appendAudit() {}
    }
  });
  assert.equal(saveFailResult.status, "storage_failed");

  const saveFailString = submitPaperManuscript(validPayload(), {
    adapter: {
      loadSubmissions() {
        return [];
      },
      saveSubmissions() {
        throw "save failed string";
      },
      appendAudit() {}
    }
  });
  assert.equal(saveFailString.status, "storage_failed");
});

test("submitPaperManuscript succeeds and enforces idempotency for duplicate submission", () => {
  const storage = new FakeStorage();
  const adapter = createSubmitPaperStorageAdapter(storage);

  const first = submitPaperManuscript(validPayload(), {
    adapter,
    idProvider: () => "sub-1",
    nowProvider: () => "2026-03-02T00:00:00.000Z"
  });
  assert.equal(first.status, "success");
  assert.equal(first.submission_id, "sub-1");

  const second = submitPaperManuscript(validPayload(), {
    adapter,
    idProvider: () => "sub-2",
    nowProvider: () => "2026-03-02T00:00:01.000Z"
  });
  assert.equal(second.status, "success");
  assert.equal(second.submission_id, "sub-1");

  const submissions = adapter.loadSubmissions();
  assert.equal(submissions.length, 1);
});

test("error rendering and clearing handles mapped and unmapped fields", () => {
  const elements = {
    summary: createElement(),
    fieldErrors: {
      authors: createElement(),
      affiliations: createElement(),
      contact_email: createElement(),
      abstract: createElement(),
      keywords: createElement(),
      main_source: createElement(),
      manuscript_file: createElement()
    }
  };

  clearSubmitPaperErrorState(elements);
  assert.equal(elements.summary.hidden, true);

  renderSubmitPaperErrorState(
    [
      buildValidationError("authors", "required", "Authors are required."),
      buildValidationError("system", "storage_failure", "Storage failed.")
    ],
    elements
  );

  assert.equal(elements.summary.hidden, false);
  assert.equal(elements.fieldErrors.authors.hidden, false);
  assert.equal(elements.fieldErrors.abstract.hidden, true);

  renderSubmitPaperErrorState([], elements);
  assert.equal(elements.summary.hidden, true);
});

test("init app returns null when document or form is unavailable", () => {
  assert.equal(initSubmitPaperManuscriptApp({ document: null }), null);
  assert.equal(initSubmitPaperManuscriptApp({ document: { getElementById: () => null } }), null);
});

test("init app supports global document/window fallback", () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;

  try {
    const doc = createDocumentMock();
    globalThis.document = doc;
    globalThis.window = { localStorage: new FakeStorage() };

    const app = initSubmitPaperManuscriptApp();
    assert.ok(app);
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  }
});

test("init app throws when local storage is unavailable and no adapter provided", () => {
  const doc = createDocumentMock();
  assert.throws(() => initSubmitPaperManuscriptApp({ document: doc }), /LocalStorage-like/);
});

test("init app handles window without localStorage", () => {
  const previousWindow = globalThis.window;

  try {
    globalThis.window = {};
    const doc = createDocumentMock();
    assert.throws(() => initSubmitPaperManuscriptApp({ document: doc }), /LocalStorage-like/);
  } finally {
    globalThis.window = previousWindow;
  }
});

test("init app uses provided adapter branch when passed explicitly", () => {
  const doc = createDocumentMock();
  const adapter = {
    loadSubmissions() {
      return [];
    },
    saveSubmissions() {},
    appendAudit() {}
  };

  const app = initSubmitPaperManuscriptApp({ document: doc, adapter });
  assert.ok(app);
});

test("submit handler covers success and validation failure paths", () => {
  const successStorage = new FakeStorage();
  const successDoc = createDocumentMock();

  const successApp = initSubmitPaperManuscriptApp({ document: successDoc, storage: successStorage });
  assert.ok(successApp);

  successDoc.elements["submit-paper-authors"].value = "Nora Jones";
  successDoc.elements["submit-paper-affiliations"].value = "University X";
  successDoc.elements["submit-paper-contact-email"].value = "nora@example.com";
  successDoc.elements["submit-paper-abstract"].value = "A concise abstract";
  successDoc.elements["submit-paper-keywords"].value = "security, review";
  successDoc.elements["submit-paper-main-source"].value = "latex";
  successDoc.elements["submit-paper-file"].files = [{ name: "paper.tex", type: "text/x-tex", size: 42 }];

  let prevented = false;
  let result = successDoc.form.listener({
    preventDefault() {
      prevented = true;
    }
  });

  assert.equal(prevented, true);
  assert.equal(result.status, "success");
  assert.equal(successDoc.elements["submit-paper-form-container"].hidden, true);
  assert.equal(successDoc.elements["submit-paper-success-container"].hidden, false);
  assert.equal(successDoc.form.resetCalls, 1);

  const failStorage = new FakeStorage();
  const failDoc = createDocumentMock();
  const failApp = initSubmitPaperManuscriptApp({ document: failDoc, storage: failStorage });
  assert.ok(failApp);

  failDoc.elements["submit-paper-authors"].value = "Nora Jones";
  failDoc.elements["submit-paper-affiliations"].value = "University X";
  failDoc.elements["submit-paper-contact-email"].value = "nora@example.com";
  failDoc.elements["submit-paper-abstract"].value = "A concise abstract";
  failDoc.elements["submit-paper-keywords"].value = "security, review";
  failDoc.elements["submit-paper-main-source"].value = "latex";
  failDoc.elements["submit-paper-file"].value = "paper.txt";

  result = failDoc.form.listener();
  assert.equal(result.status, "validation_failed");
  assert.equal(failDoc.elements["submit-paper-error-summary"].hidden, false);
});

test("submit handler tolerates missing file input element and event without preventDefault", () => {
  const doc = createDocumentMock();
  delete doc.elements["submit-paper-file"];

  const app = initSubmitPaperManuscriptApp({
    document: doc,
    adapter: {
      loadSubmissions() {
        return [];
      },
      saveSubmissions() {},
      appendAudit() {}
    }
  });
  assert.ok(app);

  doc.elements["submit-paper-authors"].value = "Nora Jones";
  doc.elements["submit-paper-affiliations"].value = "University X";
  doc.elements["submit-paper-contact-email"].value = "nora@example.com";
  doc.elements["submit-paper-abstract"].value = "A concise abstract";
  doc.elements["submit-paper-keywords"].value = "security, review";
  doc.elements["submit-paper-main-source"].value = "latex";

  const result = doc.form.listener({});
  assert.equal(result.status, "validation_failed");
});

test("helper mocks cover untaken listener and getElementById branches", () => {
  const form = createFormMock();
  form.addEventListener("click", () => {});
  assert.equal(form.listener, null);

  const doc = createDocumentMock();
  assert.equal(doc.getElementById("does-not-exist"), null);
});
