import { inChrootCommand } from "./chroot-basic-system-environment.ts";
import { CreateFile, MODE_SECRET_600 } from "./common/file-commands.ts";
import { ROOT } from "../os/user/root.ts";
import { FileSystemPath } from "../model/dependency.ts";
import { config } from "../config.ts";

const chrootInstallDropbear = inChrootCommand(
  "apt-get install -y --no-install-recommends dropbear-initramfs",
);

const chrootWriteDropbearAuthorizedKeys = new CreateFile(
  ROOT,
  FileSystemPath.of(ROOT, "/mnt/etc/dropbear-initramfs/authorized_keys"),
  config.ROOT_AUTHORIZED_KEYS,
  true,
  MODE_SECRET_600,
).withDependencies([chrootInstallDropbear]);

const chrootCleanupDropbearAuthorizedKeys = inChrootCommand(
  "sed -i '/ssh-ed25519/d' /etc/dropbear-initramfs/authorized_keys",
)
  .withDependencies([chrootWriteDropbearAuthorizedKeys]);

const chrootWriteDropbearNetworkConfig = inChrootCommand("echo TODO");
const chrootUpdateInitramfs = inChrootCommand("update-initramfs -u -k all");

export const chrootDropbearRemoteUnlocking = chrootUpdateInitramfs
  .withDependencies([
    chrootWriteDropbearAuthorizedKeys,
    chrootWriteDropbearNetworkConfig,
    chrootCleanupDropbearAuthorizedKeys,
  ]);
