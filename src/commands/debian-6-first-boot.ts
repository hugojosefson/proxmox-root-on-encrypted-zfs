import { Command } from "../model/command.ts";
import { debian5GrubInstallation } from "./debian-5-grub-installation.ts";
import { zfsRebootInstructions } from "./zfs-reboot-instructions.ts";
// import { inChrootCommand } from "./in-chroot-command.ts";
//
// export const zfsSnapshotInstallation = inChrootCommand(
//   "zfsSnapshotInstallation",
//   `
// zfs snapshot bpool/BOOT/debian@install
// zfs snapshot rpool/ROOT/debian@install
// `,
// );

export const debian6FirstBoot = Command.custom("debian6FirstBoot")
  .withDependencies([
    debian5GrubInstallation,
    zfsRebootInstructions,
  ]);
