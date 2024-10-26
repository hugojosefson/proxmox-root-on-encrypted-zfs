import {
  CreateFile,
  LineInFile,
  MODE_SECRET_600,
} from "./common/file-commands.ts";
import { ROOT } from "../os/user/root.ts";
import { FileSystemPath } from "../model/dependency.ts";
import { config } from "../config.ts";
import { ipRegex, netmask } from "../deps.ts";
import { usageAndThrow } from "../usage.ts";
import { inChrootCommand } from "./in-chroot-command.ts";
import { Command } from "../model/command.ts";
import { chrootSsh } from "./chroot-ssh.ts";

const chrootInstallDropbear = inChrootCommand(
  "chrootInstallDropbear",
  "apt install -y --no-install-recommends dropbear-initramfs",
)
  .withDependencies([chrootSsh]);

const chrootWriteDropbearAuthorizedKeys = new CreateFile(
  ROOT,
  FileSystemPath.of(ROOT, "/mnt/etc/dropbear/initramfs/authorized_keys"),
  config.ROOT_AUTHORIZED_KEYS
    .split("\n")
    .map((line) => `command="/usr/bin/zfsunlock" ${line}`)
    .join("\n"),
  false,
  MODE_SECRET_600,
)
  .withDependencies([chrootInstallDropbear]);

const chrootCleanupDropbearAuthorizedKeys = inChrootCommand(
  "chrootCleanupDropbearAuthorizedKeys",
  "sed -i '/ssh-ed25519/d' /etc/dropbear/initramfs/authorized_keys",
)
  .withDependencies([chrootWriteDropbearAuthorizedKeys]);

function initramfsIpLine(input: string): string {
  if (/^IP=/.test(input)) {
    return input;
  }

  if (new RegExp(`^${ipRegex}::${ipRegex}:${ipRegex}`).test(input)) {
    return `IP=${input}`;
  }

  try {
    const net = netmask(input);
    return `IP=${net.ip}::${net.gateway}:${net.mask}`;
  } catch (err) {
    console.error(
      'ERROR: Set environment variable INITRAMFS_IP to a valid cidr, for example "10.0.0.5/24", or to a valid "IP=" line for /etc/initramfs-tools/initramfs.conf.',
    );
    usageAndThrow(err);
  }
}

const chrootWriteDropbearNetworkConfig = new LineInFile(
  ROOT,
  FileSystemPath.of(ROOT, "/mnt/etc/initramfs-tools/initramfs.conf"),
  initramfsIpLine(config.INITRAMFS_IP),
)
  .withDependencies([chrootCleanupDropbearAuthorizedKeys]);

const chrootUpdateInitramfs = inChrootCommand(
  "chrootUpdateInitramfs",
  "update-initramfs -u -k all",
)
  .withDependencies([chrootWriteDropbearNetworkConfig]);

export const chrootDropbearRemoteUnlocking = Command.custom(
  "chrootDropbearRemoteUnlocking",
)
  .withDependencies([chrootUpdateInitramfs]);
