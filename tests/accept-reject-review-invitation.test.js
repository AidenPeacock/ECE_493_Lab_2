import test from "node:test";
import assert from "node:assert/strict";

import {
  buildValidationError,
  clearInvitationDecisionErrorState,
  createReviewInvitationStorageAdapter,
  decideReviewInvitation,
  generateId,
  initAcceptRejectReviewInvitationApp,
  isValidEmailFormat,
  normalizeEmail,
  normalizeText,
  renderInvitationDecisionErrorState,
  showInvitationDecisionSuccessView,
  validateReviewInvitationDecision
} from "../src/js/007-accept-reject-review-invitation.js";

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
  return { value: initialValue, hidden: true, textContent: "", checked: true };
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
    "review-invitation-form": form,
    "review-invitation-form-container": createElement(),
    "review-invitation-success-container": createElement(),
    "review-invitation-success-message": createElement(),
    "review-invitation-error-summary": createElement(),
    "review-invitation-id-error": createElement(),
    "review-invitation-paper-id-error": createElement(),
    "review-invitation-email-error": createElement(),
    "review-invitation-decision-error": createElement(),
    "review-invitation-state-error": createElement(),
    "review-invitation-id": createElement(),
    "review-invitation-paper-id": createElement(),
    "review-invitation-email": createElement(),
    "review-invitation-decision": createElement(),
    "review-invitation-reviewer-count": createElement(),
    "review-invitation-valid": createElement(),
    "review-invitation-expires-at": createElement()
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
    invitation_id: "INV-1",
    paper_id: "P-1",
    referee_email: "ref@example.com",
    decision: "accept",
    current_reviewer_count: 2,
    invitation_valid: true,
    expires_at: "2030-01-01T00:00:00.000Z"
  };
}

test("normalize and email helpers cover valid and fallback paths", () => {
  assert.equal(normalizeText("  x  "), "x");
  assert.equal(normalizeText(null), "");
  assert.equal(normalizeEmail("  USER@EXAMPLE.COM"), "user@example.com");
  assert.equal(isValidEmailFormat("bad"), false);
  assert.equal(isValidEmailFormat("ok@example.com"), true);
});

test("validation covers required, email, decision, invalid/expired invitation, and reviewer limit", () => {
  const required = validateReviewInvitationDecision({}, "2026-01-01T00:00:00.000Z");
  assert.equal(required.some((e) => e.code === "required"), true);

  const invalidEmail = validateReviewInvitationDecision(
    { ...validPayload(), referee_email: "bad" },
    "2026-01-01T00:00:00.000Z"
  );
  assert.equal(invalidEmail.some((e) => e.code === "invalid_format"), true);

  const invalidDecision = validateReviewInvitationDecision(
    { ...validPayload(), decision: "maybe" },
    "2026-01-01T00:00:00.000Z"
  );
  assert.equal(invalidDecision.some((e) => e.code === "invalid_decision"), true);

  const invalidInvitation = validateReviewInvitationDecision(
    { ...validPayload(), invitation_valid: false },
    "2026-01-01T00:00:00.000Z"
  );
  assert.equal(invalidInvitation.some((e) => e.code === "expired_or_invalid"), true);

  const expiredInvitation = validateReviewInvitationDecision(
    { ...validPayload(), expires_at: "2025-01-01T00:00:00.000Z" },
    "2026-01-01T00:00:00.000Z"
  );
  assert.equal(expiredInvitation.some((e) => e.code === "expired_or_invalid"), true);

  const invalidDate = validateReviewInvitationDecision(
    { ...validPayload(), expires_at: "not-a-date" },
    "2026-01-01T00:00:00.000Z"
  );
  assert.equal(invalidDate.some((e) => e.code === "expired_or_invalid"), true);

  const reviewerLimit = validateReviewInvitationDecision(
    { ...validPayload(), current_reviewer_count: 3 },
    "2026-01-01T00:00:00.000Z"
  );
  assert.equal(reviewerLimit.some((e) => e.code === "reviewer_limit_reached"), true);

  const defaultedFields = validateReviewInvitationDecision(
    { ...validPayload(), current_reviewer_count: undefined, invitation_valid: undefined },
    "2026-01-01T00:00:00.000Z"
  );
  assert.deepEqual(defaultedFields, []);

  assert.deepEqual(validateReviewInvitationDecision(validPayload(), "2026-01-01T00:00:00.000Z"), []);
});

test("adapter handles parse fallback and persistence", () => {
  const storage = new FakeStorage();
  const adapter = createReviewInvitationStorageAdapter(storage);

  assert.deepEqual(adapter.loadDecisions(), []);
  storage.setItem("ece493.reviewInvitationDecisions", "{bad-json");
  assert.deepEqual(adapter.loadDecisions(), []);
  storage.setItem("ece493.reviewInvitationDecisions", JSON.stringify({ nope: true }));
  assert.deepEqual(adapter.loadDecisions(), []);

  assert.deepEqual(adapter.loadReviewerPapers(), []);

  adapter.saveDecisions([{ id: "d1" }]);
  adapter.saveReviewerPapers([{ id: "a1" }]);
  assert.equal(adapter.loadDecisions().length, 1);
  assert.equal(adapter.loadReviewerPapers().length, 1);

  adapter.appendAudit({ status: "x" });
  assert.equal(JSON.parse(storage.getItem("ece493.audit")).length, 1);
});

test("adapter rejects invalid local storage interface", () => {
  assert.throws(() => createReviewInvitationStorageAdapter(null), /LocalStorage-like/);
  assert.throws(() => createReviewInvitationStorageAdapter({}), /LocalStorage-like/);
  assert.throws(() => createReviewInvitationStorageAdapter({ getItem() {} }), /LocalStorage-like/);
});

test("generateId covers provider and fallback", () => {
  assert.equal(generateId(() => "id-1"), "id-1");
  assert.equal(generateId().startsWith("id_"), true);
});

test("decideReviewInvitation requires adapter", () => {
  assert.throws(() => decideReviewInvitation(validPayload()), /requires an adapter/);
});

test("decideReviewInvitation handles validation failures and audit failure tolerance", () => {
  const result = decideReviewInvitation({}, {
    adapter: {
      appendAudit() {
        throw new Error("audit failed");
      }
    },
    nowProvider: () => "2026-01-01T00:00:00.000Z"
  });

  assert.equal(result.status, "validation_failed");
});

test("decideReviewInvitation handles service unavailable when loading data", () => {
  const stringThrow = decideReviewInvitation(validPayload(), {
    adapter: {
      loadDecisions() {
        throw "down";
      },
      appendAudit() {}
    },
    nowProvider: () => "2026-01-01T00:00:00.000Z"
  });
  assert.equal(stringThrow.status, "service_unavailable");

  const errorThrow = decideReviewInvitation(validPayload(), {
    adapter: {
      loadDecisions() {
        return [];
      },
      loadReviewerPapers() {
        throw new Error("down2");
      },
      appendAudit() {}
    },
    nowProvider: () => "2026-01-01T00:00:00.000Z"
  });
  assert.equal(errorThrow.status, "service_unavailable");
});

test("decideReviewInvitation supports idempotent duplicate decision", () => {
  const storage = new FakeStorage();
  const adapter = createReviewInvitationStorageAdapter(storage);

  const first = decideReviewInvitation(validPayload(), {
    adapter,
    idProvider: () => "dec-1",
    nowProvider: () => "2026-01-01T00:00:00.000Z"
  });
  assert.equal(first.status, "success");

  const second = decideReviewInvitation(validPayload(), {
    adapter,
    idProvider: () => "dec-2",
    nowProvider: () => "2026-01-01T00:00:01.000Z"
  });
  assert.equal(second.status, "success");
  assert.equal(second.decision_id, "dec-1");
  assert.equal(adapter.loadDecisions().length, 1);

  const firstReject = decideReviewInvitation(
    { ...validPayload(), invitation_id: "INV-R", decision: "reject" },
    {
      adapter,
      idProvider: () => "dec-r1",
      nowProvider: () => "2026-01-01T00:00:02.000Z"
    }
  );
  assert.equal(firstReject.status, "success");

  const duplicateReject = decideReviewInvitation(
    { ...validPayload(), invitation_id: "INV-R", decision: "reject" },
    {
      adapter,
      idProvider: () => "dec-r2",
      nowProvider: () => "2026-01-01T00:00:03.000Z"
    }
  );
  assert.equal(duplicateReject.status, "success");
  assert.equal(duplicateReject.decision_id, "dec-r1");
});

test("decideReviewInvitation records rejection and tolerates notification failure", () => {
  const storage = new FakeStorage();
  const adapter = createReviewInvitationStorageAdapter(storage);

  const rejected = decideReviewInvitation(
    { ...validPayload(), decision: "reject" },
    {
      adapter,
      idProvider: () => "dec-r",
      nowProvider: () => "2026-01-01T00:00:00.000Z",
      notifyEditorFn() {
        throw new Error("notify failed");
      }
    }
  );

  assert.equal(rejected.status, "success");
  assert.equal(adapter.loadReviewerPapers().length, 0);

  const defaultNotify = decideReviewInvitation(
    { ...validPayload(), invitation_id: "INV-2", decision: "reject" },
    {
      adapter,
      idProvider: () => "dec-r2",
      nowProvider: () => "2026-01-01T00:00:01.000Z"
    }
  );

  assert.equal(defaultNotify.status, "success");
});

test("decideReviewInvitation accept path associates paper and replaces previous decision for same invitation", () => {
  const storage = new FakeStorage();
  const adapter = createReviewInvitationStorageAdapter(storage);

  const initialReject = decideReviewInvitation(
    { ...validPayload(), decision: "reject" },
    {
      adapter,
      idProvider: () => "dec-r",
      nowProvider: () => "2026-01-01T00:00:00.000Z"
    }
  );
  assert.equal(initialReject.status, "success");

  const accept = decideReviewInvitation(validPayload(), {
    adapter,
    idProvider: () => "dec-a",
    nowProvider: () => "2026-01-01T00:00:01.000Z"
  });

  assert.equal(accept.status, "success");
  assert.equal(adapter.loadDecisions().length, 1);
  assert.equal(adapter.loadDecisions()[0].decision, "accept");
  assert.equal(adapter.loadReviewerPapers().length, 1);

  const switchBackToReject = decideReviewInvitation(
    { ...validPayload(), decision: "reject" },
    {
      adapter,
      idProvider: () => "dec-r3",
      nowProvider: () => "2026-01-01T00:00:02.000Z"
    }
  );
  assert.equal(switchBackToReject.status, "success");
  assert.equal(adapter.loadReviewerPapers().length, 0);
});

test("decideReviewInvitation handles save failure branches", () => {
  const errorSave = decideReviewInvitation(validPayload(), {
    adapter: {
      loadDecisions() {
        return [];
      },
      loadReviewerPapers() {
        return [];
      },
      saveDecisions() {
        throw new Error("save fail");
      },
      saveReviewerPapers() {},
      appendAudit() {}
    },
    nowProvider: () => "2026-01-01T00:00:00.000Z"
  });
  assert.equal(errorSave.status, "service_unavailable");

  const stringSave = decideReviewInvitation(validPayload(), {
    adapter: {
      loadDecisions() {
        return [];
      },
      loadReviewerPapers() {
        return [];
      },
      saveDecisions() {},
      saveReviewerPapers() {
        throw "save string";
      },
      appendAudit() {}
    },
    nowProvider: () => "2026-01-01T00:00:00.000Z"
  });
  assert.equal(stringSave.status, "service_unavailable");
});

test("error rendering and clearing handles mapped and unmapped fields", () => {
  const elements = {
    summary: createElement(),
    fieldErrors: {
      invitation_id: createElement(),
      paper_id: createElement(),
      referee_email: createElement(),
      decision: createElement(),
      invitation: createElement()
    }
  };

  clearInvitationDecisionErrorState(elements);
  assert.equal(elements.summary.hidden, true);

  renderInvitationDecisionErrorState(
    [
      buildValidationError("invitation_id", "required", "Invitation ID is required."),
      buildValidationError("system", "service_unavailable", "retry")
    ],
    elements
  );

  assert.equal(elements.summary.hidden, false);
  assert.equal(elements.fieldErrors.invitation_id.hidden, false);
  assert.equal(elements.fieldErrors.referee_email.hidden, true);

  renderInvitationDecisionErrorState([], elements);
  assert.equal(elements.summary.hidden, true);
});

test("success view renders accept and reject messages", () => {
  const elements = {
    formContainer: createElement(),
    successContainer: createElement(),
    successMessage: createElement()
  };

  showInvitationDecisionSuccessView(elements, "accept");
  assert.equal(elements.formContainer.hidden, true);
  assert.equal(elements.successContainer.hidden, false);
  assert.equal(elements.successMessage.textContent, "Invitation accepted.");

  showInvitationDecisionSuccessView(elements, "reject");
  assert.equal(elements.successMessage.textContent, "Invitation rejected.");
});

test("init app returns null when document or form missing", () => {
  assert.equal(initAcceptRejectReviewInvitationApp({ document: null }), null);
  assert.equal(initAcceptRejectReviewInvitationApp({ document: { getElementById: () => null } }), null);
});

test("init app supports global document/window fallback", () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;

  try {
    const doc = createDocumentMock();
    globalThis.document = doc;
    globalThis.window = { localStorage: new FakeStorage() };

    const app = initAcceptRejectReviewInvitationApp();
    assert.ok(app);
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  }
});

test("init app throws when storage is unavailable and no adapter provided", () => {
  const doc = createDocumentMock();
  assert.throws(() => initAcceptRejectReviewInvitationApp({ document: doc }), /LocalStorage-like/);
});

test("init app handles window without localStorage", () => {
  const previousWindow = globalThis.window;

  try {
    globalThis.window = {};
    const doc = createDocumentMock();
    assert.throws(() => initAcceptRejectReviewInvitationApp({ document: doc }), /LocalStorage-like/);
  } finally {
    globalThis.window = previousWindow;
  }
});

test("init app supports explicit adapter branch", () => {
  const doc = createDocumentMock();
  const app = initAcceptRejectReviewInvitationApp({
    document: doc,
    adapter: {
      loadDecisions() {
        return [];
      },
      saveDecisions() {},
      loadReviewerPapers() {
        return [];
      },
      saveReviewerPapers() {},
      appendAudit() {}
    }
  });
  assert.ok(app);
});

test("init app submit flow covers success and failure", () => {
  const successStorage = new FakeStorage();
  const successDoc = createDocumentMock();
  const successApp = initAcceptRejectReviewInvitationApp({ document: successDoc, storage: successStorage });
  assert.ok(successApp);

  successDoc.elements["review-invitation-id"].value = "INV-1";
  successDoc.elements["review-invitation-paper-id"].value = "P-1";
  successDoc.elements["review-invitation-email"].value = "ref@example.com";
  successDoc.elements["review-invitation-decision"].value = "accept";
  successDoc.elements["review-invitation-reviewer-count"].value = "2";
  successDoc.elements["review-invitation-valid"].checked = true;
  successDoc.elements["review-invitation-expires-at"].value = "2030-01-01T00:00:00.000Z";

  let prevented = false;
  let result = successDoc.form.listener({
    preventDefault() {
      prevented = true;
    }
  });

  assert.equal(prevented, true);
  assert.equal(result.status, "success");
  assert.equal(successDoc.elements["review-invitation-form-container"].hidden, true);
  assert.equal(successDoc.elements["review-invitation-success-container"].hidden, false);
  assert.equal(successDoc.form.resetCalls, 1);

  const failDoc = createDocumentMock();
  const failStorage = new FakeStorage();
  const failApp = initAcceptRejectReviewInvitationApp({ document: failDoc, storage: failStorage });
  assert.ok(failApp);

  failDoc.elements["review-invitation-id"].value = "";
  failDoc.elements["review-invitation-paper-id"].value = "";
  failDoc.elements["review-invitation-email"].value = "bad";
  failDoc.elements["review-invitation-decision"].value = "maybe";
  failDoc.elements["review-invitation-valid"].checked = false;
  failDoc.elements["review-invitation-expires-at"].value = "2030-01-01T00:00:00.000Z";

  result = failDoc.form.listener();
  assert.equal(result.status, "validation_failed");
  assert.equal(failDoc.elements["review-invitation-error-summary"].hidden, false);
});

test("init app submit handles event without preventDefault", () => {
  const doc = createDocumentMock();
  const app = initAcceptRejectReviewInvitationApp({
    document: doc,
    adapter: {
      loadDecisions() {
        return [];
      },
      saveDecisions() {},
      loadReviewerPapers() {
        return [];
      },
      saveReviewerPapers() {},
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
  assert.equal(doc.getElementById("missing"), null);
});
