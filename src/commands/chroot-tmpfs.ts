import { chrootMount, inChrootCommand } from "./chroot-mount.ts";

export const chrootTmpfs = inChrootCommand(
  `
cp /usr/share/systemd/tmp.mount /etc/systemd/system/
systemctl enable tmp.mount
`,
)
  .withDependencies([chrootMount]);
