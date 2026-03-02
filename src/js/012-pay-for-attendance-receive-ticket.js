const STORAGE_KEYS = {
  registrations: "ece493.registrations",
  payments: "ece493.payments",
  tickets: "ece493.tickets",
  audit: "ece493.audit"
};

const VALID_TIERS = new Set(["student", "regular", "vip"]);
const TIER_PRICES = {
  student: 50,
  regular: 100,
  vip: 200
};

export function normalizeText(value) {
  return String(value ?? "").trim();
}

export function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function safeParseArray(raw) {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function buildValidationError(field, code, message) {
  return { field, code, message };
}

function validCardLast4(value) {
  return /^\d{4}$/.test(normalizeText(value));
}

export function validatePayForAttendanceInput(input) {
  const errors = [];

  const attendeeEmail = normalizeEmail(input?.attendee_email);
  const tier = normalizeText(input?.ticket_tier).toLowerCase();
  const cardLast4 = normalizeText(input?.card_last4);
  const amount = Number(input?.amount ?? 0);
  const registrationOpen = input?.registration_open === true;
  const paymentGatewayReady = input?.payment_gateway_ready === true;
  const paymentApproved = input?.payment_approved === true;
  const emailDeliveryReady = input?.email_delivery_ready === true;

  if (!attendeeEmail) {
    errors.push(
      buildValidationError("attendee_email", "required", "Attendee email is required.")
    );
  }

  if (!VALID_TIERS.has(tier)) {
    errors.push(
      buildValidationError(
        "ticket_tier",
        "invalid_tier",
        "Ticket tier must be student, regular, or vip."
      )
    );
  }

  if (!validCardLast4(cardLast4)) {
    errors.push(
      buildValidationError("card_last4", "invalid_card", "Card last 4 digits must be exactly four numbers.")
    );
  }

  const expectedAmount = TIER_PRICES[tier] ?? NaN;
  if (!Number.isFinite(amount) || amount <= 0 || amount !== expectedAmount) {
    errors.push(
      buildValidationError(
        "amount",
        "invalid_amount",
        "Amount must match the selected ticket tier price."
      )
    );
  }

  if (!registrationOpen) {
    errors.push(
      buildValidationError(
        "registration_open",
        "registration_closed",
        "Registration is closed. Payment cannot be processed."
      )
    );
  }

  if (!paymentGatewayReady) {
    errors.push(
      buildValidationError(
        "payment_gateway_ready",
        "gateway_unavailable",
        "Payment gateway is unavailable. Please retry later."
      )
    );
  }

  if (!paymentApproved) {
    errors.push(
      buildValidationError(
        "payment_approved",
        "payment_declined",
        "Payment was declined. Please use a different payment method."
      )
    );
  }

  if (!emailDeliveryReady) {
    errors.push(
      buildValidationError(
        "email_delivery_ready",
        "email_delivery_failed",
        "Ticket confirmation delivery failed. Please retry."
      )
    );
  }

  return errors;
}

export function createPayForAttendanceStorageAdapter(storage) {
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
    throw new Error("A LocalStorage-like object is required.");
  }

  return {
    loadRegistrations() {
      return safeParseArray(storage.getItem(STORAGE_KEYS.registrations));
    },
    loadPayments() {
      return safeParseArray(storage.getItem(STORAGE_KEYS.payments));
    },
    loadTickets() {
      return safeParseArray(storage.getItem(STORAGE_KEYS.tickets));
    },
    savePayments(payments) {
      storage.setItem(STORAGE_KEYS.payments, JSON.stringify(payments));
    },
    saveTickets(tickets) {
      storage.setItem(STORAGE_KEYS.tickets, JSON.stringify(tickets));
    },
    appendAudit(entry) {
      const auditLog = safeParseArray(storage.getItem(STORAGE_KEYS.audit));
      auditLog.push(entry);
      storage.setItem(STORAGE_KEYS.audit, JSON.stringify(auditLog));
    }
  };
}

export function generateId(randomUUIDFn) {
  if (typeof randomUUIDFn === "function") {
    return randomUUIDFn();
  }

  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function recordAuditSafely(adapter, payload) {
  try {
    adapter.appendAudit(payload);
  } catch {
    // Audit failures should not block user-visible behavior.
  }
}

function paymentFingerprint(input) {
  return [
    normalizeEmail(input.attendee_email),
    normalizeText(input.ticket_tier).toLowerCase(),
    normalizeText(input.card_last4),
    String(Number(input.amount))
  ].join("|");
}

function isRegistered(attendeeEmail, registrations) {
  return registrations.some((entry) => normalizeEmail(entry?.email) === attendeeEmail);
}

export function payForAttendanceAndReceiveTicket(input, options = {}) {
  if (!options.adapter) {
    throw new Error("payForAttendanceAndReceiveTicket requires an adapter option.");
  }

  const nowProvider = typeof options.nowProvider === "function" ? options.nowProvider : () => new Date().toISOString();
  const nowIso = nowProvider();

  const auditBase = {
    requested_at: nowIso,
    attendee_email: normalizeEmail(input?.attendee_email)
  };

  const validationErrors = validatePayForAttendanceInput(input);
  if (validationErrors.length > 0) {
    recordAuditSafely(options.adapter, {
      ...auditBase,
      status: "validation_failed",
      errors: validationErrors
    });

    return {
      status: "validation_failed",
      message: "Validation failed.",
      errors: validationErrors
    };
  }

  let registrations;
  let payments;
  let tickets;
  try {
    registrations = options.adapter.loadRegistrations();
    payments = options.adapter.loadPayments();
    tickets = options.adapter.loadTickets();
  } catch (error) {
    const serviceError = buildValidationError(
      "system",
      "service_unavailable",
      "Payment service is unavailable. Please retry later."
    );

    recordAuditSafely(options.adapter, {
      ...auditBase,
      status: "service_unavailable",
      error: String(error?.message ?? error)
    });

    return {
      status: "service_unavailable",
      message: "Service unavailable. Please retry later.",
      errors: [serviceError]
    };
  }

  const attendeeEmail = normalizeEmail(input.attendee_email);
  if (!isRegistered(attendeeEmail, registrations)) {
    const registrationError = buildValidationError(
      "attendee_email",
      "not_registered",
      "Attendee registration is required before payment."
    );

    recordAuditSafely(options.adapter, {
      ...auditBase,
      status: "validation_failed",
      errors: [registrationError]
    });

    return {
      status: "validation_failed",
      message: "Validation failed.",
      errors: [registrationError]
    };
  }

  const fingerprint = paymentFingerprint(input);
  const duplicatePayment = payments.find((payment) => payment.fingerprint === fingerprint);
  if (duplicatePayment) {
    const existingTicket = tickets.find((ticket) => ticket.payment_id === duplicatePayment.id);

    recordAuditSafely(options.adapter, {
      ...auditBase,
      status: "success",
      duplicate_of: duplicatePayment.id
    });

    return {
      status: "success",
      message: "Payment already processed.",
      errors: [],
      payment_id: duplicatePayment.id,
      ticket_id: existingTicket?.id ?? null
    };
  }

  const paymentRecord = {
    id: generateId(options.idProvider),
    attendee_email: attendeeEmail,
    ticket_tier: normalizeText(input.ticket_tier).toLowerCase(),
    amount: Number(input.amount),
    card_last4: normalizeText(input.card_last4),
    fingerprint,
    paid_at: nowIso
  };

  const ticketRecord = {
    id: generateId(options.ticketIdProvider),
    attendee_email: attendeeEmail,
    ticket_tier: paymentRecord.ticket_tier,
    payment_id: paymentRecord.id,
    issued_at: nowIso
  };

  try {
    options.adapter.savePayments([...payments, paymentRecord]);
    options.adapter.saveTickets([...tickets, ticketRecord]);

    recordAuditSafely(options.adapter, {
      ...auditBase,
      status: "success",
      payment_id: paymentRecord.id,
      ticket_id: ticketRecord.id
    });

    return {
      status: "success",
      message: "Payment processed and ticket issued.",
      errors: [],
      payment_id: paymentRecord.id,
      ticket_id: ticketRecord.id
    };
  } catch (error) {
    const storageError = buildValidationError(
      "system",
      "storage_failed",
      "Could not complete payment processing. Please retry."
    );

    recordAuditSafely(options.adapter, {
      ...auditBase,
      status: "storage_failed",
      error: String(error?.message ?? error)
    });

    return {
      status: "storage_failed",
      message: "Storage failure. Please retry.",
      errors: [storageError]
    };
  }
}

export function clearPayForAttendanceErrorState(elements) {
  elements.summary.textContent = "";
  elements.summary.hidden = true;

  for (const fieldKey of [
    "attendee_email",
    "ticket_tier",
    "card_last4",
    "amount",
    "registration_open",
    "payment_gateway_ready",
    "payment_approved",
    "email_delivery_ready"
  ]) {
    elements.fieldErrors[fieldKey].textContent = "";
    elements.fieldErrors[fieldKey].hidden = true;
  }
}

export function renderPayForAttendanceErrorState(errors, elements) {
  clearPayForAttendanceErrorState(elements);

  if (!errors.length) {
    return;
  }

  elements.summary.hidden = false;
  elements.summary.textContent = errors.map((error) => error.message).join(" ");

  for (const error of errors) {
    if (Object.prototype.hasOwnProperty.call(elements.fieldErrors, error.field)) {
      elements.fieldErrors[error.field].textContent = error.message;
      elements.fieldErrors[error.field].hidden = false;
    }
  }
}

export function showPayForAttendanceSuccessView(result, elements) {
  elements.formContainer.hidden = true;
  elements.successContainer.hidden = false;
  elements.successMessage.textContent = "Payment processed and ticket issued.";
  elements.ticketMessage.textContent = `Ticket ID: ${result.ticket_id}`;
}

export function initPayForAttendanceAndReceiveTicketApp(options = {}) {
  const doc = options.document ?? (typeof document !== "undefined" ? document : null);
  if (!doc) {
    return null;
  }

  const form = doc.getElementById("pay-attendance-form");
  if (!form) {
    return null;
  }

  const storage =
    options.storage ??
    (typeof window !== "undefined" && window.localStorage ? window.localStorage : null);

  const adapter = options.adapter ?? createPayForAttendanceStorageAdapter(storage);

  const elements = {
    formContainer: doc.getElementById("pay-attendance-form-container"),
    successContainer: doc.getElementById("pay-attendance-success-container"),
    successMessage: doc.getElementById("pay-attendance-success-message"),
    ticketMessage: doc.getElementById("pay-attendance-ticket-message"),
    summary: doc.getElementById("pay-attendance-error-summary"),
    fieldErrors: {
      attendee_email: doc.getElementById("pay-attendance-email-error"),
      ticket_tier: doc.getElementById("pay-attendance-tier-error"),
      card_last4: doc.getElementById("pay-attendance-card-error"),
      amount: doc.getElementById("pay-attendance-amount-error"),
      registration_open: doc.getElementById("pay-attendance-registration-error"),
      payment_gateway_ready: doc.getElementById("pay-attendance-gateway-error"),
      payment_approved: doc.getElementById("pay-attendance-payment-error"),
      email_delivery_ready: doc.getElementById("pay-attendance-email-delivery-error")
    },
    inputs: {
      attendee_email: doc.getElementById("pay-attendance-email"),
      ticket_tier: doc.getElementById("pay-attendance-tier"),
      card_last4: doc.getElementById("pay-attendance-card-last4"),
      amount: doc.getElementById("pay-attendance-amount"),
      registration_open: doc.getElementById("pay-attendance-registration-open"),
      payment_gateway_ready: doc.getElementById("pay-attendance-gateway-ready"),
      payment_approved: doc.getElementById("pay-attendance-payment-approved"),
      email_delivery_ready: doc.getElementById("pay-attendance-email-delivery-ready")
    }
  };

  const onSubmit = (event) => {
    event?.preventDefault?.();

    const payload = {
      attendee_email: elements.inputs.attendee_email.value,
      ticket_tier: elements.inputs.ticket_tier.value,
      card_last4: elements.inputs.card_last4.value,
      amount: elements.inputs.amount.value,
      registration_open: elements.inputs.registration_open.checked,
      payment_gateway_ready: elements.inputs.payment_gateway_ready.checked,
      payment_approved: elements.inputs.payment_approved.checked,
      email_delivery_ready: elements.inputs.email_delivery_ready.checked
    };

    const result = payForAttendanceAndReceiveTicket(payload, { adapter });

    if (result.status === "success") {
      clearPayForAttendanceErrorState(elements);
      showPayForAttendanceSuccessView(result, elements);
      form.reset();
      return result;
    }

    renderPayForAttendanceErrorState(result.errors, elements);
    return result;
  };

  form.addEventListener("submit", onSubmit);
  return { form, onSubmit, adapter, elements };
}
