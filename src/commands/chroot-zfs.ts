import { inChrootCommand } from "./chroot-mount.ts";
import { chrootBasicSystemEnvironment } from "./chroot-basic-system-environment.ts";

export const chrootZfs = inChrootCommand(`
apt-get install -y dpkg-dev linux-headers-amd64 linux-image-amd64 zfs-initramfs
echo REMAKE_INITRD=yes > /etc/dkms/zfs.conf
`)
  .withDependencies([chrootBasicSystemEnvironment]);
