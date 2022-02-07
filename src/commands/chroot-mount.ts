import { Command } from "../model/command.ts";
import { hostname } from "./hostname.ts";
import { networkInterface } from "./network-interface.ts";
import { ensureSuccessful, ExecOptions } from "../os/exec.ts";
import { ROOT } from "../os/user/root.ts";
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

export const chrootMount = Command.custom()
  .withDependencies([
    hostname,
    networkInterface,
    aptSourcesListMnt,
  ])
  .withRun(async () => {
    await ensureSuccessful(ROOT, ["sh", "-c", chrootMountCmds]);
  });

export function inChrootCommand(cmds: string, options?: ExecOptions): Command {
  return Command.custom()
    .withDependencies([chrootMount])
    .withRun(async () => {
      await ensureSuccessful(ROOT, inChrootPrefix(cmds), options);
    });
}
