# Iterified

...

```ts
import { asyncIterify } from 'asyncIterify';
import redis from 'redis';

const channelsToSubscribe = ['my-channel-1', 'my-channel-2'];

const redisChannelMessages = asyncIterify(async (next, done, error) => {
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
