# Iterified

`iterified` converts any callback-style sequence of zero or more values into an equivalent async iterable equivalent. With this, you can take advantage of all the language features and semantics of async iterables, such as playing well with `async`-`await` and `for`-`await`-`of` looping, streamlined error handling with `try-catch` and encapsulatation of resource clean up - for any kind of an asynchronous value stream.

By being able to express any thing as an async iterable, it can further be supercharged easily using the growing number of available iterable utilities, such as [iter-tools](https://github.com/iter-tools/iter-tools), [IxJs](https://github.com/ReactiveX/IxJS) and many more.

This concept of interface resembles and is inspired by the [native `Promise` constructor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/Promise) syntax, as well as [RxJS's plain `Observable` constructor](https://rxjs.dev/guide/observable).

### Quick usage

```ts
import { iterified } from 'iterified';

(async () => {
  const iter = iterified((next, error) => {
    // calling `next(...)` makes the iterable yield a value.
    // calling `error(...)` makes the iterable error out and close.
    someCallbackAcceptingOperation(next, error);
  });

  try {
    for await (const value of iter) {
      console.log(value);
    }
  } catch (err) {
    console.error(err);
  }
})();
```

## Examples

```ts
import { iterified } from 'iterified';
import redis from 'redis';

const channelsToSubscribe = ['my-channel-1', 'my-channel-2'];

const redisChannelMessages = iterified(async (next, done, error) => {
  const messageHandler = (channel, message) => next({ channel, message });

  const currentSubscribedChannelsCount = await redis.subscribe(...channelsToSubscribe);
  redis.on('message', messageHandler);

  return async () => {
    await redis.unsubscribe(...channelsToSubscribe);
    messageHandler.off(messageHandler);
  };
});

(async () => {
  for await (const { channel, message } of redisChannelMessages) {
    console.log(`Received ${message} from ${channel}`);
  }
})();
```
