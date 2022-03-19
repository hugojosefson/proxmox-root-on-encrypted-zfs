import { config } from "../config.ts";
import { inChrootCommand } from "./in-chroot-command.ts";
import { debian3SystemInstallation } from "./debian-3-system-installation.ts";
import { hostname } from "./hostname.ts";
import { networkInterface } from "./network-interface.ts";
import { aptSourcesListMnt } from "./apt-sources-list-mnt.ts";
import { chrootBasicSystemEnvironment } from "./chroot-basic-system-environment.ts";
import { chrootZfs } from "./chroot-zfs.ts";
import { chrootGrub } from "./chroot-grub.ts";

export const chrootPasswdRoot = inChrootCommand(
  "chrootPasswdRoot",
  `passwd root`,
  {
    stdin: `${config.ROOT_PASSWORD}\n${config.ROOT_PASSWORD}\n`,
  },
)
  .withDependencies([
    debian3SystemInstallation,
    hostname,
    networkInterface,
    aptSourcesListMnt,
    chrootBasicSystemEnvironment,
    chrootZfs,
    chrootGrub,
  ]);
