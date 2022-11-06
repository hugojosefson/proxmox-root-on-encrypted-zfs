import { Command } from "../model/command.ts";
import {
  ensureSuccessful,
  ensureSuccessfulStdOut,
  isSuccessful,
} from "../os/exec.ts";
import { config } from "../config.ts";
import { debian1PrepareInstallEnv } from "./debian-1-prepare-install-env.ts";
import { FileSystemPath } from "../model/dependency.ts";
import { ROOT } from "../os/user/root.ts";
import { getDisks } from "../os/find-disk.ts";
import { pascalCase } from "https://deno.land/x/case@v2.1.0/mod.ts";
import {
  isDeferred,
  isPromise,
  mapAsync,
  resolveValue,
  Stringish,
} from "../fn.ts";
import { defer, Deferred } from "../os/defer.ts";

type PartitionNumber = 1 | 2 | 3 | 4 | 5;
type PartitionType = "EF00" | "BF00" | "BF01";
const PARTITION_TYPE = {
  EFI: "EF00",
  "ZFS_BOOT": "BF00",
  "ZFS_OTHER": "BF01",
} as const;
type Offset = "0" | "1M";
type PartitionSize = Stringish | Deferred<string>;

async function resolvePartitionSize(
  partitionSize: PartitionSize,
): Promise<string> {
  if (isDeferred(partitionSize)) {
    return "0";
  }
  if (typeof partitionSize === "string" || isPromise(partitionSize)) {
    const resolved: string = await resolveValue(partitionSize);
    const asNumber = Number(resolved);
    if (!isNaN(asNumber)) {
      return `+${Math.trunc(asNumber / 1024)}K`;
    }
    return resolved;
  }
  throw new Error(
    `size was neither Deferred, Promise, nor string: ${
      JSON.stringify(partitionSize)
    }`,
  );
}

function partition(
  disk: string,
  partitionNumber: PartitionNumber,
  type: PartitionType = PARTITION_TYPE.ZFS_OTHER,
  partitionSize: PartitionSize,
  name: string | undefined = type === PARTITION_TYPE.EFI
    ? "efi"
    : (type === PARTITION_TYPE.ZFS_BOOT ? "boot" : undefined),
  offset: Offset = type === PARTITION_TYPE.EFI ? "1M" : "0",
) {
  try {
    const commandNameSuffix = typeof name === "string"
      ? pascalCase(name)
      : (typeof type === "undefined" ? "" : pascalCase(`${type}`));
    const commandName = `zfsPartition${partitionNumber}${commandNameSuffix}`;
    const partitionPath = `${disk}-part${partitionNumber}`;
    const command: Command = Command.custom(commandName)
      .withLocks([FileSystemPath.of(ROOT, disk)])
      .withDependencies([debian1PrepareInstallEnv])
      .withSkipIfAll([
        () => isSuccessful(ROOT, ["bash", "-ec", `[ -e ${partitionPath} ]`]),
      ])
      .withRun(async () => {
        const resolvedPartitionSize = await resolvePartitionSize(partitionSize);
        await ensureSuccessful(ROOT, [
          "sgdisk",
          `-n`,
          `${partitionNumber}:${offset}:${resolvedPartitionSize}`,
          `-t`,
          `${partitionNumber}:${type}`,
          disk,
        ]);
        await ensureSuccessful(ROOT, ["sleep", "5"]);
        if (isDeferred(partitionSize)) {
          partitionSize.resolve(await getDiskSize(partitionPath));
        }
      });
    command.done.finally(async () => {
      if (isDeferred(partitionSize) && !partitionSize.isDone) {
        partitionSize.resolve(await getDiskSize(partitionPath));
      }
    });
    return command;
  } catch (e) {
    if (isDeferred(partitionSize) && !partitionSize.isDone) {
      partitionSize.reject(e);
    }
    throw e;
  }
}

async function getDiskSize(disk: string): Promise<number> {
  const cmd = ["fdisk", "-l", "--bytes", disk];
  const output = await ensureSuccessfulStdOut(ROOT, cmd);
  const regex = /\b([0-9]+) bytes\b/;
  const matches = output.match(regex);
  if (matches === null) {
    throw new Error(
      `ERROR: Could not figure out the size of disk ${disk}.\nNo match (#1) for ${regex} found in: ${output}`,
    );
  }
  const match = matches[1];
  if (typeof match === "undefined") {
    throw new Error(
      `ERROR: Could not figure out the size of disk ${disk}.\nNo match (#2) for ${regex} found in: ${output}`,
    );
  }
  return Number(match);
}

interface DiskAndSize {
  disk: string;
  size: number;
}

const NO_SMALLEST_DISK_FOUND: DiskAndSize = {
  disk: "NO_SMALLEST_DISK_FOUND",
  size: Number.MAX_SAFE_INTEGER,
} as const;

console.log(`-----------------------------------------------1==========`);
const disks: string[] = await getDisks();
console.log({ disks });

console.log(`-----------------------------------------------2==========`);
const disksAndSizes: readonly DiskAndSize[] = await mapAsync(
  async (disk) => ({ disk, size: await getDiskSize(disk) }) as DiskAndSize,
  disks,
);
console.log({ disksAndSizes });

console.log(`-----------------------------------------------3==========`);
const smallestDiskAndSize: DiskAndSize = disksAndSizes.reduce(
  (smallestSoFar, compared) =>
    compared.size < smallestSoFar.size ? compared : smallestSoFar,
  NO_SMALLEST_DISK_FOUND,
);
console.log({ smallestDiskAndSize });

console.log(`-----------------------------------------------4==========`);
if (smallestDiskAndSize === NO_SMALLEST_DISK_FOUND) {
  throw new Error(
    `ERROR: No smallest disk found. The disks were: ${disks.toString()}`,
  );
}

console.log(`-----------------------------------------------5==========`);
const largerDisks = disks.filter((disk) => disk !== smallestDiskAndSize.disk);
console.log({ largerDisks });

console.log(`-----------------------------------------------6==========`);
export const zfsPartition2Efi = Command.custom("zfsPartition2Efi")
  .withDependencies(
    disks.map((disk) =>
      partition(
        disk,
        2,
        PARTITION_TYPE.EFI,
        "+5G",
      )
    ),
  );

console.log(`-----------------------------------------------7==========`);
export const zfsPartition3Boot = Command.custom("zfsPartition3Boot")
  .withDependencies(
    disks.map((disk) =>
      partition(
        disk,
        3,
        PARTITION_TYPE.ZFS_BOOT,
        "+5G",
        `boot on ${disk}`,
      )
        .withDependencies([zfsPartition2Efi])
    ),
  );

/**
 * TODO: after partitioning root, if there is space remaining on at least two drives,
 * TODO: fill out the smallest disk.
 * TODO: get the size of that partition.
 * TODO: partition all other disks that size as BF01 for possible tank, or tank special vdev.
 */

console.log(`-----------------------------------------------8==========`);
const rootPartitionSize: Deferred<string> = defer<string>();

console.log(`-----------------------------------------------9==========`);
const zfsSmallestPartition4Root = partition(
  smallestDiskAndSize.disk,
  4,
  PARTITION_TYPE.ZFS_OTHER,
  rootPartitionSize,
  `rootSmallest`,
)
  .withDependencies([zfsPartition3Boot]);

console.log(`----------------------------------------------10==========`);
export const zfsPartition4Root = Command.custom("zfsPartition4Root")
  .withDependencies(
    largerDisks.map((disk) =>
      partition(
        disk,
        4,
        PARTITION_TYPE.ZFS_OTHER,
        rootPartitionSize.promise,
        `root on ${disk}`,
      )
        .withDependencies([zfsSmallestPartition4Root])
    ),
  );

console.log(`----------------------------------------------11==========`);
export const zfsPartitions = Command.custom("zfsPartitions")
  .withDependencies([
    debian1PrepareInstallEnv,
    zfsPartition4Root,
  ]);

console.log(`----------------------------------------------12==========`);
export const zfsBootPool = Command.custom("zfsBootPool")
  .withLocks(disks.map((disk) => FileSystemPath.of(ROOT, disk)))
  .withDependencies([
    debian1PrepareInstallEnv,
    zfsPartitions,
    zfsPartition3Boot,
  ])
  .withSkipIfAll([
    () =>
      ensureSuccessful(ROOT, `zpool list bpool`.split(" ")).then(() => true),
  ])
  .withRun(async () => {
    await ensureSuccessful(ROOT, [
      "zpool",
      "create",
      "-d",
      ...[
        "cachefile=/etc/zfs/zpool.cache",
        "ashift=12",
        "autotrim=on",
        ...[
          "async_destroy",
          "bookmarks",
          "embedded_data",
          "empty_bpobj",
          "enabled_txg",
          "extensible_dataset",
          "filesystem_limits",
          "hole_birth",
          "large_blocks",
          "livelist",
          "lz4_compress",
          "spacemap_histogram",
          "zpool_checkpoint",
        ].map((feature) => `feature@${feature}=enabled`),
      ].flatMap(
        (option) => ["-o", option],
      ),
      ...[
        "acltype=posixacl",
        "canmount=off",
        "compression=lz4",
        "devices=off",
        "normalization=formD",
        "relatime=on",
        "xattr=sa",
        "mountpoint=/boot",
      ].flatMap((systemOption) => ["-O", systemOption]),
      "-f",
      "-R",
      "/mnt",
      "bpool",
      "mirror",
      ...disks.map((disk) => `${disk}-part3`),
    ]);
  });

export const zfsRootPool = Command.custom("zfsRootPool")
  .withLocks(disks.map((disk) => FileSystemPath.of(ROOT, disk)))
  .withDependencies([zfsPartition4Root])
  .withSkipIfAll([
    () =>
      ensureSuccessful(ROOT, `zpool list rpool`.split(" ")).then(() => true),
  ])
  .withRun(async () => {
    await ensureSuccessful(ROOT, [
      "zpool",
      "create",
      ...[
        "ashift=12",
        "autotrim=on",
      ].flatMap(
        (option) => ["-o", option],
      ),
      ...[
        "encryption=aes-256-gcm",
        "keyformat=passphrase",
        "keylocation=prompt",
        "acltype=posixacl",
        "canmount=off",
        "compression=lz4",
        "dnodesize=auto",
        "normalization=formD",
        "relatime=on",
        "xattr=sa",
        "mountpoint=/",
      ].flatMap((systemOption) => ["-O", systemOption]),
      "-f",
      "-R",
      "/mnt",
      "rpool",
      "mirror",
      ...disks.map((disk) => `${disk}-part4`),
    ], {
      stdin:
        `${config.DISK_ENCRYPTION_PASSWORD}\n${config.DISK_ENCRYPTION_PASSWORD}\n`,
    });
  });

export const debian2DiskFormatting = Command.custom("debian2DiskFormatting")
  .withDependencies([
    debian1PrepareInstallEnv,
    zfsPartitions,
    zfsBootPool,
    zfsRootPool,
  ]);
