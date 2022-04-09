import { Command } from "../model/command.ts";
import { getDisksExceptFirst, getFirstDisk } from "../os/find-disk.ts";
import { ensureSuccessful } from "../os/exec.ts";
import { ROOT } from "../os/user/root.ts";
import { debian5GrubInstallation } from "./debian-5-grub-installation.ts";
import { InstallOsPackage } from "./common/os-package.ts";
import { inChrootCommand } from "./in-chroot-command.ts";
import { inChrootPrefix } from "./chroot-basic-system-environment.ts";

const zfsMirrorGrubUmount = inChrootCommand(
  "zfsMirrorGrubUmount",
  `umount ${await getFirstDisk()}-part2`,
)
  .withSkipIfAll([
    async () => {
      await ensureSuccessful(
        ROOT,
        inChrootPrefix(`! findmnt ${await getFirstDisk()}-part2`),
      );
      return true;
    },
  ]);

export const zfsMirrorGrub = Command.custom("zfsMirrorGrub")
  .withRun(async () => {
    const firstDisk = await getFirstDisk();
    const otherDisks: string[] = await getDisksExceptFirst();

    for (let i = 0; i < otherDisks.length; i++) {
      await ensureSuccessful(ROOT, [
        "dd",
        `if=${firstDisk}-part2`,
        `of=${otherDisks[i]}-part2`,
      ]);
      await ensureSuccessful(ROOT, [
        "efibootmgr",
        `-c`,
        `-g`,
        `-d`,
        otherDisks[i],
        "-p",
        "2",
        "-L",
        `debian-${i + 2}`,
        "-l",
        "\\EFI\\debian\\grubx64.efi",
      ]);
    }
  })
  .withDependencies([
    debian5GrubInstallation,
    InstallOsPackage.of("efibootmgr"),
    zfsMirrorGrubUmount,
  ]);
