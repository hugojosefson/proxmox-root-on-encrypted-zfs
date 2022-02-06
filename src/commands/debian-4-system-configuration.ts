import { Command } from "../model/command.ts";
import { hostname } from "./hostname.ts";
import { networkInterface } from "./network-interface.ts";
import { aptSourcesListMnt } from "./apt-sources-list.ts";
import { mountForChroot } from "./mount-for-chroot.ts";

export const debian4SystemConfiguration = Command.custom()
  .withDependencies([
    hostname,
    networkInterface,
    aptSourcesListMnt,
    mountForChroot,
  ]);
