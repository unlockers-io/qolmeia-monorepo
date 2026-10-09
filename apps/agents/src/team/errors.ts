abstract class TeamError extends Error {
  abstract readonly status: 400 | 404 | 409 | 500;
}

class CompanyNotFoundError extends TeamError {
  readonly status = 404;

  constructor() {
    super("company not found");
  }
}

class TemplateNotFoundError extends TeamError {
  readonly status = 404;

  constructor(templateId: string) {
    super(`template ${templateId} not found`);
  }
}

class TemplateRetiredError extends TeamError {
  readonly status = 409;

  constructor(templateId: string) {
    super(`template ${templateId} is retired`);
  }
}

class MemberNotFoundError extends TeamError {
  readonly status = 404;

  constructor() {
    super("not found");
  }
}

class MemberNotPausableError extends TeamError {
  readonly status = 409;

  constructor(role: string) {
    super(`cannot pause/resume a ${role}`);
  }
}

class InvalidDisplayNameError extends TeamError {
  readonly status = 400;

  constructor() {
    super("displayName cannot be empty");
  }
}

class CorrespondentMissingError extends TeamError {
  readonly status = 500;

  constructor() {
    super("correspondent missing from the team");
  }
}

export {
  CompanyNotFoundError,
  CorrespondentMissingError,
  InvalidDisplayNameError,
  MemberNotFoundError,
  MemberNotPausableError,
  TeamError,
  TemplateNotFoundError,
  TemplateRetiredError,
};
