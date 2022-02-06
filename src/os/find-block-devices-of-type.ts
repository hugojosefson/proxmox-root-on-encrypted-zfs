import { ensureSuccessfulStdOut } from "./exec.ts";
import { ROOT } from "./user/root.ts";

export async function findBlockDevicesOfType(
  type: string,
): Promise<Array<string>> {
  const lsblk: string =
    `lsblk --paths --nodeps --noheadings --output NAME,TYPE`;
  const awk: string = `awk '/ ${type}$/{print $1}'`;
  const cmd = ["sh", "-c", `${lsblk} | ${awk}`];
  const stdout: string = await ensureSuccessfulStdOut(ROOT, cmd);
  return stdout.split("\n");
}
