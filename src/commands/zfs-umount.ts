import { Command } from "../model/command.ts";
import { ensureSuccessful } from "../os/exec.ts";
import { ROOT } from "../os/user/root.ts";
import { chrootProxmoxPrepare } from "./chroot-proxmox.ts";
import { zfsMirrorGrub } from "./zfs-mirror-grub.ts";

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
  .withDependencies([zfsMirrorGrub, chrootProxmoxPrepare]);
