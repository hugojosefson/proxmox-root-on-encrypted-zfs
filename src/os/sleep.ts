export async function sleep(seconds: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, seconds * 1000);
  });
}
