import { ensureSuccessfulStdOut } from "./exec.ts";
import { ROOT } from "./user/root.ts";
import { memoize, PasswdEntry } from "../deps.ts";
import { config } from "../config.ts";
import { mapAsync } from "../fn.ts";
import { usageAndThrow } from "../usage.ts";

function findIdsCmd(targetDevice: string): string {
  const targetDeviceRegex = targetDevice.replaceAll("/", "\\/");
  return `find /dev/disk/by-id/ -type l -exec echo -ne "{}\\t" \\; -exec readlink -f {} \\; | awk -F $'\\t' '/\\t${targetDeviceRegex}$/{print $1}'`;
}

async function readLinkF(asUser: PasswdEntry, path: string): Promise<string> {
  return await ensureSuccessfulStdOut(asUser, ["readlink", "-f", path]);
}

async function findIds(targetDevice: string): Promise<string[]> {
  const actualTargetDevice = await readLinkF(ROOT, targetDevice);
  const cmd = findIdsCmd(actualTargetDevice);
  const output = await ensureSuccessfulStdOut(ROOT, [
    "bash",
    `-euo`,
    `pipefail`,
    "-c",
    cmd,
  ]);
  const lines = output
    .split("\n")
    .filter((line) => line.length > 0);
  const tuples = lines.map((line: string) => line.split("\t"));
  const idLinks = tuples.map((tuple) => tuple[0]);
  if (idLinks.length === 0) {
    usageAndThrow(
      new Error(
        `Could not find corresponding /dev/disk/by-id/* device for "${targetDevice}".`,
      ),
    );
  }
  return idLinks;
}

async function lookupDisks(disks: string[]): Promise<string[]> {
  const idsForEachDisk: string[][] = await mapAsync(findIds, disks);
  return await mapAsync(longestString, idsForEachDisk);
}

async function _getDisks(): Promise<string[]> {
  return await lookupDisks(config.DISKS);
}

export const getDisks: typeof _getDisks = memoize(_getDisks);

export async function getFirstDisk(): Promise<string> {
  const disks: string[] = await getDisks();
  return disks[0];
}

export async function getDisksExceptFirst(): Promise<string[]> {
  const disks = await getDisks();
  return disks.slice(1);
}

function longestString(strings: string[]): string {
  return strings.reduce((longestSoFar, currentString) => {
    if (currentString.length > longestSoFar.length) {
      return currentString;
    }
    return longestSoFar;
  }, "");
}
