type DomainErrorStatus = 400 | 404 | 409 | 413 | 415;

/** A refusal the caller can act on; `app.onError` answers it as `{ error: message }` with its status. */
class DomainError extends Error {
  readonly status: DomainErrorStatus;

  constructor(status: DomainErrorStatus, message: string) {
    super(message);
    this.status = status;
  }
}

const notFound = (message = "not found"): DomainError => new DomainError(404, message);

export { DomainError, notFound };
