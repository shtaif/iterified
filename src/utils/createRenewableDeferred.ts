export { createRenewableDeferred as default, RenewableDeferred };

function createRenewableDeferred<T = void | undefined>(): RenewableDeferred<T> {
  return new RenewableDeferred<T>();
}

class RenewableDeferred<T = void | undefined> {
  resolve!: (value: T | PromiseLike<T>) => void;
  reject!: (reason?: any) => void;
  promise: Promise<T>;

  constructor() {
    // TODO: No way to simply replace this with a call to `this.renew()`?...
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }

  renew(): Promise<T> {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
    return this.promise;
  }
}
