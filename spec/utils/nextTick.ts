export default nextTick;

async function nextTick(): Promise<void | undefined> {
  await new Promise(resolve => process.nextTick(resolve));
}
