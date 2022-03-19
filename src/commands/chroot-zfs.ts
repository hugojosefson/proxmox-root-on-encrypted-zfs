import {
  chrootBasicSystemEnvironment,
} from "./chroot-basic-system-environment.ts";
import { debian3SystemInstallation } from "./debian-3-system-installation.ts";
import { hostname } from "./hostname.ts";
import { networkInterface } from "./network-interface.ts";
import { aptSourcesListMnt } from "./apt-sources-list-mnt.ts";
import { inChrootCommand } from "./in-chroot-command.ts";

export const chrootZfs = inChrootCommand(
  "chrootZfs",
  `
apt install -y dpkg-dev linux-headers-amd64 linux-image-amd64
apt install -y zfs-initramfs
echo REMAKE_INITRD=yes > /etc/dkms/zfs.conf
`,
)
  .withDependencies([
    debian3SystemInstallation,
    hostname,
    networkInterface,
    aptSourcesListMnt,
    chrootBasicSystemEnvironment,
  ]);
