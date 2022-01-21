export class SSHTimeoutException extends Error {
  date: Date = new Date();

  constructor() {
    super('The request connection timeout. Verify your config.');

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SSHTimeoutException);
    }

    this.name = 'ConnectionTimeout';
  }
}
