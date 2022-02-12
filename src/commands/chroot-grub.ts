import { inChrootCommand } from "./chroot-basic-system-environment.ts";
import { getDisk } from "../os/find-disk.ts";

export const chrootGrub = inChrootCommand(
  "chrootGrub",
  `
apt-get install -y dosfstools

mkdosfs -F 32 -s 1 -n EFI ${await getDisk()}-part2
mkdir /boot/efi
echo /dev/disk/by-uuid/$(blkid -s UUID -o value ${await getDisk()}-part2) \\
   /boot/efi vfat defaults 0 0 >> /etc/fstab
mount /boot/efi

apt-get install -y grub-efi-amd64 shim-signed
apt-get purge -y os-prober
`,
);
