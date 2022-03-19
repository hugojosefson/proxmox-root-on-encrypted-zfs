import { FileSystemPath } from "../model/dependency.ts";
import { CreateFile, MODE_SECRET_600 } from "./common/file-commands.ts";
import { config } from "../config.ts";
import { ROOT } from "../os/user/root.ts";
import { inChrootCommand } from "./in-chroot-command.ts";
import { debian3SystemInstallation } from "./debian-3-system-installation.ts";
import { hostname } from "./hostname.ts";
import { networkInterface } from "./network-interface.ts";
import { aptSourcesListMnt } from "./apt-sources-list-mnt.ts";
import { chrootBasicSystemEnvironment } from "./chroot-basic-system-environment.ts";
import { chrootZfs } from "./chroot-zfs.ts";
import { chrootGrub } from "./chroot-grub.ts";
import { chrootPasswdRoot } from "./chroot-passwd-root.ts";
import { chrootZfsBpool } from "./chroot-zfs-bpool.ts";
import { chrootTmpfs } from "./chroot-tmpfs.ts";

const chrootInstallOpenSshServer = inChrootCommand(
  "chrootInstallOpenSshServer",
  "apt install -y openssh-server",
)
  .withDependencies([
    debian3SystemInstallation,
    hostname,
    networkInterface,
    aptSourcesListMnt,
    chrootBasicSystemEnvironment,
    chrootZfs,
    chrootGrub,
    chrootPasswdRoot,
    chrootZfsBpool,
    chrootTmpfs,
  ]);

const chrootWriteAuthorizedKeys = new CreateFile(
  ROOT,
  FileSystemPath.of(ROOT, "/mnt/root/.ssh/authorized_keys"),
  config.ROOT_AUTHORIZED_KEYS,
  false,
  MODE_SECRET_600,
);

export const chrootSsh = chrootWriteAuthorizedKeys
  .withDependencies([chrootInstallOpenSshServer]);
