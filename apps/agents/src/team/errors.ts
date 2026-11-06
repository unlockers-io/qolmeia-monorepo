import { DomainError } from "#/lib/errors";

class CompanyNotFoundError extends DomainError {
  constructor() {
    super(404, "company not found");
  }
}

class TemplateNotFoundError extends DomainError {
  constructor(templateId: string) {
    super(404, `template ${templateId} not found`);
  }
}

class TemplateRetiredError extends DomainError {
  constructor(templateId: string) {
    super(409, `template ${templateId} is retired`);
  }
}

class TeamNotConfirmedError extends DomainError {
  constructor() {
    super(409, "team not confirmed");
  }
}

class MemberNotFoundError extends DomainError {
  constructor() {
    super(404, "not found");
  }
}

class MemberNotPausableError extends DomainError {
  constructor(role: string) {
    super(409, `cannot pause/resume a ${role}`);
  }
}

class MemberPromptNotEditableError extends DomainError {
  constructor(role: string) {
    super(409, `cannot edit the prompt of a ${role}`);
  }
}

export {
  CompanyNotFoundError,
  MemberNotFoundError,
  MemberNotPausableError,
  MemberPromptNotEditableError,
  TeamNotConfirmedError,
  TemplateNotFoundError,
  TemplateRetiredError,
};
