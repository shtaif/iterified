import { type Iterified } from './iterified';
import { createMulticastChannel } from './utils/createMulticastChannel';

export { iterifiedUnwrapped, type IterifiedUnwrapped };

function iterifiedUnwrapped<TNext>(): IterifiedUnwrapped<TNext, void | undefined> {
  const channel = createMulticastChannel<TNext>();

  return {
    iterable: {
      [Symbol.asyncIterator]() {
        const channelIterator = channel[Symbol.asyncIterator]();
        return {
          next: async () => channelIterator.next(),
          return: async () => channelIterator.return(),
        };
      },
    },
    next: (nextValue: TNext): void => {
      channel.put(nextValue);
    },
    done: (): void => {
      channel.close();
    },
    error: (errValue: unknown): void => {
      channel.error(errValue);
    },
  };
}

type IterifiedUnwrapped<TNextValue, TDoneValue> = {
  iterable: Iterified<TNextValue, TDoneValue>;
  next: (nextValue: TNextValue) => void;
  done: (returnValue: TDoneValue) => void;
  error: (error?: unknown) => void;
};
