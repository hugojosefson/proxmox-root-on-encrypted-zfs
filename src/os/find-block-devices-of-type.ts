import { runSimple } from "../deps.ts";
export async function findBlockDevicesOfType(
  type: string,
): Promise<Array<string>> {
  const lsblk = `lsblk --paths --nodeps --noheadings --output NAME,TYPE`;
  const awk = `awk '/ ${type}$/{print $1}'`;
  const cmd = [
    "bash",
    `-euo`,
    `pipefail`,
    "-c",
    `${lsblk} | ${awk}`,
  ];

  const stdout: string = await runSimple(cmd);
  return stdout.split("\n");
}
