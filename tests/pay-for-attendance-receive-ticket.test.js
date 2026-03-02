import test from "node:test";
import assert from "node:assert/strict";

import {
  buildValidationError,
  clearPayForAttendanceErrorState,
  createPayForAttendanceStorageAdapter,
  generateId,
  initPayForAttendanceAndReceiveTicketApp,
  normalizeEmail,
  normalizeText,
  payForAttendanceAndReceiveTicket,
  renderPayForAttendanceErrorState,
  showPayForAttendanceSuccessView,
  validatePayForAttendanceInput
} from "../src/js/012-pay-for-attendance-receive-ticket.js";

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
    "pay-attendance-form": form,
    "pay-attendance-form-container": createElement(),
    "pay-attendance-success-container": createElement(),
    "pay-attendance-success-message": createElement(),
    "pay-attendance-ticket-message": createElement(),
    "pay-attendance-error-summary": createElement(),
    "pay-attendance-email-error": createElement(),
    "pay-attendance-tier-error": createElement(),
    "pay-attendance-card-error": createElement(),
    "pay-attendance-amount-error": createElement(),
    "pay-attendance-registration-error": createElement(),
    "pay-attendance-gateway-error": createElement(),
    "pay-attendance-payment-error": createElement(),
    "pay-attendance-email-delivery-error": createElement(),
    "pay-attendance-email": createElement(),
    "pay-attendance-tier": createElement(),
    "pay-attendance-card-last4": createElement(),
    "pay-attendance-amount": createElement(),
    "pay-attendance-registration-open": createElement(),
    "pay-attendance-gateway-ready": createElement(),
    "pay-attendance-payment-approved": createElement(),
    "pay-attendance-email-delivery-ready": createElement()
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
    attendee_email: "attendee@example.com",
    ticket_tier: "regular",
    card_last4: "1234",
    amount: 100,
    registration_open: true,
    payment_gateway_ready: true,
    payment_approved: true,
    email_delivery_ready: true
  };
}

function registrationRows() {
  return [{ email: "attendee@example.com" }];
}

test("normalize helpers cover normal and nullish values", () => {
  assert.equal(normalizeText("  x  "), "x");
  assert.equal(normalizeText(null), "");
  assert.equal(normalizeEmail("  USER@EXAMPLE.COM"), "user@example.com");
});

test("validation covers required fields, tier/card/amount, and exception flags", () => {
  const missing = validatePayForAttendanceInput({});
  assert.equal(missing.some((e) => e.code === "required"), true);
  assert.equal(missing.some((e) => e.code === "invalid_tier"), true);
  assert.equal(missing.some((e) => e.code === "invalid_card"), true);
  assert.equal(missing.some((e) => e.code === "invalid_amount"), true);
  assert.equal(missing.some((e) => e.code === "registration_closed"), true);
  assert.equal(missing.some((e) => e.code === "gateway_unavailable"), true);
  assert.equal(missing.some((e) => e.code === "payment_declined"), true);
  assert.equal(missing.some((e) => e.code === "email_delivery_failed"), true);

  const invalidTier = validatePayForAttendanceInput({ ...validPayload(), ticket_tier: "gold" });
  assert.equal(invalidTier.some((e) => e.code === "invalid_tier"), true);

  const invalidCard = validatePayForAttendanceInput({ ...validPayload(), card_last4: "12a4" });
  assert.equal(invalidCard.some((e) => e.code === "invalid_card"), true);

  const invalidAmount = validatePayForAttendanceInput({ ...validPayload(), amount: 99 });
  assert.equal(invalidAmount.some((e) => e.code === "invalid_amount"), true);

  const declined = validatePayForAttendanceInput({ ...validPayload(), payment_approved: false });
  assert.equal(declined.some((e) => e.code === "payment_declined"), true);

  assert.deepEqual(validatePayForAttendanceInput(validPayload()), []);
});

test("adapter handles parse fallback and persistence", () => {
  const storage = new FakeStorage();
  const adapter = createPayForAttendanceStorageAdapter(storage);

  assert.deepEqual(adapter.loadRegistrations(), []);
  assert.deepEqual(adapter.loadPayments(), []);
  assert.deepEqual(adapter.loadTickets(), []);

  storage.setItem("ece493.registrations", "{bad");
  assert.deepEqual(adapter.loadRegistrations(), []);

  storage.setItem("ece493.payments", JSON.stringify({ nope: true }));
  assert.deepEqual(adapter.loadPayments(), []);

  adapter.savePayments([{ id: "p1" }]);
  assert.equal(adapter.loadPayments().length, 1);

  adapter.saveTickets([{ id: "t1" }]);
  assert.equal(adapter.loadTickets().length, 1);

  adapter.appendAudit({ status: "x" });
  assert.equal(JSON.parse(storage.getItem("ece493.audit")).length, 1);
});

test("adapter rejects invalid storage interfaces", () => {
  assert.throws(() => createPayForAttendanceStorageAdapter(null), /LocalStorage-like/);
  assert.throws(() => createPayForAttendanceStorageAdapter({}), /LocalStorage-like/);
  assert.throws(() => createPayForAttendanceStorageAdapter({ getItem() {} }), /LocalStorage-like/);
});

test("generateId covers provider and fallback", () => {
  assert.equal(generateId(() => "id-1"), "id-1");
  assert.equal(generateId().startsWith("id_"), true);
});

test("payForAttendanceAndReceiveTicket requires adapter", () => {
  assert.throws(() => payForAttendanceAndReceiveTicket(validPayload()), /requires an adapter/);
});

test("payForAttendanceAndReceiveTicket supports explicit nowProvider branch", () => {
  const storage = new FakeStorage();
  storage.setItem("ece493.registrations", JSON.stringify(registrationRows()));
  const adapter = createPayForAttendanceStorageAdapter(storage);

  const result = payForAttendanceAndReceiveTicket(validPayload(), {
    adapter,
    nowProvider: () => "2026-09-01T00:00:00.000Z",
    idProvider: () => "pay-now",
    ticketIdProvider: () => "ticket-now"
  });

  assert.equal(result.status, "success");
  assert.equal(result.payment_id, "pay-now");
});

test("payForAttendanceAndReceiveTicket handles validation and audit failure tolerance", () => {
  const result = payForAttendanceAndReceiveTicket({}, {
    adapter: {
      appendAudit() {
        throw new Error("audit failed");
      }
    }
  });

  assert.equal(result.status, "validation_failed");
});

test("payForAttendanceAndReceiveTicket handles load failures as service unavailable", () => {
  const stringFail = payForAttendanceAndReceiveTicket(validPayload(), {
    adapter: {
      loadRegistrations() {
        throw "db down";
      },
      loadPayments() {
        return [];
      },
      loadTickets() {
        return [];
      },
      appendAudit() {}
    }
  });
  assert.equal(stringFail.status, "service_unavailable");

  const errorFail = payForAttendanceAndReceiveTicket(validPayload(), {
    adapter: {
      loadRegistrations() {
        return registrationRows();
      },
      loadPayments() {
        throw new Error("db err");
      },
      loadTickets() {
        return [];
      },
      appendAudit() {}
    }
  });
  assert.equal(errorFail.status, "service_unavailable");

  const ticketLoadFail = payForAttendanceAndReceiveTicket(validPayload(), {
    adapter: {
      loadRegistrations() {
        return registrationRows();
      },
      loadPayments() {
        return [];
      },
      loadTickets() {
        throw new Error("ticket db err");
      },
      appendAudit() {}
    }
  });
  assert.equal(ticketLoadFail.status, "service_unavailable");
});

test("payForAttendanceAndReceiveTicket requires attendee registration", () => {
  const storage = new FakeStorage();
  const adapter = createPayForAttendanceStorageAdapter(storage);

  const result = payForAttendanceAndReceiveTicket(validPayload(), { adapter });
  assert.equal(result.status, "validation_failed");
  assert.equal(result.errors.some((e) => e.code === "not_registered"), true);
});

test("payForAttendanceAndReceiveTicket handles idempotent duplicate payment", () => {
  const payload = validPayload();
  const fingerprint = [payload.attendee_email, payload.ticket_tier, payload.card_last4, String(payload.amount)].join("|").toLowerCase();

  const storage = new FakeStorage();
  storage.setItem("ece493.registrations", JSON.stringify(registrationRows()));
  storage.setItem(
    "ece493.payments",
    JSON.stringify([
      {
        id: "pay-1",
        attendee_email: "attendee@example.com",
        ticket_tier: "regular",
        card_last4: "1234",
        amount: 100,
        fingerprint
      }
    ])
  );
  storage.setItem("ece493.tickets", JSON.stringify([{ id: "ticket-1", payment_id: "pay-1" }]));

  const adapter = createPayForAttendanceStorageAdapter(storage);
  const result = payForAttendanceAndReceiveTicket(payload, { adapter });

  assert.equal(result.status, "success");
  assert.equal(result.payment_id, "pay-1");
  assert.equal(result.ticket_id, "ticket-1");

  storage.setItem("ece493.tickets", JSON.stringify([]));
  const noTicketResult = payForAttendanceAndReceiveTicket(payload, { adapter });
  assert.equal(noTicketResult.status, "success");
  assert.equal(noTicketResult.ticket_id, null);
});

test("payForAttendanceAndReceiveTicket handles save failure branches and success", () => {
  const errorSave = payForAttendanceAndReceiveTicket(validPayload(), {
    adapter: {
      loadRegistrations() {
        return registrationRows();
      },
      loadPayments() {
        return [];
      },
      loadTickets() {
        return [];
      },
      savePayments() {
        throw new Error("write");
      },
      saveTickets() {},
      appendAudit() {}
    }
  });
  assert.equal(errorSave.status, "storage_failed");

  const stringSave = payForAttendanceAndReceiveTicket(validPayload(), {
    adapter: {
      loadRegistrations() {
        return registrationRows();
      },
      loadPayments() {
        return [];
      },
      loadTickets() {
        return [];
      },
      savePayments() {
        throw "write";
      },
      saveTickets() {},
      appendAudit() {}
    }
  });
  assert.equal(stringSave.status, "storage_failed");

  const storage = new FakeStorage();
  storage.setItem("ece493.registrations", JSON.stringify(registrationRows()));
  const adapter = createPayForAttendanceStorageAdapter(storage);

  const success = payForAttendanceAndReceiveTicket(validPayload(), {
    adapter,
    idProvider: () => "pay-a",
    ticketIdProvider: () => "ticket-a"
  });
  assert.equal(success.status, "success");
  assert.equal(adapter.loadPayments().length, 1);
  assert.equal(adapter.loadTickets().length, 1);
});

test("error rendering/clearing handles mapped and unmapped fields", () => {
  const elements = {
    summary: createElement(),
    fieldErrors: {
      attendee_email: createElement(),
      ticket_tier: createElement(),
      card_last4: createElement(),
      amount: createElement(),
      registration_open: createElement(),
      payment_gateway_ready: createElement(),
      payment_approved: createElement(),
      email_delivery_ready: createElement()
    }
  };

  clearPayForAttendanceErrorState(elements);
  assert.equal(elements.summary.hidden, true);

  renderPayForAttendanceErrorState(
    [
      buildValidationError("attendee_email", "required", "Attendee email is required."),
      buildValidationError("unknown", "x", "ignore")
    ],
    elements
  );

  assert.equal(elements.summary.hidden, false);
  assert.equal(elements.fieldErrors.attendee_email.hidden, false);
  assert.equal(elements.fieldErrors.amount.hidden, true);

  renderPayForAttendanceErrorState([], elements);
  assert.equal(elements.summary.hidden, true);
});

test("success view hides form and shows ticket", () => {
  const elements = {
    formContainer: createElement(),
    successContainer: createElement(),
    successMessage: createElement(),
    ticketMessage: createElement()
  };

  showPayForAttendanceSuccessView({ ticket_id: "T-100" }, elements);
  assert.equal(elements.formContainer.hidden, true);
  assert.equal(elements.successContainer.hidden, false);
  assert.equal(elements.successMessage.textContent, "Payment processed and ticket issued.");
  assert.equal(elements.ticketMessage.textContent, "Ticket ID: T-100");
});

test("init app returns null when document or form missing", () => {
  assert.equal(initPayForAttendanceAndReceiveTicketApp({ document: null }), null);
  assert.equal(initPayForAttendanceAndReceiveTicketApp({ document: { getElementById: () => null } }), null);
});

test("init app supports global fallback", () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;

  try {
    const doc = createDocumentMock();
    globalThis.document = doc;
    globalThis.window = { localStorage: new FakeStorage() };

    const app = initPayForAttendanceAndReceiveTicketApp();
    assert.ok(app);
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  }
});

test("init app throws when storage missing", () => {
  const doc = createDocumentMock();
  assert.throws(() => initPayForAttendanceAndReceiveTicketApp({ document: doc }), /LocalStorage-like/);
});

test("init app handles undefined window fallback", () => {
  const previousWindow = globalThis.window;

  try {
    globalThis.window = undefined;
    const doc = createDocumentMock();
    assert.throws(() => initPayForAttendanceAndReceiveTicketApp({ document: doc }), /LocalStorage-like/);
  } finally {
    globalThis.window = previousWindow;
  }
});

test("init app supports explicit adapter branch", () => {
  const doc = createDocumentMock();
  const app = initPayForAttendanceAndReceiveTicketApp({
    document: doc,
    adapter: {
      loadRegistrations() {
        return [];
      },
      loadPayments() {
        return [];
      },
      loadTickets() {
        return [];
      },
      savePayments() {},
      saveTickets() {},
      appendAudit() {}
    }
  });
  assert.ok(app);
});

test("submit flow covers success and validation failure paths", () => {
  const successStorage = new FakeStorage();
  successStorage.setItem("ece493.registrations", JSON.stringify(registrationRows()));
  const successDoc = createDocumentMock();
  const successApp = initPayForAttendanceAndReceiveTicketApp({ document: successDoc, storage: successStorage });
  assert.ok(successApp);

  successDoc.elements["pay-attendance-email"].value = "attendee@example.com";
  successDoc.elements["pay-attendance-tier"].value = "regular";
  successDoc.elements["pay-attendance-card-last4"].value = "1234";
  successDoc.elements["pay-attendance-amount"].value = "100";
  successDoc.elements["pay-attendance-registration-open"].checked = true;
  successDoc.elements["pay-attendance-gateway-ready"].checked = true;
  successDoc.elements["pay-attendance-payment-approved"].checked = true;
  successDoc.elements["pay-attendance-email-delivery-ready"].checked = true;

  let prevented = false;
  let result = successDoc.form.listener({
    preventDefault() {
      prevented = true;
    }
  });

  assert.equal(prevented, true);
  assert.equal(result.status, "success");
  assert.equal(successDoc.elements["pay-attendance-form-container"].hidden, true);
  assert.equal(successDoc.elements["pay-attendance-success-container"].hidden, false);
  assert.equal(successDoc.form.resetCalls, 1);

  const failDoc = createDocumentMock();
  const failStorage = new FakeStorage();
  const failApp = initPayForAttendanceAndReceiveTicketApp({ document: failDoc, storage: failStorage });
  assert.ok(failApp);

  failDoc.elements["pay-attendance-email"].value = "";
  failDoc.elements["pay-attendance-tier"].value = "";
  failDoc.elements["pay-attendance-card-last4"].value = "";
  failDoc.elements["pay-attendance-amount"].value = "0";
  failDoc.elements["pay-attendance-registration-open"].checked = false;
  failDoc.elements["pay-attendance-gateway-ready"].checked = false;
  failDoc.elements["pay-attendance-payment-approved"].checked = false;
  failDoc.elements["pay-attendance-email-delivery-ready"].checked = false;

  result = failDoc.form.listener();
  assert.equal(result.status, "validation_failed");
  assert.equal(failDoc.elements["pay-attendance-error-summary"].hidden, false);
});

test("submit flow handles event without preventDefault", () => {
  const doc = createDocumentMock();
  const app = initPayForAttendanceAndReceiveTicketApp({
    document: doc,
    adapter: {
      loadRegistrations() {
        return [];
      },
      loadPayments() {
        return [];
      },
      loadTickets() {
        return [];
      },
      savePayments() {},
      saveTickets() {},
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
