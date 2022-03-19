import { Command } from "../model/command.ts";
import { ensureSuccessful } from "../os/exec.ts";
import { ROOT } from "../os/user/root.ts";
import { debian5GrubInstallation } from "./debian-5-grub-installation.ts";
import { chrootProxmoxPrepare } from "./chroot-proxmox.ts";

export const zfsUmount = Command.custom("zfsUmount")
  .withRun(async () => {
    await ensureSuccessful(ROOT, [
      "bash",
      `-euo`,
      `pipefail`,
      "-c",
      `mount | grep -v zfs | tac | awk '/\\/mnt/ {print $3}' | xargs -i{} umount -lf {}`,
    ]);
    await ensureSuccessful(ROOT, ["zpool", "export", "bpool"]);
  })
  .withDependencies([
    debian5GrubInstallation,
    chrootProxmoxPrepare,
  ]);
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
  .withDependencies([
    zfsUmount,
  ]);
