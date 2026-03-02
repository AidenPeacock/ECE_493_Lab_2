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
    "assign-referees-success-container": createNode("assign-referees-success-container")
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

  storage.setItem("ece493.session", JSON.stringify({ email: "ed@example.com", role: "editor" }));
  listeners.get("ece493:session-changed")();
  assert.equal(doc.elements["assign-referees-form-container"].hidden, false);

  storage.setItem("ece493.session", JSON.stringify({ email: "a@example.com", role: "author" }));
  listeners.get("storage")();
  assert.equal(doc.elements["assign-referees-form-container"].hidden, true);
});

test("initAccessControl returns null when document/storage are unavailable", () => {
  assert.equal(initAccessControl({ document: null }), null);
  assert.equal(initAccessControl({ document: createDocumentMock(), storage: null, window: {} }), null);
});
