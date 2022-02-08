import { readRelativeFile } from "../os/read-relative-file.ts";
import { ensureSuccessful, ExecOptions } from "../os/exec.ts";
import { Command } from "../model/command.ts";
import { ROOT } from "../os/user/root.ts";
import { hostname } from "./hostname.ts";
import { networkInterface } from "./network-interface.ts";
import { aptSourcesListMnt } from "./apt-sources-list-mnt.ts";

function inChrootPrefix(cmds: string): string[] {
  return [
    `chroot`,
    `/mnt`,
    `/usr/bin/env`,
    `bash`,
    `--login`,
    `-c`,
    cmds,
  ];
}

const chrootMountCmds = `
mount --make-private --rbind /dev  /mnt/dev
mount --make-private --rbind /proc /mnt/proc
mount --make-private --rbind /sys  /mnt/sys
`;
const chrootMount = Command.custom()
  .withDependencies([
    hostname,
    networkInterface,
    aptSourcesListMnt,
  ])
  .withRun(async () => {
    await ensureSuccessful(ROOT, ["sh", "-c", chrootMountCmds]);
  });

export function inChrootCommand(
  cmds: string,
  options?: ExecOptions,
  skipDependencyOnChrootBasicSystemEnvironment = false,
): Command {
  return Command.custom()
    .withDependencies([
      skipDependencyOnChrootBasicSystemEnvironment
        ? chrootMount
        : chrootBasicSystemEnvironment,
    ])
    .withRun(async () => {
      await ensureSuccessful(ROOT, inChrootPrefix(cmds), options);
    });
}

export const chrootBasicSystemEnvironment = inChrootCommand(
  `
ln -s /proc/self/mounts /etc/mtab
apt-get update

debconf-set-selections << 'EOF'
${await readRelativeFile("./files/debconf-selections", import.meta.url)}
EOF

apt-get install -y console-setup locales
dpkg-reconfigure -f noninteractive locales tzdata keyboard-configuration console-setup

`,
  undefined,
  true,
);
