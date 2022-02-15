import { Command, Sequential } from "../model/command.ts";
import { debian5GrubInstallation } from "./debian-5-grub-installation.ts";
import { inChrootCommand } from "./chroot-basic-system-environment.ts";
import { ensureSuccessful } from "../os/exec.ts";
import { ROOT } from "../os/user/root.ts";

export const zfsSnapshotInstallation = inChrootCommand(
  "zfsSnapshotInstallation",
  `
zfs snapshot bpool/BOOT/debian@install
zfs snapshot rpool/ROOT/debian@install
`,
);

export const zfsUmount = Command.custom("zfsUmount").withRun(async () => {
  await ensureSuccessful(ROOT, [
    "sh",
    "-c",
    `mount | grep -v zfs | tac | awk '/\\/mnt/ {print $3}' | xargs -i{} umount -lf {}`,
  ]);
  await ensureSuccessful(ROOT, ["zpool", "export", "-fa"]);
});

export const zfsRebootInstructions = Command.custom("zfsRebootInstructions")
  .withRun(async () => {
    return `

Debian is installed.

Now, reboot.

When you get to the initramfs prompt, run these two commands:

  zpool import -fa
  zpool export -fa

Then reboot again, and you will be prompted for the zfs encryption key.
`;
  });

export const debian6FirstBoot = new Sequential("debian6FirstBoot", [
  debian5GrubInstallation,
  // zfsSnapshotInstallation,
  // zfsUmount,
  zfsRebootInstructions,
]);
