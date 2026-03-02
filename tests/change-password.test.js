import test from "node:test";
import assert from "node:assert/strict";

import {
  buildValidationError,
  changePassword,
  clearChangePasswordErrorState,
  createChangePasswordStorageAdapter,
  initChangePasswordApp,
  isStrongPassword,
  normalizeEmail,
  renderChangePasswordErrorState,
  validateChangePasswordInput
} from "../src/js/003-change-password.js";

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
    "change-password-form": form,
    "change-password-form-container": createElement(),
    "change-password-success-container": createElement(),
    "change-password-success-message": createElement(),
    "change-password-error-summary": createElement(),
    "current-password-error": createElement(),
    "new-password-error": createElement(),
    "current-password": createElement(),
    "new-password": createElement()
  };

  return {
    form,
    elements,
    getElementById(id) {
      return Object.prototype.hasOwnProperty.call(elements, id) ? elements[id] : null;
    }
  };
}

test("normalizeEmail and strong password helpers cover positive and fallback branches", () => {
  assert.equal(normalizeEmail("  USER@EXAMPLE.COM  "), "user@example.com");
  assert.equal(normalizeEmail(null), "");
  assert.equal(isStrongPassword(null), false);
  assert.equal(isStrongPassword("abc12345"), true);
});

test("adapter handles parse fallbacks, load session variants, save and append", () => {
  const storage = new FakeStorage();
  const adapter = createChangePasswordStorageAdapter(storage);

  assert.deepEqual(adapter.loadUsers(), []);
  storage.setItem("ece493.users", "{bad json");
  assert.deepEqual(adapter.loadUsers(), []);
  storage.setItem("ece493.users", JSON.stringify({ no: "array" }));
  assert.deepEqual(adapter.loadUsers(), []);

  assert.equal(adapter.loadSession(), null);
  storage.setItem("ece493.session", "not-json");
  assert.equal(adapter.loadSession(), null);
  storage.setItem("ece493.session", JSON.stringify("string"));
  assert.equal(adapter.loadSession(), null);

  adapter.saveUsers([{ email: "a@example.com" }]);
  assert.equal(adapter.loadUsers().length, 1);

  adapter.appendAudit({ status: "x" });
  assert.equal(JSON.parse(storage.getItem("ece493.audit")).length, 1);
});

test("adapter rejects invalid storage object", () => {
  assert.throws(() => createChangePasswordStorageAdapter(null), /LocalStorage-like/);
  assert.throws(() => createChangePasswordStorageAdapter({}), /LocalStorage-like/);
  assert.throws(() => createChangePasswordStorageAdapter({ getItem() {} }), /LocalStorage-like/);
});

test("validation covers required, weak password, same-as-current, and valid path", () => {
  const required = validateChangePasswordInput({ current_password: "", new_password: "" });
  assert.equal(required.length, 2);

  const weak = validateChangePasswordInput({ current_password: "abc12345", new_password: "short" });
  assert.equal(weak.some((e) => e.code === "weak_password"), true);

  const same = validateChangePasswordInput({ current_password: "abc12345", new_password: "abc12345" });
  assert.equal(same.some((e) => e.code === "same_as_current"), true);

  const nullish = validateChangePasswordInput({ current_password: null, new_password: null });
  assert.equal(nullish.length, 2);

  assert.deepEqual(
    validateChangePasswordInput({ current_password: "old12345", new_password: "new12345" }),
    []
  );
});

test("changePassword requires adapter option", () => {
  assert.throws(() => changePassword({ current_password: "x", new_password: "y" }), /requires an adapter/);
});

test("changePassword returns update_failed when load throws", () => {
  const adapter = {
    loadUsers() {
      throw "db down";
    },
    loadSession() {
      return null;
    },
    appendAudit() {}
  };

  const result = changePassword({ current_password: "old12345", new_password: "new12345" }, { adapter });
  assert.equal(result.status, "update_failed");
});

test("changePassword returns validation_failed when user is not authenticated", () => {
  const adapter = {
    loadUsers() {
      return [];
    },
    loadSession() {
      return null;
    },
    appendAudit() {
      throw new Error("audit failed");
    }
  };

  const result = changePassword({ current_password: "old12345", new_password: "new12345" }, { adapter });
  assert.equal(result.status, "validation_failed");
  assert.equal(result.errors[0].code, "not_authenticated");
});

test("changePassword returns validation errors for user not found and incorrect current password", () => {
  const userNotFoundAdapter = {
    loadUsers() {
      return [{ email: "x@example.com", password: "abc12345" }];
    },
    loadSession() {
      return { email: "none@example.com" };
    },
    appendAudit() {}
  };

  const notFoundResult = changePassword(
    { current_password: "abc12345", new_password: "new12345" },
    { adapter: userNotFoundAdapter }
  );
  assert.equal(notFoundResult.status, "validation_failed");
  assert.equal(notFoundResult.errors.some((e) => e.code === "incorrect_current"), true);

  const wrongCurrentAdapter = {
    loadUsers() {
      return [{ email: "a@example.com", password: "right123" }];
    },
    loadSession() {
      return { email: "a@example.com" };
    },
    appendAudit() {}
  };

  const wrongCurrentResult = changePassword(
    { current_password: "wrong123", new_password: "new12345" },
    { adapter: wrongCurrentAdapter }
  );
  assert.equal(wrongCurrentResult.status, "validation_failed");
  assert.equal(wrongCurrentResult.errors.some((e) => e.code === "incorrect_current"), true);

  const nullInputAdapter = {
    loadUsers() {
      return [{ email: "a@example.com", password: "right123" }];
    },
    loadSession() {
      return { email: "a@example.com" };
    },
    appendAudit() {}
  };
  const nullInputResult = changePassword(null, { adapter: nullInputAdapter });
  assert.equal(nullInputResult.status, "validation_failed");
});

test("changePassword succeeds and updates stored password", () => {
  const storage = new FakeStorage();
  storage.setItem(
    "ece493.users",
    JSON.stringify([{ email: "u@example.com", password: "old12345", role: "editor" }])
  );
  storage.setItem("ece493.session", JSON.stringify({ email: "u@example.com", role: "editor" }));

  const adapter = createChangePasswordStorageAdapter(storage);
  const result = changePassword(
    { current_password: "old12345", new_password: "new12345" },
    { adapter, nowProvider: () => "2026-03-02T00:00:00.000Z" }
  );

  assert.equal(result.status, "success");
  const users = JSON.parse(storage.getItem("ece493.users"));
  assert.equal(users[0].password, "new12345");
});

test("changePassword returns update_failed when save fails and leaves password unchanged", () => {
  const sourceUsers = [{ email: "u@example.com", password: "old12345", role: "author" }];
  const adapter = {
    savedUsers: null,
    loadUsers() {
      return sourceUsers;
    },
    loadSession() {
      return { email: "u@example.com" };
    },
    saveUsers() {
      throw new Error("save failed");
    },
    appendAudit() {}
  };

  const result = changePassword(
    { current_password: "old12345", new_password: "new12345" },
    { adapter }
  );

  assert.equal(result.status, "update_failed");
  assert.equal(sourceUsers[0].password, "old12345");

  const stringThrowUsers = [
    { email: "u@example.com", password: "old12345", role: "author" },
    { email: "z@example.com", password: "zpass123", role: "editor" }
  ];
  const stringThrowAdapter = {
    loadUsers() {
      return stringThrowUsers;
    },
    loadSession() {
      return { email: "u@example.com" };
    },
    saveUsers() {
      throw "save broke";
    },
    appendAudit() {}
  };
  const stringThrowResult = changePassword(
    { current_password: "old12345", new_password: "new12345" },
    { adapter: stringThrowAdapter }
  );
  assert.equal(stringThrowResult.status, "update_failed");
  assert.equal(stringThrowUsers[1].password, "zpass123");
});

test("error state rendering and clearing cover summary and field mapping", () => {
  const elements = {
    summary: createElement(),
    fieldErrors: {
      current_password: createElement(),
      new_password: createElement()
    }
  };

  clearChangePasswordErrorState(elements);
  assert.equal(elements.summary.hidden, true);

  const errors = [
    buildValidationError("current_password", "incorrect_current", "incorrect"),
    buildValidationError("system", "update_failed", "update failed")
  ];

  renderChangePasswordErrorState(errors, elements);
  assert.equal(elements.summary.hidden, false);
  assert.equal(elements.fieldErrors.current_password.hidden, false);
  assert.equal(elements.fieldErrors.new_password.hidden, true);

  renderChangePasswordErrorState([], elements);
  assert.equal(elements.summary.hidden, true);
});

test("initChangePasswordApp returns null when document or form is missing", () => {
  assert.equal(initChangePasswordApp({ document: null }), null);
  assert.equal(initChangePasswordApp({ document: { getElementById: () => null } }), null);
});

test("initChangePasswordApp supports global document/window fallback", () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;

  try {
    const doc = createDocumentMock();
    globalThis.document = doc;
    globalThis.window = { localStorage: new FakeStorage() };

    const app = initChangePasswordApp();
    assert.ok(app);
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  }
});

test("initChangePasswordApp throws when no storage and no adapter", () => {
  const doc = createDocumentMock();
  assert.throws(() => initChangePasswordApp({ document: doc }), /LocalStorage-like/);
});

test("initChangePasswordApp submit flow covers success and failure paths", () => {
  const successStorage = new FakeStorage();
  successStorage.setItem(
    "ece493.users",
    JSON.stringify([{ email: "u@example.com", password: "old12345", role: "reviewer" }])
  );
  successStorage.setItem("ece493.session", JSON.stringify({ email: "u@example.com" }));

  const successDoc = createDocumentMock();
  const successApp = initChangePasswordApp({ document: successDoc, storage: successStorage });
  assert.ok(successApp);

  successDoc.elements["current-password"].value = "old12345";
  successDoc.elements["new-password"].value = "new12345";

  let prevented = false;
  let result = successDoc.form.listener({
    preventDefault() {
      prevented = true;
    }
  });

  assert.equal(prevented, true);
  assert.equal(result.status, "success");
  assert.equal(successDoc.elements["change-password-form-container"].hidden, true);
  assert.equal(successDoc.elements["change-password-success-container"].hidden, false);
  assert.equal(successDoc.form.resetCalls, 1);

  const failDoc = createDocumentMock();
  const failStorage = new FakeStorage();
  failStorage.setItem(
    "ece493.users",
    JSON.stringify([{ email: "u@example.com", password: "old12345", role: "reviewer" }])
  );
  failStorage.setItem("ece493.session", JSON.stringify({ email: "u@example.com" }));

  const failApp = initChangePasswordApp({ document: failDoc, storage: failStorage });
  assert.ok(failApp);

  failDoc.elements["current-password"].value = "wrong123";
  failDoc.elements["new-password"].value = "new12345";
  result = failDoc.form.listener();
  assert.equal(result.status, "validation_failed");
  assert.equal(failDoc.form.resetCalls, 1);
  assert.equal(failDoc.elements["change-password-error-summary"].hidden, false);
});

test("helper mocks cover remaining branches", () => {
  const form = createFormMock();
  form.addEventListener("click", () => {});
  assert.equal(form.listener, null);

  const doc = createDocumentMock();
  assert.equal(doc.getElementById("does-not-exist"), null);

  const storage = new FakeStorage();
  storage.failWrites = true;
  assert.throws(() => storage.setItem("x", "y"), /write failed/);
});
