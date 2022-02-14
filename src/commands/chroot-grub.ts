import {
  inChrootCommand,
  inChrootPrefix,
} from "./chroot-basic-system-environment.ts";
import { getDisk } from "../os/find-disk.ts";
import { Sequential } from "../model/command.ts";
import { ensureSuccessful } from "../os/exec.ts";
import { ROOT } from "../os/user/root.ts";
import { LineInFile } from "./common/file-commands.ts";
import { FileSystemPath } from "../model/dependency.ts";

const chrootGrubInstallDosfsTools = inChrootCommand(
  "chrootGrubInstallDosfsTools",
  `apt install -y dosfstools`,
)
  .withSkipIfAll([
    async () => {
      await ensureSuccessful(
        ROOT,
        inChrootPrefix("dpkg --status dosfstools"),
      );
      return true;
    },
  ]);

const chrootGrubMkfsEfiPart2 = inChrootCommand(
  "chrootGrubMkfsEfiPart2",
  `mkdosfs -F 32 -s 1 -n EFI ${await getDisk()}-part2`,
)
  .withSkipIfAll([
    async () => {
      await ensureSuccessful(
        ROOT,
        inChrootPrefix(`file -sL ${await getDisk()}-part2 | grep EFI`),
      );
      return true;
    },
  ]);

const chrootGrubMkdirBootEfi = inChrootCommand(
  "chrootGrubMkdirBootEfi",
  `mkdir /boot/efi`,
)
  .withSkipIfAll([
    async () => {
      await ensureSuccessful(
        ROOT,
        inChrootPrefix(`[ -d /boot/efi ]`),
      );
      return true;
    },
  ]);

const chrootGrubLineInFstab = new LineInFile(
  ROOT,
  FileSystemPath.of(ROOT, "/mnt/etc/fstab"),
  `${await getDisk()}-part2 /boot/efi vfat defaults 0 0`,
);

const chrootGrubMountBootEfi = inChrootCommand(
  "chrootGrubMountBootEfi",
  `mount /boot/efi`,
)
  .withSkipIfAll([
    async () => {
      await ensureSuccessful(
        ROOT,
        inChrootPrefix(`findmnt ${await getDisk()}-part2`),
      );
      return true;
    },
  ]);

const chrootGrubInstallGrub = inChrootCommand(
  "chrootGrubInstallGrub",
  `apt install -y grub-efi-amd64`,
)
  .withSkipIfAll([
    async () => {
      await ensureSuccessful(
        ROOT,
        inChrootPrefix("dpkg --status grub-efi-amd64"),
      );
      return true;
    },
  ]);

const chrootGrubInstallShimSigned = inChrootCommand(
  "chrootGrubInstallShimSigned",
  `apt install -y shim-signed`,
)
  .withSkipIfAll([
    async () => {
      await ensureSuccessful(
        ROOT,
        inChrootPrefix("dpkg --status shim-signed"),
      );
      return true;
    },
  ]);

const chrootGrubRemoveOsProber = inChrootCommand(
  "chrootGrubRemoveOsProber",
  `apt purge -y os-prober`,
)
  .withSkipIfAll([
    async () => {
      await ensureSuccessful(
        ROOT,
        inChrootPrefix("! dpkg --status os-prober"),
      );
      return true;
    },
  ]);

export const chrootGrub = new Sequential("chrootGrub", [
  chrootGrubInstallDosfsTools,
  chrootGrubMkfsEfiPart2,
  chrootGrubMkdirBootEfi,
  chrootGrubLineInFstab,
  chrootGrubMountBootEfi,
  chrootGrubInstallGrub,
  chrootGrubInstallShimSigned,
  chrootGrubRemoveOsProber,
]);
