import { inChrootCommand } from "./chroot-basic-system-environment.ts";
import {
  CreateFile,
  LineInFile,
  MODE_SECRET_600,
} from "./common/file-commands.ts";
import { ROOT } from "../os/user/root.ts";
import { FileSystemPath } from "../model/dependency.ts";
import { config } from "../config.ts";

const chrootInstallDropbear = inChrootCommand(
  "chrootInstallDropbear",
  "apt install -y --no-install-recommends dropbear-initramfs",
);

const chrootWriteDropbearAuthorizedKeys = new CreateFile(
  ROOT,
  FileSystemPath.of(ROOT, "/mnt/etc/dropbear-initramfs/authorized_keys"),
  config.ROOT_AUTHORIZED_KEYS,
  false,
  MODE_SECRET_600,
)
  .withDependencies([chrootInstallDropbear]);

const chrootCleanupDropbearAuthorizedKeys = inChrootCommand(
  "chrootCleanupDropbearAuthorizedKeys",
  "sed -i '/ssh-ed25519/d' /etc/dropbear-initramfs/authorized_keys",
)
  .withDependencies([chrootWriteDropbearAuthorizedKeys]);

const chrootWriteDropbearNetworkConfig = new LineInFile(
  ROOT,
  FileSystemPath.of(ROOT, "/mnt/etc/initramfs-tools/initramfs.conf"),
  "IP=dhcp",
)
  .withDependencies([chrootInstallDropbear]);

const chrootUpdateInitramfs = inChrootCommand(
  "chrootUpdateInitramfs",
  "update-initramfs -u -k all",
);

export const chrootDropbearRemoteUnlocking = chrootUpdateInitramfs
  .withDependencies([
    chrootWriteDropbearAuthorizedKeys,
    chrootWriteDropbearNetworkConfig,
    chrootCleanupDropbearAuthorizedKeys,
  ]);
