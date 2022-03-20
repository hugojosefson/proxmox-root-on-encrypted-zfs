import { Command } from "../model/command.ts";
import { zfsUmount } from "./zfs-umount.ts";

export const zfsRebootInstructions = Command.custom("zfsRebootInstructions")
  .withRun(() => {
    return Promise.resolve(`

Debian is installed.

Now, reboot.

When you get to the initramfs prompt, run these two commands:

  zpool import -fa
  zpool export -a

Then reboot again, and you will be prompted for the zfs encryption key.
`);
  })
  .withDependencies([zfsUmount]);
