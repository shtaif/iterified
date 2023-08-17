import { type MaybePromise } from './types/MaybePromise';

export default intoCallableOnceAtATime;

function intoCallableOnceAtATime<
  TFunc extends (...args: unknown[]) => MaybePromise<unknown>,
>(
  targetFn: TFunc
): (...args: Parameters<TFunc>) => MaybePromise<Awaited<ReturnType<TFunc>>> {
  let deferProm: Promise<void> | undefined;

  function resetDeferPromIfLast(thisDeferProm: Promise<void>): void {
    if (deferProm === thisDeferProm) {
      deferProm = undefined;
    }
  }

  function defer(fn: () => MaybePromise<unknown>) {
    if (!deferProm) {
      const result: any = fn();

      if (!result.then) {
        return result;
      }

      const thisDeferProm = result.then(() => {
        resetDeferPromIfLast(thisDeferProm);
        return result;
      });

      return (deferProm = thisDeferProm);
    } else {
      const thisDeferProm = deferProm.then(() => {
        const result: any = fn();

        if (!result.then) {
          resetDeferPromIfLast(thisDeferProm);
          return result;
        }

        return result.then(() => {
          resetDeferPromIfLast(thisDeferProm);
          return result;
        });

        // return (result.then ?? (val => val))(() => {
        //   resetDeferPromIfLast(thisDeferProm);
        //   return result;
        // });
      });

      return (deferProm = thisDeferProm);
    }
  }

  return (...args) => defer(() => targetFn(...args));
}
