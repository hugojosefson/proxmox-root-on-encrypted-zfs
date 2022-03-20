import { Command } from "../model/command.ts";
import { getDisks } from "../os/find-disk.ts";
import { ensureSuccessful } from "../os/exec.ts";
import { ROOT } from "../os/user/root.ts";
import { debian5GrubInstallation } from "./debian-5-grub-installation.ts";

export const zfsMirrorGrub = Command.custom("zfsMirrorGrub")
  .withRun(async () => {
    const disks: string[] = await getDisks();
    await ensureSuccessful(ROOT, ["umount", "/boot/efi"]);
    for (let i = 1; i < disks.length; i++) {
      await ensureSuccessful(ROOT, [
        "dd",
        `if=${disks[0]}-part2`,
        `of=${disks[i]}-part2`,
      ]);
      await ensureSuccessful(ROOT, [
        "efibootmgr",
        `-c`,
        `-g`,
        `-d`,
        disks[i],
        "-p",
        "2",
        "-L",
        `debian-${i}`,
        "-l",
        "\\EFI\\debian\\grubx64.efi",
      ]);
    }
  })
  .withDependencies([debian5GrubInstallation]);
