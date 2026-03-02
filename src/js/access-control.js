const SESSION_KEY = "ece493.session";

const STORY_ACCESS_RULES = [
  {
    key: "change-password",
    formContainerId: "change-password-form-container",
    successContainerId: "change-password-success-container",
    requiredRole: null,
    label: "Change Password"
  },
  {
    key: "submit-paper",
    formContainerId: "submit-paper-form-container",
    successContainerId: "submit-paper-success-container",
    requiredRole: "author",
    label: "Submit Paper Manuscript"
  },
  {
    key: "save-draft",
    formContainerId: "save-draft-form-container",
    successContainerId: "save-draft-success-container",
    requiredRole: "author",
    label: "Save Submission Draft"
  },
  {
    key: "assign-referees",
    formContainerId: "assign-referees-form-container",
    successContainerId: "assign-referees-success-container",
    requiredRole: "editor",
    label: "Assign Referees"
  },
  {
    key: "review-invitation",
    formContainerId: "review-invitation-form-container",
    successContainerId: "review-invitation-success-container",
    requiredRole: "reviewer",
    label: "Accept/Reject Review Invitation"
  },
  {
    key: "submit-review",
    formContainerId: "submit-review-form-container",
    successContainerId: "submit-review-success-container",
    requiredRole: "reviewer",
    label: "Submit Paper Review"
  },
  {
    key: "make-final-decision",
    formContainerId: "make-final-decision-form-container",
    successContainerId: "make-final-decision-success-container",
    requiredRole: "editor",
    label: "Make Final Decision"
  }
];

function parseSession(raw) {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const email = String(parsed.email ?? "").trim();
    const role = String(parsed.role ?? "").trim();
    if (!email || !role) {
      return null;
    }

    return {
      email: email.toLowerCase(),
      role: role.toLowerCase()
    };
  } catch {
    return null;
  }
}

function getSession(storage) {
  if (!storage || typeof storage.getItem !== "function") {
    return null;
  }

  return parseSession(storage.getItem(SESSION_KEY));
}

function ensureLockCard(doc, rule, formContainer) {
  const lockCardId = `${rule.key}-access-locked`;
  const existing = doc.getElementById(lockCardId);
  if (existing) {
    return existing;
  }

  if (!formContainer || typeof formContainer.insertAdjacentElement !== "function") {
    return null;
  }

  const lockCard = doc.createElement("section");
  lockCard.id = lockCardId;
  lockCard.className = "card access-locked";
  lockCard.hidden = true;

  const title = doc.createElement("h2");
  title.textContent = `${rule.label} Locked`;

  const message = doc.createElement("p");
  message.className = "helper";
  message.id = `${lockCardId}-message`;

  lockCard.append(title, message);
  formContainer.insertAdjacentElement("afterend", lockCard);
  return lockCard;
}

function lockCardMessage(lockCard, rule) {
  if (!lockCard || !Array.isArray(lockCard.children)) {
    return null;
  }

  return lockCard.children.find((child) => child?.id === `${rule.key}-access-locked-message`) ?? null;
}

function lockMessage(rule, session) {
  if (!session) {
    return `Log in to access ${rule.label}.`;
  }

  return `${rule.label} is available only for ${rule.requiredRole}s. Logged in as ${session.role}.`;
}

function canAccess(rule, session) {
  if (!session) {
    return false;
  }

  if (!rule.requiredRole) {
    return true;
  }

  return session.role === rule.requiredRole;
}

export function applyAccessControl(doc, storage) {
  for (const rule of STORY_ACCESS_RULES) {
    const formContainer = doc.getElementById(rule.formContainerId);
    const successContainer = doc.getElementById(rule.successContainerId);

    if (!formContainer) {
      continue;
    }

    const session = getSession(storage);
    const authorized = canAccess(rule, session);

    const lockCard = ensureLockCard(doc, rule, formContainer);
    if (lockCard) {
      const message = lockCardMessage(lockCard, rule);
      if (message) {
        message.textContent = lockMessage(rule, session);
      }
      lockCard.hidden = authorized;
    }

    formContainer.hidden = !authorized;
    if (!authorized && successContainer) {
      successContainer.hidden = true;
    }
  }
}

export function initAccessControl(options = {}) {
  const doc = options.document ?? (typeof document !== "undefined" ? document : null);
  if (!doc) {
    return null;
  }

  const win = options.window ?? (typeof window !== "undefined" ? window : null);
  const storage = options.storage ?? (win && win.localStorage ? win.localStorage : null);

  if (!storage || typeof storage.getItem !== "function") {
    return null;
  }

  const update = () => applyAccessControl(doc, storage);
  update();

  if (win && typeof win.addEventListener === "function") {
    win.addEventListener("ece493:session-changed", update);
    win.addEventListener("storage", update);
  }

  return { update };
}
