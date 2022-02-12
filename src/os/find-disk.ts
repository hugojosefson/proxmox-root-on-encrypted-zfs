import { findBlockDevicesOfType } from "./find-block-devices-of-type.ts";
import { ensureSuccessfulStdOut } from "./exec.ts";
import { ROOT } from "./user/root.ts";
import { memoize } from "../deps.ts";

async function _findDisk(): Promise<string> {
  function findIdsCmd(targetDevice: string) {
    const targetDeviceRegex = targetDevice.replaceAll("/", "\\/");
    return `find /dev/disk/by-id/ -type l -exec echo -ne "{}\\t" \\; -exec readlink -f {} \\; | awk -F $'\\t' '/\\t${targetDeviceRegex}$/{print $1}'`;
  }

  const disks: Array<string> = await findBlockDevicesOfType("disk");
  const disksById: string[] = await Promise.all(
    disks
      .map(findIdsCmd)
      .map((cmd) => ensureSuccessfulStdOut(ROOT, ["sh", "-c", cmd]))
      .map(async (outputPromise) =>
        (await outputPromise).split("\n").filter((line) => line.length > 0)
      )
      .map(async (linesPromise: Promise<string[]>) =>
        (await linesPromise).map((line: string) => line.split("\t"))
      )
      .map(async (tuplesPromise) =>
        (await tuplesPromise).map((tuple) => tuple[0])
      )
      .map(async (idLinks) => longestString(await idLinks)),
  );
  if (disksById.length > 1) {
    throw new Error(
      `Too many disks to choose from! Please specify one with environment DISK=/dev/disk/by-id/...`,
    );
  }
  if (disksById.length < 1) {
    throw new Error(
      `Could not find one single disk. Please specify it with environment DISK=/dev/disk/by-id/...`,
    );
  }
  return disksById[0];
}

const findDisk: typeof _findDisk = memoize(_findDisk);

export async function getDisk(): Promise<string> {
  return Deno.env.get("DISK") ?? await findDisk();
}

function longestString(strings: string[]): string {
  return strings.reduce((longestSoFar, currentString) => {
    if (currentString.length > longestSoFar.length) {
      return currentString;
    }
    return longestSoFar;
  }, "");
}
