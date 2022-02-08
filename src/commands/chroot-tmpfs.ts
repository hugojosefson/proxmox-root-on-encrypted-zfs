import { inChrootCommand } from "./chroot-basic-system-environment.ts";

export const chrootTmpfs = inChrootCommand(
  `
cp /usr/share/systemd/tmp.mount /etc/systemd/system/
systemctl enable tmp.mount
`,
);
