import { type MaybePromise } from './MaybePromise';

export { type ExecutorFn };

type ExecutorFn<TNext> = (
  nextCb: (nextValue: TNext) => void,
  doneCb: () => void,
  errorCb: (error: unknown) => void
) => MaybePromise<void | (() => MaybePromise<void>)>;
