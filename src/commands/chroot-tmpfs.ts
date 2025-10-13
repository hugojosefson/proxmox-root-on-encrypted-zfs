import { inChrootCommand } from "./in-chroot-command.ts";
import { chrootZfsBpool } from "./chroot-zfs-bpool.ts";

export const chrootTmpfs = inChrootCommand(
  "chrootTmpfs",
  `
cp /usr/lib/systemd/system/tmp.mount /etc/systemd/system/
systemctl enable tmp.mount
`,
)
  .withDependencies([chrootZfsBpool]);