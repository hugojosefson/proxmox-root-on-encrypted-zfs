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

export const chrootTmpfs = inChrootCommand(
  "chrootTmpfs",
  `
cp /usr/share/systemd/tmp.mount /etc/systemd/system/
systemctl enable tmp.mount
`,
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
  ]);
