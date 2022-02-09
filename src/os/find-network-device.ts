import { ensureSuccessfulStdOut } from "./exec.ts";
import { ROOT } from "./user/root.ts";

export async function findNetworkDevice(
  destination = "1.1.1.1",
): Promise<string> {
  const json = await ensureSuccessfulStdOut(ROOT, [
    "ip",
    "-json",
    "route",
    "get",
    destination,
  ]);
  const routes: Array<{ dev: string }> = JSON.parse(json);
  return routes[0].dev;
}
