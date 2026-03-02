import test from "node:test";
import assert from "node:assert/strict";

import {
  authenticateUser,
  buildValidationError,
  clearLoginErrorState,
  createLoginStorageAdapter,
  emitSessionChanged,
  generateId,
  initLoginApp,
  isValidEmailFormat,
  loginUser,
  normalizeEmail,
  renderLoginErrorState,
  validateLoginInput
} from "../src/js/002-log-in.js";

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
    "login-form": form,
    "login-form-container": createElement(),
    "login-success-container": createElement(),
    "login-success-message": createElement(),
    "login-error-summary": createElement(),
    "login-email-error": createElement(),
    "login-password-error": createElement(),
    "login-email": createElement(),
    "login-password": createElement()
  };

  return {
    form,
    elements,
    getElementById(id) {
      return Object.prototype.hasOwnProperty.call(elements, id) ? elements[id] : null;
    }
  };
}

test("email helper utilities cover normalization and validation", () => {
  assert.equal(normalizeEmail("  USER@EXAMPLE.COM  "), "user@example.com");
  assert.equal(normalizeEmail(null), "");
  assert.equal(isValidEmailFormat("not-an-email"), false);
  assert.equal(isValidEmailFormat("ok@example.com"), true);
});

test("adapter handles default state, invalid JSON, and append", () => {
  const storage = new FakeStorage();
  const adapter = createLoginStorageAdapter(storage);

  assert.deepEqual(adapter.loadUsers(), []);
  storage.setItem("ece493.users", "{bad json");
  assert.deepEqual(adapter.loadUsers(), []);
  storage.setItem("ece493.users", JSON.stringify({ not: "an-array" }));
  assert.deepEqual(adapter.loadUsers(), []);

  adapter.appendAudit({ status: "x" });
  assert.equal(JSON.parse(storage.getItem("ece493.audit")).length, 1);

  adapter.saveSession({ id: "s1" });
  assert.equal(JSON.parse(storage.getItem("ece493.session")).id, "s1");

  adapter.clearSession();
  assert.equal(storage.getItem("ece493.session"), "");
});

test("adapter rejects missing local storage interface", () => {
  assert.throws(() => createLoginStorageAdapter(null), /LocalStorage-like/);
  assert.throws(() => createLoginStorageAdapter({}), /LocalStorage-like/);
  assert.throws(() => createLoginStorageAdapter({ getItem() {} }), /LocalStorage-like/);
});

test("validation covers required and invalid format branches", () => {
  const requiredErrors = validateLoginInput({ email: "", password: "" });
  assert.equal(requiredErrors.length, 2);

  const invalidErrors = validateLoginInput({ email: "bad", password: "x" });
  assert.equal(invalidErrors.some((error) => error.code === "invalid_format"), true);

  const nullErrors = validateLoginInput({ email: null, password: null });
  assert.equal(nullErrors.length, 2);

  assert.deepEqual(validateLoginInput({ email: "ok@example.com", password: "secret" }), []);
});

test("authenticateUser handles missing account, wrong password, and success", () => {
  const users = [{ email: "a@example.com", password: "p1", role: "author" }];
  assert.equal(authenticateUser({ email: "x@example.com", password: "p1" }, users), null);
  assert.equal(authenticateUser({ email: "a@example.com", password: "wrong" }, users), null);
  assert.equal(authenticateUser({ email: "a@example.com", password: "p1" }, users).role, "author");
  assert.equal(authenticateUser({ email: null, password: null }, users), null);
});

test("generateId uses provider and fallback", () => {
  assert.equal(generateId(() => "id-1"), "id-1");
  assert.equal(generateId().startsWith("id_"), true);
});

test("loginUser requires adapter", () => {
  assert.throws(() => loginUser({ email: "a@b.com", password: "x" }), /requires an adapter/);
});

test("loginUser returns service unavailable when users cannot be loaded", () => {
  const adapter = {
    loadUsers() {
      throw "db offline";
    },
    appendAudit() {}
  };

  const result = loginUser({ email: "a@b.com", password: "x" }, { adapter });
  assert.equal(result.status, "service_unavailable");
  assert.equal(result.errors[0].code, "service_unavailable");
});

test("loginUser handles validation failure and audit write failure", () => {
  const adapter = {
    loadUsers() {
      return [];
    },
    appendAudit() {
      throw new Error("audit broke");
    }
  };

  const result = loginUser({ email: "", password: "" }, { adapter });
  assert.equal(result.status, "validation_failed");
  assert.equal(result.errors.length, 2);
});

test("loginUser returns generic invalid credentials for user-not-found and mismatch", () => {
  const adapter = {
    loadUsers() {
      return [{ email: "a@example.com", password: "right", role: "editor" }];
    },
    appendAudit() {}
  };

  const notFound = loginUser({ email: "none@example.com", password: "x" }, { adapter });
  assert.equal(notFound.status, "invalid_credentials");

  const mismatch = loginUser({ email: "a@example.com", password: "bad" }, { adapter });
  assert.equal(mismatch.status, "invalid_credentials");
});

test("loginUser succeeds and writes session, including role fallback", () => {
  const storage = new FakeStorage();
  storage.setItem(
    "ece493.users",
    JSON.stringify([{ email: "a@example.com", password: "p1", role: "reviewer" }])
  );

  const adapter = createLoginStorageAdapter(storage);
  const result = loginUser(
    { email: "a@example.com", password: "p1" },
    { adapter, idProvider: () => "s1", nowProvider: () => "2026-03-02T00:00:00.000Z" }
  );

  assert.equal(result.status, "success");
  assert.equal(result.home_view, "reviewer-home");
  assert.equal(JSON.parse(storage.getItem("ece493.session")).id, "s1");

  const noRoleAdapter = {
    loadUsers() {
      return [{ email: "b@example.com", password: "p2" }];
    },
    saveSession() {},
    appendAudit() {}
  };
  const noRoleResult = loginUser({ email: "b@example.com", password: "p2" }, { adapter: noRoleAdapter });
  assert.equal(noRoleResult.home_view, "attendee-home");
});

test("loginUser handles service unavailable when saving session fails", () => {
  const adapter = {
    loadUsers() {
      return [{ email: "a@example.com", password: "p1", role: "author" }];
    },
    saveSession() {
      throw new Error("write failed");
    },
    appendAudit() {}
  };

  const result = loginUser({ email: "a@example.com", password: "p1" }, { adapter });
  assert.equal(result.status, "service_unavailable");

  const stringThrowAdapter = {
    loadUsers() {
      return [{ email: "b@example.com", password: "p2", role: "author" }];
    },
    saveSession() {
      throw "service down";
    },
    appendAudit() {}
  };
  const stringThrowResult = loginUser({ email: "b@example.com", password: "p2" }, { adapter: stringThrowAdapter });
  assert.equal(stringThrowResult.status, "service_unavailable");
});

test("error rendering and clearing covers generic and field-specific behavior", () => {
  const elements = {
    summary: createElement(),
    fieldErrors: {
      email: createElement(),
      password: createElement()
    }
  };

  clearLoginErrorState(elements);
  assert.equal(elements.summary.hidden, true);

  const errors = [
    buildValidationError("email", "invalid_format", "bad email"),
    buildValidationError("system", "invalid_credentials", "Invalid credentials.")
  ];

  renderLoginErrorState(errors, elements);
  assert.equal(elements.summary.hidden, false);
  assert.equal(elements.fieldErrors.email.hidden, false);
  assert.equal(elements.fieldErrors.password.hidden, true);

  renderLoginErrorState([], elements);
  assert.equal(elements.summary.hidden, true);
});

test("initLoginApp returns null when document or form is missing", () => {
  assert.equal(initLoginApp({ document: null }), null);
  assert.equal(initLoginApp({ document: { getElementById: () => null } }), null);
});

test("initLoginApp supports global document/window fallback", () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;

  try {
    const doc = createDocumentMock();
    globalThis.document = doc;
    globalThis.window = { localStorage: new FakeStorage() };

    const app = initLoginApp();
    assert.ok(app);
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  }
});

test("initLoginApp throws when local storage is unavailable and no adapter provided", () => {
  const doc = createDocumentMock();
  assert.throws(() => initLoginApp({ document: doc }), /LocalStorage-like/);
});

test("initLoginApp submit flow covers success, failures, reset, and clear-session", () => {
  const storage = new FakeStorage();
  storage.setItem(
    "ece493.users",
    JSON.stringify([{ email: "u@example.com", password: "secret", role: "editor" }])
  );

  const doc = createDocumentMock();
  const app = initLoginApp({ document: doc, storage });
  assert.ok(app);

  doc.elements["login-email"].value = "u@example.com";
  doc.elements["login-password"].value = "secret";

  let prevented = false;
  let result = doc.form.listener({
    preventDefault() {
      prevented = true;
    }
  });

  assert.equal(prevented, true);
  assert.equal(result.status, "success");
  assert.equal(doc.elements["login-form-container"].hidden, true);
  assert.equal(doc.elements["login-success-container"].hidden, false);
  assert.equal(doc.form.resetCalls, 1);

  const failDoc = createDocumentMock();
  const failStorage = new FakeStorage();
  failStorage.setItem(
    "ece493.users",
    JSON.stringify([{ email: "u@example.com", password: "secret", role: "editor" }])
  );
  const failApp = initLoginApp({ document: failDoc, storage: failStorage });
  assert.ok(failApp);

  failDoc.elements["login-email"].value = "u@example.com";
  failDoc.elements["login-password"].value = "wrong";
  result = failDoc.form.listener();
  assert.equal(result.status, "invalid_credentials");
  assert.equal(failDoc.form.resetCalls, 1);
  assert.equal(failDoc.elements["login-error-summary"].hidden, false);
  assert.equal(failStorage.getItem("ece493.session"), "");
});

test("helper mocks cover untaken utility branches", () => {
  const form = createFormMock();
  form.addEventListener("click", () => {});
  assert.equal(form.listener, null);

  const doc = createDocumentMock();
  assert.equal(doc.getElementById("does-not-exist"), null);
});

test("fake storage write-failure branch is covered", () => {
  const storage = new FakeStorage();
  storage.failWrites = true;
  assert.throws(() => storage.setItem("x", "y"), /write failed/);
});

test("emitSessionChanged covers missing, successful, and throwing event targets", () => {
  emitSessionChanged(null);
  emitSessionChanged({});

  let dispatched = false;
  emitSessionChanged({
    dispatchEvent(event) {
      dispatched = event.type === "ece493:session-changed";
    }
  });
  assert.equal(dispatched, true);

  emitSessionChanged({
    dispatchEvent() {
      throw new Error("dispatch failed");
    }
  });
});
