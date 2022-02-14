import { inChrootCommand } from "./chroot-basic-system-environment.ts";

export const chrootZfs = inChrootCommand(
  "chrootZfs",
  `
apt install -y dpkg-dev linux-headers-amd64 linux-image-amd64 zfs-initramfs
echo REMAKE_INITRD=yes > /etc/dkms/zfs.conf
`,
);
