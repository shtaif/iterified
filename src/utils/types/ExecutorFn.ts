import { type MaybePromise } from './MaybePromise';

export { type ExecutorFn };

type ExecutorFn<TNext, TDone = void | undefined> = (
  nextCb: (nextValue: TNext) => void,
  doneCb: (returnValue: TDone) => void,
  errorCb: (error?: unknown) => void
) => MaybePromise<void | (() => MaybePromise<void>)>;
