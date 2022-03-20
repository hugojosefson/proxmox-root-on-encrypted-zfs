import { Command } from "../model/command.ts";
import { ensureSuccessful, ensureSuccessfulStdOut } from "../os/exec.ts";
import { config } from "../config.ts";
import { debian1PrepareInstallEnv } from "./debian-1-prepare-install-env.ts";
import { FileSystemPath } from "../model/dependency.ts";
import { ROOT } from "../os/user/root.ts";
import { existsPath } from "./common/file-commands.ts";
import { getDisks, getFirstDisk } from "../os/find-disk.ts";
import { pascalCase } from "https://deno.land/x/case@v2.1.0/mod.ts";
import { mapAsync } from "../fn.ts";

type PartitionNumber = 1 | 2 | 3 | 4 | 5;
type PartitionType = "EF00" | "BF00" | "BF01";
const PARTITION_TYPE = {
  EFI: "EF00",
  "ZFS_BOOT": "BF00",
  "ZFS_OTHER": "BF01",
} as const;
type Offset = "0" | "1M";
type PartitionSize = string | (() => (string | Promise<string>));

function resolveSize(size: PartitionSize): Promise<string> {
  if (typeof size === "string") {
    return Promise.resolve(size);
  }
  return Promise.resolve(size());
}

function partition(
  disk: string,
  partitionNumber: PartitionNumber,
  type: PartitionType = PARTITION_TYPE.ZFS_OTHER,
  size: PartitionSize = "0",
  name: string | undefined = type === PARTITION_TYPE.EFI
    ? "efi"
    : (type === PARTITION_TYPE.ZFS_BOOT ? "boot" : undefined),
  offset: Offset = type === PARTITION_TYPE.EFI ? "1M" : "0",
) {
  const commandNameSuffix = typeof name === "string"
    ? name
    : (typeof type === "undefined" ? "" : pascalCase(`${type}`));
  const commandName = `zfsPartition${partitionNumber}${commandNameSuffix}`;
  return Command.custom(commandName)
    .withLocks([FileSystemPath.of(ROOT, disk)])
    .withDependencies([debian1PrepareInstallEnv])
    .withSkipIfAll([
      async () => await existsPath(`${disk}-part${partitionNumber}`.split("/")),
    ])
    .withRun(async () => {
      await ensureSuccessful(ROOT, ["sync"]);
      await ensureSuccessful(ROOT, [
        "sgdisk",
        `--new=${partitionNumber}:${offset}:${await resolveSize(size)}`,
        `--typecode=${partitionNumber}:${type}`,
        disk,
      ]);
      await ensureSuccessful(ROOT, ["sync"]);
      await ensureSuccessful(ROOT, ["sleep", "5"]);
    });
}

async function getDiskSize(disk: string): Promise<number> {
  const cmd = ["fdisk", "-l", "--bytes", disk];
  const output = await ensureSuccessfulStdOut(ROOT, cmd);
  const firstLine = output.split("\n", 1)[0];
  if (firstLine === null) {
    throw new Error(
      `ERROR: Could not figure out the size of disk ${disk}.\nOutput of ${cmd.toString()} was:\n${output}\n`,
    );
  }
  const regex = /\b([0-9]+) bytes\b/;
  const matches = firstLine.match(regex);
  if (matches === null) {
    throw new Error(
      `ERROR: Could not figure out the size of disk ${disk}.\nNo match (#1) for ${regex} found in: ${firstLine}`,
    );
  }
  const match = matches[1];
  if (typeof match === "undefined") {
    throw new Error(
      `ERROR: Could not figure out the size of disk ${disk}.\nNo match (#2) for ${regex} found in: ${firstLine}`,
    );
  }
  return Number(match[1]);
}

interface DiskAndSize {
  disk: string;
  size: number;
}

const disks: string[] = await getDisks();

const disksAndSizes: readonly DiskAndSize[] = await mapAsync(
  async (disk) => ({ disk, size: await getDiskSize(disk) }) as DiskAndSize,
  disks,
);

const NO_SMALLEST_DISK_FOUND: DiskAndSize = {
  disk: "NO_SMALLEST_DISK_FOUND",
  size: Number.MAX_SAFE_INTEGER,
} as const;

const smallestDiskAndSize: DiskAndSize = disksAndSizes.reduce(
  (smallestSoFar, compared) =>
    compared.size < smallestSoFar.size ? compared : smallestSoFar,
  NO_SMALLEST_DISK_FOUND,
);

if (smallestDiskAndSize === NO_SMALLEST_DISK_FOUND) {
  throw new Error(
    `ERROR: No smallest disk found. The disks were: ${disks.toString()}`,
  );
}

const largerDisks = disks.filter((disk) => disk !== smallestDiskAndSize.disk);

export const zfsPartition2Efi = partition(
  await getFirstDisk(),
  2,
  PARTITION_TYPE.EFI,
  "+512M",
);

export const zfsPartition3Boot = Command.custom("zfsPartition3Boot")
  .withDependencies(
    disks.map((disk) =>
      partition(
        disk,
        3,
        PARTITION_TYPE.ZFS_BOOT,
        "+1G",
        `boot on ${disk}`,
      )
        .withDependencies([zfsPartition2Efi])
    ),
  );

/**
 * TODO: fill out the smallest disk.
 * TODO: get the size of its Root partition.
 * TODO: partition all other disks that size as BF00 for rpool mirror.
 *
 * TODO: if there is space remaining on at least two drives,
 * TODO: fill out the smallest disk.
 * TODO: get the size of that partition.
 * TODO: partition all other disks that size as BF01 for possible tank, or tank special vdev.
 */
export const zfsPartition4Root = Command.custom("zfsPartition4Root")
  .withDependencies(
    disks.map((disk) =>
      partition(
        disk,
        4,
        PARTITION_TYPE.ZFS_OTHER,
        "0",
        `root on ${disk}`,
      )
        .withDependencies([zfsPartition3Boot])
    ),
  );

export const zfsPartitions = Command.custom("zfsPartitions")
  .withDependencies([
    debian1PrepareInstallEnv,
    zfsPartition4Root,
  ]);

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
