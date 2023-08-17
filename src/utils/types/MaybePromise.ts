export { type MaybePromise };

type MaybePromise<T> = T | Promise<T>;
