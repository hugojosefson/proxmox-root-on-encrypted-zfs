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
  await ensureSuccessful(ROOT, ["zpool", "export", "-a"]);
});

export const reboot = Command.custom("reboot").withRun(() =>
  ensureSuccessful(ROOT, ["reboot"])
);

export const debian6FirstBoot = new Sequential("debian6FirstBoot", [
  debian5GrubInstallation,
  zfsSnapshotInstallation,
  zfsUmount,
  reboot,
]);
