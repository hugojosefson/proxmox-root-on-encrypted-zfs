import { Command } from "../model/command.ts";
import { config } from "../config.ts";
import { hostname } from "./hostname.ts";
import { networkInterface } from "./network-interface.ts";
import { ensureSuccessful } from "../os/exec.ts";
import { ROOT } from "../os/user/root.ts";
import { aptSourcesListMnt } from "./apt-sources-list-mnt.ts";

const cmds = `
mount --make-private --rbind /dev  /mnt/dev
mount --make-private --rbind /proc /mnt/proc
mount --make-private --rbind /sys  /mnt/sys
`;

export const mountForChroot = Command.custom()
  .withDependencies([
    hostname,
    networkInterface,
    aptSourcesListMnt,
  ])
  .withRun(async () => {
    await ensureSuccessful(ROOT, ["sh", "-c", cmds]);
  });

const inChrootDo = `chroot /mnt /usr/bin/env DISK=${await config
  .DISK()} bash -c`;
