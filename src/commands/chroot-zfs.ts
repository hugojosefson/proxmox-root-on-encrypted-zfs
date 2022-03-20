import { chrootBasicSystemEnvironment } from "./chroot-basic-system-environment.ts";
import { inChrootCommand } from "./in-chroot-command.ts";

export const chrootZfs = inChrootCommand(
  "chrootZfs",
  `
apt install -y dpkg-dev linux-headers-amd64 linux-image-amd64
apt install -y zfs-initramfs
echo REMAKE_INITRD=yes > /etc/dkms/zfs.conf
`,
)
  .withDependencies([chrootBasicSystemEnvironment]);
