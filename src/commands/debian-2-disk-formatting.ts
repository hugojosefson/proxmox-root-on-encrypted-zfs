import { Command } from "../model/command.ts";
import { ensureSuccessful } from "../os/exec.ts";
import { config } from "../config.ts";
import { debian1PrepareInstallEnv } from "./debian-1-prepare-install-env.ts";
import { FileSystemPath } from "../model/dependency.ts";
import { ROOT } from "../os/user/root.ts";

export const zfsPartitions = Command.custom()
  .withLocks([FileSystemPath.of(ROOT, await config.DISK())])
  .withDependencies([debian1PrepareInstallEnv])
  .withRun(async () => {
    await ensureSuccessful(ROOT, ["sync"]);
    await ensureSuccessful(ROOT, [
      "sgdisk",
      "--new=2:1M:+512M",
      "--typecode=2:EF00",
      await config.DISK(),
    ]);
    await ensureSuccessful(ROOT, [
      "sgdisk",
      "--new=3:0:+1G",
      "--typecode=3:BF01",
      await config.DISK(),
    ]);
    await ensureSuccessful(ROOT, [
      "sgdisk",
      "--new=4:0:0",
      "--typecode=4:BF00",
      await config.DISK(),
    ]);
  });

export const zfsBootPool = Command.custom()
  .withLocks([FileSystemPath.of(ROOT, await config.DISK())])
  .withDependencies([zfsPartitions])
  .withRun(async () => {
    // await ensureSuccessful(ROOT, ["sync",]);
    // await ensureSuccessful(ROOT, ["sleep","5"]);
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
      `${await config.DISK()}-part3`,
    ]);
  });

export const zfsRootPool = Command.custom()
  .withLocks([FileSystemPath.of(ROOT, await config.DISK())])
  .withDependencies([zfsPartitions])
  .withRun(async () => {
    // await ensureSuccessful(ROOT, ["sync",]);
    // await ensureSuccessful(ROOT, ["sleep","5"]);
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
      `${await config.DISK()}-part4`,
    ], {
      stdin:
        `${config.DISK_ENCRYPTION_PASSWORD}\n${config.DISK_ENCRYPTION_PASSWORD}\n`,
    });
  });

export const debian2DiskFormatting = Command.custom().withDependencies([
  zfsBootPool,
  zfsRootPool,
]);
