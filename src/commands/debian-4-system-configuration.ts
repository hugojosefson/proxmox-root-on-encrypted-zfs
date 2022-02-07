import { Command } from "../model/command.ts";
import { hostname } from "./hostname.ts";
import { networkInterface } from "./network-interface.ts";
import { mountForChroot } from "./mount-for-chroot.ts";
import { aptSourcesListMnt } from "./apt-sources-list-mnt.ts";
import { FileSystemPath } from "../model/dependency.ts";
import { ROOT } from "../os/user/root.ts";
import { config } from "../config.ts";

export const debian4SystemConfiguration = Command.custom()
  .withLocks([FileSystemPath.of(ROOT, await config.DISK())])
  .withDependencies([
    hostname,
    networkInterface,
    aptSourcesListMnt,
    mountForChroot,
  ]);
