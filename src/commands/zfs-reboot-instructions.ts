import { Command } from "../model/command.ts";
import { zfsUmount } from "./zfs-umount.ts";
import { debian8DisableLogCompression } from "./debian-8-disable-log-compression.ts";

export const zfsRebootInstructions = Command.custom("zfsRebootInstructions")
  .withRun(() => {
    return Promise.resolve(`

=============================================================
Debian is installed.

Now, reboot.

-------------------------------------------------------------

When you get to the initramfs prompt, run these two commands:

  zpool import -fa
  zpool export -a

Then reboot again.

-------------------------------------------------------------

You will be prompted for the zfs encryption key after the
next reboot.

-------------------------------------------------------------

Log in as root.

If you want to change root password, and/or encryption
password for zfs:

  passwd
  zfs change-key rpool

-------------------------------------------------------------
Continue installing Proxmox VE at
https://pve.proxmox.com/wiki/Install_Proxmox_VE_on_Debian_11_Bullseye#Install_Proxmox_VE_packages
=============================================================

`);
  })
  .withDependencies([
    debian8DisableLogCompression,
    zfsUmount,
  ]);
