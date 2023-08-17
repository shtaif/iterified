export default sortPromisesByResolutionOrder;

async function sortPromisesByResolutionOrder<T>(
  promises: Promise<T>[]
): Promise<Promise<T>[]> {
  const promisesOrderedByResolution: Promise<T>[] = [];

  for (const promise of promises) {
    promise.then(() => promisesOrderedByResolution.push(promise));
  }

  await Promise.all(promises);

  return promisesOrderedByResolution;
}
