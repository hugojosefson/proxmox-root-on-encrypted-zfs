import { Command } from "../model/command.ts";
import { ensureSuccessful } from "../os/exec.ts";
import { config } from "../config.ts";
import { debian1PrepareInstallEnv } from "./debian-1-prepare-install-env.ts";
import { FileSystemPath } from "../model/dependency.ts";
import { ROOT } from "../os/user/root.ts";
import { existsPath } from "./common/file-commands.ts";
import { getDisk } from "../os/find-disk.ts";

export const zfsPartition2Efi = Command.custom("zfsPartition2Efi")
  .withLocks([FileSystemPath.of(ROOT, await getDisk())])
  .withDependencies([debian1PrepareInstallEnv])
  .withSkipIfAll([
    async () => await existsPath(`${await getDisk()}-part2`.split("/")),
  ])
  .withRun(async () => {
    await ensureSuccessful(ROOT, ["sync"]);
    await ensureSuccessful(ROOT, [
      "sgdisk",
      "--new=2:1M:+512M",
      "--typecode=2:EF00",
      await getDisk(),
    ]);
    await ensureSuccessful(ROOT, ["sync"]);
    await ensureSuccessful(ROOT, ["sleep", "5"]);
  });

export const zfsPartition3Boot = Command.custom("zfsPartition3Boot")
  .withLocks([FileSystemPath.of(ROOT, await getDisk())])
  .withDependencies([debian1PrepareInstallEnv, zfsPartition2Efi])
  .withSkipIfAll([
    async () => await existsPath(`${await getDisk()}-part3`.split("/")),
  ])
  .withRun(async () => {
    await ensureSuccessful(ROOT, ["sync"]);
    await ensureSuccessful(ROOT, [
      "sgdisk",
      "--new=3:0:+1G",
      "--typecode=3:BF01",
      await getDisk(),
    ]);
    await ensureSuccessful(ROOT, ["sync"]);
    await ensureSuccessful(ROOT, ["sleep", "5"]);
    await ensureSuccessful(ROOT, [
      "sh",
      "-c",
      `partx -v -a ${await getDisk()} || true`,
    ]);
  });

export const zfsPartition4Root = Command.custom("zfsPartition4Root")
  .withLocks([FileSystemPath.of(ROOT, await getDisk())])
  .withDependencies([debian1PrepareInstallEnv, zfsPartition3Boot])
  .withSkipIfAll([
    async () => await existsPath(`${await getDisk()}-part4`.split("/")),
  ])
  .withRun(async () => {
    await ensureSuccessful(ROOT, ["sync"]);
    await ensureSuccessful(ROOT, [
      "sgdisk",
      "--new=4:0:0",
      "--typecode=4:BF00",
      await getDisk(),
    ]);
    await ensureSuccessful(ROOT, ["sync"]);
    await ensureSuccessful(ROOT, ["sleep", "5"]);
    await ensureSuccessful(ROOT, [
      "sh",
      "-c",
      `partx -v -a ${await getDisk()} || true`,
    ]);
  });

export const zfsBootPool = Command.custom("zfsBootPool")
  .withLocks([FileSystemPath.of(ROOT, await getDisk())])
  .withDependencies([zfsPartition3Boot])
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
          "zstd_compress",
          "spacemap_histogram",
          "zpool_checkpoint",
        ].map((feature) => `feature@${feature}=enabled`),
      ].flatMap(
        (option) => ["-o", option],
      ),
      ...[
        "acltype=posixacl",
        "canmount=off",
        "compression=zstd",
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
      `${await getDisk()}-part3`,
    ]);
  });

export const zfsRootPool = Command.custom("zfsRootPool")
  .withLocks([FileSystemPath.of(ROOT, await getDisk())])
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
        "compression=zstd",
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
      `${await getDisk()}-part4`,
    ], {
      stdin:
        `${config.DISK_ENCRYPTION_PASSWORD}\n${config.DISK_ENCRYPTION_PASSWORD}\n`,
    });
  });

export const zfsPartitions = Command.custom("zfsPartitions")
  .withDependencies([
    zfsPartition4Root,
  ]);

export const debian2DiskFormatting = Command.custom("debian2DiskFormatting")
  .withDependencies([
    debian1PrepareInstallEnv,
    zfsPartitions,
    zfsBootPool,
    zfsRootPool,
  ]);
