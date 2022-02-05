import { Command } from "../model/command.ts";
import { ensureSuccessful } from "../os/exec.ts";
import { config } from "../config.ts";
import { debian1PrepareInstallEnv } from "./debian-1-prepare-install-env.ts";
import { FileSystemPath } from "../model/dependency.ts";
import { ROOT } from "../os/user/target-user.ts";
import { sleep } from "../os/sleep.ts";

export const zfsPartitions = Command.custom()
  .withLocks([FileSystemPath.of(ROOT, config.DISK)])
  .withDependencies([debian1PrepareInstallEnv])
  .withRun(async () => {
    console.log("zfsPartitions: running...");
    await ensureSuccessful(ROOT, [
      "sgdisk",
      "--new=2:1M:+512M",
      "--typecode=2:EF00",
      config.DISK,
    ]);
    await ensureSuccessful(ROOT, [
      "sgdisk",
      "--new=3:0:+1G",
      "--typecode=3:BF01",
      config.DISK,
    ]);
    await ensureSuccessful(ROOT, [
      "sgdisk",
      "--new=4:0:0",
      "--typecode=4:BF00",
      config.DISK,
    ]);
    console.log("zfsPartitions: running... DONE.");
  });

export const zfsBootPool = Command.custom()
  .withLocks([FileSystemPath.of(ROOT, config.DISK)])
  .withDependencies([zfsPartitions])
  .withRun(async () => {
    console.log("zfsBootPool: running...");
    await ensureSuccessful(ROOT, [
      "zpool",
      "create",
      "-d",
      ...[
        "cachefile=/etc/zfs/zpool.cache",
        "ashift=12",
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
      "-R",
      "/mnt",
      "bpool",
      `${config.DISK}3`,
    ]);
    console.log("zfsBootPool: running... DONE.");
  });

export const zfsRootPool = Command.custom()
  .withLocks([FileSystemPath.of(ROOT, config.DISK)])
  .withDependencies([zfsPartitions])
  .withRun(async () => {
    console.log("zfsRootPool: running...");
    await ensureSuccessful(ROOT, [
      "zpool",
      "create",
      ...[
        "ashift=12",
      ].flatMap(
        (option) => ["-o", option],
      ),
      ...[
        "encryption=aes-256-gcm",

        // "keyformat=raw",
        "keyformat=passphrase",

        // "keylocation=file:///key",
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
      "-R",
      "/mnt",
      "rpool",
      `${config.DISK}4`,
    ], { stdin: "mypassword\nmypassword\n" });
    console.log("zfsRootPool: running... DONE.");
  });

export const debian2DiskFormatting = Command.custom().withDependencies([
  zfsBootPool,
  zfsRootPool,
]);
