import test from "node:test";
import assert from "node:assert/strict";

import { applyAccessControl, initAccessControl } from "../src/js/access-control.js";

class FakeStorage {
  constructor() {
    this.data = new Map();
  }

  getItem(key) {
    return this.data.has(key) ? this.data.get(key) : null;
  }

  setItem(key, value) {
    this.data.set(key, value);
  }
}

function createNode(id) {
  return {
    id,
    hidden: false,
    textContent: "",
    className: "",
    children: [],
    insertAdjacentElement(_position, element) {
      this.inserted = element;
      this.after = element;
    },
    append(...items) {
      this.children.push(...items);
    }
  };
}

function createDocumentMock() {
  const elements = {
    "change-password-form-container": createNode("change-password-form-container"),
    "change-password-success-container": createNode("change-password-success-container"),
    "submit-paper-form-container": createNode("submit-paper-form-container"),
    "submit-paper-success-container": createNode("submit-paper-success-container"),
    "save-draft-form-container": createNode("save-draft-form-container"),
    "save-draft-success-container": createNode("save-draft-success-container"),
    "assign-referees-form-container": createNode("assign-referees-form-container"),
    "assign-referees-success-container": createNode("assign-referees-success-container"),
    "review-invitation-form-container": createNode("review-invitation-form-container"),
    "review-invitation-success-container": createNode("review-invitation-success-container"),
    "submit-review-form-container": createNode("submit-review-form-container"),
    "submit-review-success-container": createNode("submit-review-success-container"),
    "make-final-decision-form-container": createNode("make-final-decision-form-container"),
    "make-final-decision-success-container": createNode("make-final-decision-success-container"),
    "generate-schedule-form-container": createNode("generate-schedule-form-container"),
    "generate-schedule-success-container": createNode("generate-schedule-success-container"),
    "edit-publish-schedule-form-container": createNode("edit-publish-schedule-form-container"),
    "edit-publish-schedule-success-container": createNode("edit-publish-schedule-success-container")
  };

  return {
    elements,
    createElement() {
      const node = createNode("");
      return node;
    },
    getElementById(id) {
      return Object.prototype.hasOwnProperty.call(elements, id) ? elements[id] : null;
    }
  };
}

function attachCreatedCards(doc) {
  for (const node of Object.values(doc.elements)) {
    if (node.after && node.after.id) {
      doc.elements[node.after.id] = node.after;
      for (const child of node.after.children) {
        if (child.id) {
          doc.elements[child.id] = child;
        }
      }
    }
  }
}

test("applyAccessControl locks protected stories when no session exists", () => {
  const doc = createDocumentMock();
  const storage = new FakeStorage();

  applyAccessControl(doc, storage);
  attachCreatedCards(doc);

  assert.equal(doc.elements["change-password-form-container"].hidden, true);
  assert.equal(doc.elements["submit-paper-form-container"].hidden, true);
  assert.equal(doc.elements["assign-referees-form-container"].hidden, true);
  assert.equal(doc.elements["review-invitation-form-container"].hidden, true);
  assert.equal(doc.elements["submit-review-form-container"].hidden, true);
  assert.equal(doc.elements["make-final-decision-form-container"].hidden, true);
  assert.equal(doc.elements["generate-schedule-form-container"].hidden, true);
  assert.equal(doc.elements["edit-publish-schedule-form-container"].hidden, true);

  assert.equal(doc.elements["submit-paper-access-locked"].hidden, false);
  assert.equal(
    doc.elements["submit-paper-access-locked-message"].textContent,
    "Log in to access Submit Paper Manuscript."
  );
});

test("applyAccessControl unlocks based on role and hides mismatched role stories", () => {
  const doc = createDocumentMock();
  const storage = new FakeStorage();

  storage.setItem(
    "ece493.session",
    JSON.stringify({ email: "editor@example.com", role: "editor" })
  );

  applyAccessControl(doc, storage);
  attachCreatedCards(doc);

  assert.equal(doc.elements["change-password-form-container"].hidden, false);
  assert.equal(doc.elements["assign-referees-form-container"].hidden, false);
  assert.equal(doc.elements["make-final-decision-form-container"].hidden, false);
  assert.equal(doc.elements["generate-schedule-form-container"].hidden, false);
  assert.equal(doc.elements["edit-publish-schedule-form-container"].hidden, false);
  assert.equal(doc.elements["review-invitation-form-container"].hidden, true);
  assert.equal(doc.elements["submit-review-form-container"].hidden, true);
  assert.equal(doc.elements["submit-paper-form-container"].hidden, true);
  assert.equal(doc.elements["save-draft-form-container"].hidden, true);

  assert.equal(doc.elements["submit-paper-access-locked"].hidden, false);
  assert.equal(
    doc.elements["submit-paper-access-locked-message"].textContent,
    "Submit Paper Manuscript is available only for authors. Logged in as editor."
  );
});

test("applyAccessControl tolerates malformed session and missing containers", () => {
  const doc = createDocumentMock();
  delete doc.elements["save-draft-form-container"];
  const storage = new FakeStorage();

  storage.setItem("ece493.session", "{bad-json");
  applyAccessControl(doc, storage);

  assert.equal(doc.elements["assign-referees-form-container"].hidden, true);
});

test("applyAccessControl handles non-object/missing-field sessions and missing storage api", () => {
  const doc = createDocumentMock();
  const storage = new FakeStorage();

  storage.setItem("ece493.session", JSON.stringify("not-an-object"));
  applyAccessControl(doc, storage);
  assert.equal(doc.elements["change-password-form-container"].hidden, true);

  storage.setItem("ece493.session", JSON.stringify({ email: "", role: "" }));
  applyAccessControl(doc, storage);
  assert.equal(doc.elements["change-password-form-container"].hidden, true);
  assert.equal(doc.elements["generate-schedule-form-container"].hidden, true);
  assert.equal(doc.elements["edit-publish-schedule-form-container"].hidden, true);

  storage.setItem("ece493.session", JSON.stringify({}));
  applyAccessControl(doc, storage);
  assert.equal(doc.elements["change-password-form-container"].hidden, true);

  applyAccessControl(doc, {});
  assert.equal(doc.elements["change-password-form-container"].hidden, true);
});

test("applyAccessControl handles existing lock cards and containers without insertAdjacentElement", () => {
  const doc = createDocumentMock();
  const storage = new FakeStorage();
  storage.setItem("ece493.session", JSON.stringify({ email: "a@example.com", role: "author" }));

  doc.elements["submit-paper-access-locked"] = {
    id: "submit-paper-access-locked",
    hidden: false,
    children: null
  };
  delete doc.elements["review-invitation-form-container"].insertAdjacentElement;

  applyAccessControl(doc, storage);
  assert.equal(doc.elements["submit-paper-access-locked"].hidden, true);

  doc.elements["submit-paper-access-locked"].children = [undefined];
  applyAccessControl(doc, storage);
  assert.equal(doc.elements["submit-paper-access-locked"].hidden, true);
});

test("initAccessControl updates when session-changed and storage events fire", () => {
  const doc = createDocumentMock();
  const storage = new FakeStorage();

  const listeners = new Map();
  const win = {
    localStorage: storage,
    addEventListener(name, cb) {
      listeners.set(name, cb);
    }
  };

  const app = initAccessControl({ document: doc, window: win, storage });
  assert.ok(app);
  attachCreatedCards(doc);
  assert.equal(doc.elements["assign-referees-form-container"].hidden, true);
  assert.equal(doc.elements["make-final-decision-form-container"].hidden, true);

  storage.setItem("ece493.session", JSON.stringify({ email: "ed@example.com", role: "editor" }));
  listeners.get("ece493:session-changed")();
  assert.equal(doc.elements["assign-referees-form-container"].hidden, false);
  assert.equal(doc.elements["make-final-decision-form-container"].hidden, false);
  assert.equal(doc.elements["generate-schedule-form-container"].hidden, false);
  assert.equal(doc.elements["edit-publish-schedule-form-container"].hidden, false);
  assert.equal(doc.elements["review-invitation-form-container"].hidden, true);
  assert.equal(doc.elements["submit-review-form-container"].hidden, true);

  storage.setItem("ece493.session", JSON.stringify({ email: "a@example.com", role: "author" }));
  listeners.get("storage")();
  assert.equal(doc.elements["assign-referees-form-container"].hidden, true);
  assert.equal(doc.elements["make-final-decision-form-container"].hidden, true);
  assert.equal(doc.elements["generate-schedule-form-container"].hidden, true);
  assert.equal(doc.elements["edit-publish-schedule-form-container"].hidden, true);
  assert.equal(doc.elements["review-invitation-form-container"].hidden, true);
  assert.equal(doc.elements["submit-review-form-container"].hidden, true);

  storage.setItem("ece493.session", JSON.stringify({ email: "r@example.com", role: "reviewer" }));
  listeners.get("ece493:session-changed")();
  assert.equal(doc.elements["review-invitation-form-container"].hidden, false);
  assert.equal(doc.elements["submit-review-form-container"].hidden, false);
  assert.equal(doc.elements["make-final-decision-form-container"].hidden, true);
  assert.equal(doc.elements["generate-schedule-form-container"].hidden, true);
  assert.equal(doc.elements["edit-publish-schedule-form-container"].hidden, true);
});

test("initAccessControl returns null when document/storage are unavailable", () => {
  assert.equal(initAccessControl({ document: null }), null);
  assert.equal(initAccessControl({ document: createDocumentMock(), storage: null, window: {} }), null);
});

test("initAccessControl supports global fallback and no addEventListener branch", () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;

  try {
    const doc = createDocumentMock();
    const storage = new FakeStorage();
    globalThis.document = doc;
    globalThis.window = { localStorage: storage };

    const app = initAccessControl();
    assert.ok(app);
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  }
});

test("initAccessControl covers undefined global window fallback branch", () => {
  const previousWindow = globalThis.window;

  try {
    globalThis.window = undefined;
    const app = initAccessControl({ document: createDocumentMock(), storage: new FakeStorage() });
    assert.ok(app);
  } finally {
    globalThis.window = previousWindow;
  }
});
