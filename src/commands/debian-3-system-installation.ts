import { Command } from "../model/command.ts";
import { ensureSuccessful } from "../os/exec.ts";
import { debian2DiskFormatting } from "./debian-2-disk-formatting.ts";
import { ROOT } from "../os/user/root.ts";
import { FileSystemPath } from "../model/dependency.ts";
import { existsPath } from "./common/file-commands.ts";
import { getDisks } from "../os/find-disk.ts";

function getCmds() {
  return `

zfs create -o canmount=off    -o mountpoint=none rpool/ROOT
zfs create -o canmount=off    -o mountpoint=none bpool/BOOT

zfs create -o canmount=noauto -o mountpoint=/    rpool/ROOT/debian
zfs mount rpool/ROOT/debian

zfs create -o mountpoint=/boot                   bpool/BOOT/debian

zfs create                                       rpool/home
zfs create -o mountpoint=/root                   rpool/home/root
chmod 700 /mnt/root
zfs create -o canmount=off                       rpool/var
zfs create -o canmount=off                       rpool/var/lib
zfs create                                       rpool/var/log
zfs create                                       rpool/var/spool

zfs create -o com.sun:auto-snapshot=false        rpool/var/cache
zfs create -o com.sun:auto-snapshot=false        rpool/var/tmp
chmod 1777 /mnt/var/tmp

zfs create                                       rpool/opt
zfs create                                       rpool/srv

zfs create -o canmount=off                       rpool/usr
zfs create                                       rpool/usr/local

zfs create -o com.sun:auto-snapshot=false        rpool/var/lib/docker
zfs create -o com.sun:auto-snapshot=false        rpool/var/lib/nfs

mkdir /mnt/run
mount -t tmpfs tmpfs /mnt/run
mkdir /mnt/run/lock

debootstrap bookworm /mnt

mkdir /mnt/etc/zfs
cp /etc/zfs/zpool.cache /mnt/etc/zfs/

    `;
}
export const debian3SystemInstallation = Command.custom(
  "debian3SystemInstallation",
)
  .withLocks((await getDisks()).map((disk) => FileSystemPath.of(ROOT, disk)))
  .withDependencies([debian2DiskFormatting])
  .withSkipIfAll([() => existsPath("/mnt/etc/zfs/zpool.cache".split("/"))])
  .withRun(async () => {
    await ensureSuccessful(ROOT, ["sh", "-ec", getCmds()]);
  });
