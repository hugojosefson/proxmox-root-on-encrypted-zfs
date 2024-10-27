import { debian4SystemConfiguration } from "./debian-4-system-configuration.ts";
import { existsPath } from "./common/file-commands.ts";
import { inChrootCommand } from "./in-chroot-command.ts";

export const debian5GrubInstallation = inChrootCommand(
  "debian5GrubInstallation",
  `
grub-probe /boot

update-initramfs -c -k all

sed -E 's/^GRUB_CMDLINE_LINUX_DEFAULT="quiet"$/GRUB_CMDLINE_LINUX_DEFAULT=""/g' -i /etc/default/grub
sed -E 's/^GRUB_CMDLINE_LINUX=""$/GRUB_CMDLINE_LINUX="root=ZFS=rpool\\/ROOT\\/debian"/g' -i /etc/default/grub
sed -E 's/^#GRUB_TERMINAL=console$/GRUB_TERMINAL=console/g' -i /etc/default/grub

update-grub
grub-install --target=x86_64-efi --efi-directory=/boot/efi --bootloader-id=debian --recheck --no-floppy

mkdir -p /etc/zfs/zfs-list.cache
touch /etc/zfs/zfs-list.cache/bpool
touch /etc/zfs/zfs-list.cache/rpool

zed -F &

echo -n Waiting for /etc/zfs/zfs-list.cache/bpool to have content...
while ! [ -s /etc/zfs/zfs-list.cache/bpool ]; do sleep 0.5; done; echo DONE.

echo -n Waiting for /etc/zfs/zfs-list.cache/rpool to have content...
while ! [ -s /etc/zfs/zfs-list.cache/rpool ]; do sleep 0.5; done; echo DONE.

echo -n Killing zed...
while pidof zed; do
  kill -SIGINT $(pidof zed) || true
  sleep 0.5
done; echo DONE.
sed -E 's|/mnt/?|/|' -i /etc/zfs/zfs-list.cache/?pool

`,
)
  .withDependencies([debian4SystemConfiguration])
  .withSkipIfAll([
    async () => await debian4SystemConfiguration.shouldSkip(),
    () => existsPath("/etc/zfs/zfs-list.cache/bpool".split("/")),
    () => existsPath("/etc/zfs/zfs-list.cache/rpool".split("/")),
    async () =>
      (await Deno.readTextFile("/etc/zfs/zfs-list.cache/bpool")).includes(
        "/etc/zfs/zfs-list.cache",
      ),
    async () =>
      (await Deno.readTextFile("/etc/zfs/zfs-list.cache/rpool")).includes(
        "/etc/zfs/zfs-list.cache",
      ),
    async () =>
      !(await Deno.readTextFile("/etc/zfs/zfs-list.cache/bpool")).includes(
        "/mnt/",
      ),
    async () =>
      !(await Deno.readTextFile("/etc/zfs/zfs-list.cache/rpool")).includes(
        "/mnt/",
      ),
  ]);
