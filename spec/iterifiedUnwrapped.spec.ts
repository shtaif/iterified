import 'mocha';
import expect from 'expect';
import { iterifiedUnwrapped } from '../src';
import getPromiseState from './utils/getPromiseState';
import collectAsyncIterable from './utils/collectAsyncIterable';

describe('`iterifiedUnwrapped` function', () => {
  it('generating a single value and consuming via multiple iterators', async () => {
    const { iterable, next } = iterifiedUnwrapped<string>();

    const it1 = iterable[Symbol.asyncIterator]();
    const it2 = iterable[Symbol.asyncIterator]();

    next('value');

    const it1Item = await it1.next();
    const it2Item = await it2.next();

    expect([it1Item, it2Item]).toStrictEqual([
      { done: false, value: 'value' },
      { done: false, value: 'value' },
    ]);
  });

  it('multiple values generated get queued in order for each iterator individually until consumed', async () => {
    const { iterable, next } = iterifiedUnwrapped<string>();

    const it1 = iterable[Symbol.asyncIterator]();
    const it2 = iterable[Symbol.asyncIterator]();

    next('value_1');
    next('value_2');
    next('value_3');

    const it1Items = [await it1.next(), await it1.next(), await it1.next()];
    const it2Items = [await it2.next(), await it2.next(), await it2.next()];

    expect([it1Items, it2Items]).toStrictEqual([
      [
        { done: false, value: 'value_1' },
        { done: false, value: 'value_2' },
        { done: false, value: 'value_3' },
      ],
      [
        { done: false, value: 'value_1' },
        { done: false, value: 'value_2' },
        { done: false, value: 'value_3' },
      ],
    ]);
  });

  it('iterable that generates one value and ends consumed via multiple iterators', async () => {
    const { iterable, next, done } = iterifiedUnwrapped<string>();

    const it1 = iterable[Symbol.asyncIterator]();
    const it2 = iterable[Symbol.asyncIterator]();

    next('value');
    done();

    const it1Items = [await it1.next(), await it1.next()];
    const it2Items = [await it2.next(), await it2.next()];

    expect([it1Items, it2Items]).toStrictEqual([
      [
        { done: false, value: 'value' },
        { done: true, value: undefined },
      ],
      [
        { done: false, value: 'value' },
        { done: true, value: undefined },
      ],
    ]);
  });

  it('iterable that ends immediately without generating values consumed via multiple iterators', async () => {
    const { iterable, done } = iterifiedUnwrapped();

    const it1 = iterable[Symbol.asyncIterator]();
    const it2 = iterable[Symbol.asyncIterator]();

    done();

    const it1Item = await it1.next();
    const it2Item = await it2.next();

    expect([it1Item, it2Item]).toStrictEqual([
      { done: true, value: undefined },
      { done: true, value: undefined },
    ]);
  });

  it('iterators from the same iterable obtained at different points in time will pick up only values generated from the time they were obtained and onwards respectively', async () => {
    const { iterable, next, done } = iterifiedUnwrapped<number>();

    const it1 = iterable[Symbol.asyncIterator]();
    next(1), next(2);
    const it2 = iterable[Symbol.asyncIterator]();
    next(3), next(4);
    const it3 = iterable[Symbol.asyncIterator]();
    next(5), next(6);
    const it4 = iterable[Symbol.asyncIterator]();
    done();

    const [it1ValuesCaught, it2ValuesCaught, it3ValuesCaught, it4ValuesCaught] = [
      await collectAsyncIterable({ [Symbol.asyncIterator]: () => it1 }),
      await collectAsyncIterable({ [Symbol.asyncIterator]: () => it2 }),
      await collectAsyncIterable({ [Symbol.asyncIterator]: () => it3 }),
      await collectAsyncIterable({ [Symbol.asyncIterator]: () => it4 }),
    ];

    expect([
      it1ValuesCaught,
      it2ValuesCaught,
      it3ValuesCaught,
      it4ValuesCaught,
    ]).toStrictEqual([[1, 2, 3, 4, 5, 6], [3, 4, 5, 6], [5, 6], []]);
  });

  it('when pulling one or move values out of iterators before they any were yet generated, the returned pending promises will resolve one by one in the order they were pulled as each consecutive value becomes available', async () => {
    const { iterable, next } = iterifiedUnwrapped<string>();

    const iterator = iterable[Symbol.asyncIterator]();

    const valPromises = [iterator.next(), iterator.next()];

    const promiseStatesBeforePush1 = await Promise.all(valPromises.map(getPromiseState));
    next('value_1');
    const promiseStatesBeforePush2 = await Promise.all(valPromises.map(getPromiseState));
    next('value_2');

    const emitted = await Promise.all(valPromises);

    expect([promiseStatesBeforePush1, promiseStatesBeforePush2]).toStrictEqual([
      ['PENDING', 'PENDING'],
      ['RESOLVED', 'PENDING'],
    ]);
    expect(emitted).toStrictEqual([
      { done: false, value: 'value_1' },
      { done: false, value: 'value_2' },
    ]);
  });

  it('consecutive pulls from iterable that was ended will always return a "done" result', async () => {
    const { iterable, done } = iterifiedUnwrapped<string>();

    const it = iterable[Symbol.asyncIterator]();

    done();

    it.next();
    const item1 = await it.next();
    const item2 = await it.next();

    expect([item1, item2]).toStrictEqual([
      { done: true, value: undefined },
      { done: true, value: undefined },
    ]);
  });

  it('consecutive pulls from iterable that had errored will always return a "done" result', async () => {
    const { iterable, error } = iterifiedUnwrapped<string>();

    error(new Error('oops...'));

    const it = iterable[Symbol.asyncIterator]();

    it.next();
    const item1 = await it.next();
    const item2 = await it.next();

    expect([item1, item2]).toStrictEqual([
      { done: true, value: undefined },
      { done: true, value: undefined },
    ]);
  });

  it('whenever an iterator is closed, it immediately resolves every pending promise pulled beforehand specifically from it to a "done" result', async () => {
    {
      const { iterable } = iterifiedUnwrapped<string>();

      const iterator1 = iterable[Symbol.asyncIterator]();
      const iterator2 = iterable[Symbol.asyncIterator]();

      const [iterator1Promise1, iterator1Promise2, iterator2Promise1, iterator2Promise2] =
        [iterator1.next(), iterator1.next(), iterator2.next(), iterator2.next()];

      await iterator1.return();

      const promiseStatusesAfterIterator1Close = await Promise.all([
        getPromiseState(iterator1Promise1),
        getPromiseState(iterator1Promise2),
        getPromiseState(iterator2Promise1),
        getPromiseState(iterator2Promise2),
      ]);

      await iterator2.return();

      const promiseStatusesAfterIterator2Close = await Promise.all([
        getPromiseState(iterator1Promise1),
        getPromiseState(iterator1Promise2),
        getPromiseState(iterator2Promise1),
        getPromiseState(iterator2Promise2),
      ]);

      expect(promiseStatusesAfterIterator1Close).toStrictEqual([
        'RESOLVED',
        'RESOLVED',
        'PENDING',
        'PENDING',
      ]);
      expect(promiseStatusesAfterIterator2Close).toStrictEqual([
        'RESOLVED',
        'RESOLVED',
        'RESOLVED',
        'RESOLVED',
      ]);
      expect(
        await Promise.all([
          iterator1Promise1,
          iterator1Promise2,
          iterator2Promise1,
          iterator2Promise2,
        ])
      ).toStrictEqual([
        { done: true, value: undefined },
        { done: true, value: undefined },
        { done: true, value: undefined },
        { done: true, value: undefined },
      ]);
    }
  });
});
