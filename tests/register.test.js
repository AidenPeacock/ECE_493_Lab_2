import test from "node:test";
import assert from "node:assert/strict";

import {
  buildValidationError,
  clearErrorState,
  createLocalStorageAdapter,
  generateId,
  initRegistrationApp,
  isStrongPassword,
  isValidEmailFormat,
  normalizeEmail,
  registerUserAccount,
  renderErrorState,
  validateRegistrationInput
} from "../src/js/register.js";

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
  return {
    value: initialValue,
    hidden: true,
    textContent: ""
  };
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
    "register-form": form,
    "form-container": createElement(),
    "success-container": createElement(),
    "success-message": createElement(),
    "error-summary": createElement(),
    "email-error": createElement(),
    "password-error": createElement(),
    "role-error": createElement(),
    email: createElement(),
    password: createElement(),
    role: createElement()
  };

  return {
    form,
    elements,
    getElementById(id) {
      return Object.prototype.hasOwnProperty.call(elements, id) ? elements[id] : null;
    }
  };
}

test("normalizeEmail and email format checks cover valid and invalid paths", () => {
  assert.equal(normalizeEmail("  Test@Email.com  "), "test@email.com");
  assert.equal(normalizeEmail(null), "");
  assert.equal(isValidEmailFormat("bad-email"), false);
  assert.equal(isValidEmailFormat("ok@example.com"), true);
});

test("password strength checks enforce length, letter, and number", () => {
  assert.equal(isStrongPassword(null), false);
  assert.equal(isStrongPassword("short1"), false);
  assert.equal(isStrongPassword("abcdefgh"), false);
  assert.equal(isStrongPassword("12345678"), false);
  assert.equal(isStrongPassword("abc12345"), true);
});

test("validation returns required, format, duplicate, weak, and role errors", () => {
  const requiredErrors = validateRegistrationInput({ email: "", password: "", role: "" }, []);
  assert.equal(requiredErrors.length, 3);

  const invalidErrors = validateRegistrationInput(
    { email: "wrong", password: "abc", role: "invalid" },
    [{ email: "taken@example.com" }]
  );
  assert.equal(invalidErrors.some((error) => error.code === "invalid_format"), true);
  assert.equal(invalidErrors.some((error) => error.code === "weak_password"), true);
  assert.equal(invalidErrors.some((error) => error.code === "invalid_role"), true);

  const duplicateErrors = validateRegistrationInput(
    { email: "taken@example.com", password: "abc12345", role: "author" },
    [{ email: "taken@example.com" }]
  );
  assert.equal(duplicateErrors.some((error) => error.code === "already_registered"), true);

  const nullInputErrors = validateRegistrationInput({ email: null, password: null, role: null }, []);
  assert.equal(nullInputErrors.length, 3);

  const noErrors = validateRegistrationInput(
    { email: "fresh@example.com", password: "abc12345", role: "reviewer" },
    [{ email: "taken@example.com" }]
  );
  assert.deepEqual(noErrors, []);
});

test("createLocalStorageAdapter handles parse fallbacks and append", () => {
  const storage = new FakeStorage();
  const adapter = createLocalStorageAdapter(storage);

  assert.deepEqual(adapter.loadUsers(), []);
  storage.setItem("ece493.users", "{not-json");
  assert.deepEqual(adapter.loadUsers(), []);
  storage.setItem("ece493.users", JSON.stringify({ nope: true }));
  assert.deepEqual(adapter.loadUsers(), []);

  adapter.saveUsers([{ id: "1" }]);
  assert.deepEqual(adapter.loadUsers(), [{ id: "1" }]);

  adapter.appendAudit({ status: "x" });
  assert.equal(adapter.loadAudit().length, 1);
});

test("createLocalStorageAdapter rejects invalid storage object", () => {
  assert.throws(() => createLocalStorageAdapter(null), /LocalStorage-like/);
  assert.throws(() => createLocalStorageAdapter({}), /LocalStorage-like/);
  assert.throws(() => createLocalStorageAdapter({ getItem() {} }), /LocalStorage-like/);
});

test("generateId covers provided random UUID and fallback", () => {
  assert.equal(generateId(() => "uuid-123"), "uuid-123");
  assert.equal(generateId().startsWith("id_"), true);
});

test("registerUserAccount succeeds and persists account", () => {
  const storage = new FakeStorage();
  const adapter = createLocalStorageAdapter(storage);

  const result = registerUserAccount(
    { email: "new@example.com", password: "abc12345", role: "author" },
    { adapter, nowProvider: () => "2026-03-02T00:00:00.000Z", idProvider: () => "u1" }
  );

  assert.equal(result.status, "success");
  assert.equal(result.user_id, "u1");

  const users = adapter.loadUsers();
  assert.equal(users.length, 1);
  assert.equal(users[0].email, "new@example.com");
  assert.equal(adapter.loadAudit().length, 1);
});

test("registerUserAccount returns validation_failed and tolerates audit write failure", () => {
  const adapter = {
    loadUsers: () => [],
    appendAudit: () => {
      throw new Error("audit write failed");
    }
  };

  const result = registerUserAccount(
    { email: "", password: "", role: "" },
    { adapter, nowProvider: () => "2026-03-02T00:00:00.000Z" }
  );

  assert.equal(result.status, "validation_failed");
  assert.equal(result.errors.length, 3);
});

test("registerUserAccount covers null role fallback branch in audit payload", () => {
  const adapter = {
    loadUsers() {
      return [];
    },
    appendAudit() {}
  };

  const result = registerUserAccount(
    { email: "branch@example.com", password: "abc12345", role: null },
    { adapter, nowProvider: () => "2026-03-02T00:00:00.000Z" }
  );

  assert.equal(result.status, "validation_failed");
});

test("registerUserAccount handles storage failure and returns storage_failed", () => {
  const storage = new FakeStorage();
  const adapter = createLocalStorageAdapter(storage);

  storage.failWrites = true;
  const result = registerUserAccount(
    { email: "fail@example.com", password: "abc12345", role: "author" },
    { adapter, nowProvider: () => "2026-03-02T00:00:00.000Z" }
  );

  assert.equal(result.status, "storage_failed");
  assert.equal(result.errors[0].code, "storage_failure");
});

test("registerUserAccount covers default providers and storage failure audit success path", () => {
  const audit = [];
  const adapter = {
    loadUsers() {
      return [];
    },
    saveUsers() {
      throw "raw error";
    },
    appendAudit(entry) {
      audit.push(entry);
    }
  };

  const result = registerUserAccount({ email: "x@y.com", password: "abc12345", role: "editor" }, { adapter });
  assert.equal(result.status, "storage_failed");
  assert.equal(audit.length, 1);
  assert.equal(audit[0].status, "storage_failed");
  assert.equal(audit[0].error, "raw error");
});

test("registerUserAccount handles success-path append audit throw by returning storage_failed", () => {
  const adapter = {
    appendCount: 0,
    loadUsers() {
      return [];
    },
    saveUsers() {},
    appendAudit() {
      this.appendCount += 1;
      if (this.appendCount === 1) {
        throw new Error("first audit write failed");
      }
    }
  };

  const result = registerUserAccount(
    { email: "append-fail@example.com", password: "abc12345", role: "author" },
    { adapter, nowProvider: () => "2026-03-02T00:00:00.000Z", idProvider: () => "u-append" }
  );
  assert.equal(result.status, "storage_failed");
});

test("registerUserAccount requires adapter option", () => {
  assert.throws(
    () => registerUserAccount({ email: "a@b.com", password: "abc12345", role: "author" }),
    /requires an adapter/
  );
});

test("error state rendering and clearing handles empty and populated errors", () => {
  const elements = {
    summary: createElement(),
    fieldErrors: {
      email: createElement(),
      password: createElement(),
      role: createElement()
    }
  };

  clearErrorState(elements);
  assert.equal(elements.summary.hidden, true);

  const errors = [
    buildValidationError("email", "invalid_format", "bad email"),
    buildValidationError("system", "storage_failure", "try again")
  ];

  renderErrorState(errors, elements);
  assert.equal(elements.summary.hidden, false);
  assert.equal(elements.fieldErrors.email.hidden, false);
  assert.equal(elements.fieldErrors.password.hidden, true);

  renderErrorState([], elements);
  assert.equal(elements.summary.hidden, true);
});

test("initRegistrationApp returns null when document or form is unavailable", () => {
  assert.equal(initRegistrationApp({ document: null }), null);
  assert.equal(initRegistrationApp({ document: { getElementById: () => null } }), null);
});

test("helper mock branches are exercised for complete branch coverage", () => {
  const form = createFormMock();
  form.addEventListener("click", () => {});
  assert.equal(form.listener, null);

  const doc = createDocumentMock();
  assert.equal(doc.getElementById("does-not-exist"), null);
});

test("initRegistrationApp throws when storage is unavailable and no adapter is provided", () => {
  const doc = createDocumentMock();
  assert.throws(() => initRegistrationApp({ document: doc }), /LocalStorage-like/);
});

test("initRegistrationApp supports provided adapter and submit without event object", () => {
  const doc = createDocumentMock();
  const adapter = {
    loadUsers() {
      return [];
    },
    saveUsers() {},
    appendAudit() {}
  };

  const app = initRegistrationApp({ document: doc, adapter });
  assert.ok(app);
  doc.elements.email.value = "plain@example.com";
  doc.elements.password.value = "abc12345";
  doc.elements.role.value = "attendee";

  const result = doc.form.listener();
  assert.equal(result.status, "success");
});

test("initRegistrationApp can use global document/window fallbacks", () => {
  const priorWindow = globalThis.window;
  const priorDocument = globalThis.document;

  try {
    const doc = createDocumentMock();
    const storage = new FakeStorage();
    globalThis.document = doc;
    globalThis.window = { localStorage: storage };

    const app = initRegistrationApp();
    assert.ok(app);
  } finally {
    globalThis.window = priorWindow;
    globalThis.document = priorDocument;
  }
});

test("initRegistrationApp submit flow covers success, validation failure, and storage failure", () => {
  const documentMock = createDocumentMock();
  const storage = new FakeStorage();

  const app = initRegistrationApp({ document: documentMock, storage });
  assert.ok(app);
  assert.equal(typeof documentMock.form.listener, "function");

  documentMock.elements.email.value = "new@example.com";
  documentMock.elements.password.value = "abc12345";
  documentMock.elements.role.value = "author";

  let prevented = false;
  let result = documentMock.form.listener({
    preventDefault() {
      prevented = true;
    }
  });

  assert.equal(prevented, true);
  assert.equal(result.status, "success");
  assert.equal(documentMock.elements["form-container"].hidden, true);
  assert.equal(documentMock.elements["success-container"].hidden, false);
  assert.equal(documentMock.form.resetCalls, 1);

  const secondDocumentMock = createDocumentMock();
  const secondStorage = new FakeStorage();
  const secondApp = initRegistrationApp({ document: secondDocumentMock, storage: secondStorage });
  assert.ok(secondApp);

  secondDocumentMock.elements.email.value = "bad-email";
  secondDocumentMock.elements.password.value = "123";
  secondDocumentMock.elements.role.value = "";

  result = secondDocumentMock.form.listener({ preventDefault() {} });
  assert.equal(result.status, "validation_failed");
  assert.equal(secondDocumentMock.form.resetCalls, 0);
  assert.equal(secondDocumentMock.elements["error-summary"].hidden, false);

  const thirdDocumentMock = createDocumentMock();
  const thirdStorage = new FakeStorage();
  const thirdApp = initRegistrationApp({ document: thirdDocumentMock, storage: thirdStorage });
  assert.ok(thirdApp);

  thirdStorage.failWrites = true;
  thirdDocumentMock.elements.email.value = "ok@example.com";
  thirdDocumentMock.elements.password.value = "abc12345";
  thirdDocumentMock.elements.role.value = "author";

  result = thirdDocumentMock.form.listener({ preventDefault() {} });
  assert.equal(result.status, "storage_failed");
  assert.equal(thirdDocumentMock.form.resetCalls, 1);
});
