export class NoRoutePathError extends Error {
  date: Date = new Date();

  constructor() {
    super('No root path to store and collect configuration file.');

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NoRoutePathError);
    }

    this.name = 'NoRoutePathError';
  }
}
