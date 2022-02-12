import { inChrootCommand } from "./chroot-basic-system-environment.ts";
import { debian4SystemConfiguration } from "./debian-4-system-configuration.ts";
import { zfsPartition1BiosBoot } from "./debian-2-disk-formatting.ts";
import { getDisk } from "../os/find-disk.ts";

export const debian5GrubInstallation = inChrootCommand(
  "debian5GrubInstallation",
  `
mkfs.fat ${await getDisk()}-part1
grub-probe /boot/efi

sed -E 's/^GRUB_CMDLINE_LINUX_DEFAULT="quiet"$/GRUB_CMDLINE_LINUX_DEFAULT=""/g' -i /etc/default/grub
sed -E 's/^GRUB_CMDLINE_LINUX=""$/GRUB_CMDLINE_LINUX="root=ZFS=rpool\\/ROOT\\/debian"/g' -i /etc/default/grub
sed -E 's/^#GRUB_TERMINAL=console$/GRUB_TERMINAL=console/g' -i /etc/default/grub

update-grub
grub-install --target=x86_64-efi --efi-directory=/boot/efi --bootloader-id=debian --recheck --no-floppy || true

mkdir /etc/zfs/zfs-list.cache
touch /etc/zfs/zfs-list.cache/bpool
touch /etc/zfs/zfs-list.cache/rpool

zed -F &
while ! [ -s /etc/zfs/zfs-list.cache/bpool ]; do sleep 0.5; done;
while ! [ -s /etc/zfs/zfs-list.cache/rpool ]; do sleep 0.5; done;
while pidof zed; do
  kill -SIGINT $(cat /run/zed.pid)
  sleep 0.5
  kill -SIGTERM $(cat /run/zed.pid)
done
sed -E 's|/mnt/?|/|' -i /etc/zfs/zfs-list.cache/?pool

`,
).withDependencies([debian4SystemConfiguration, zfsPartition1BiosBoot]);
