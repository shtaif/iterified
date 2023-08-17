export default getPromiseState;

async function getPromiseState(
  inputPromise: Promise<unknown>
): Promise<NamedPromiseStatus> {
  let promiseStatus: NamedPromiseStatus = 'PENDING';

  (async () => {
    promiseStatus = await inputPromise.then(
      () => {
        // debugger;
        return 'RESOLVED';
      },
      () => {
        // debugger;
        return 'REJECTED';
      }
    );
  })();

  await new Promise(resolve => setTimeout(resolve, 0));

  // debugger;

  return promiseStatus;
}

type NamedPromiseStatus = 'PENDING' | 'RESOLVED' | 'REJECTED';
