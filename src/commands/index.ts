import { kebabCase } from "../deps.ts";
import { toObject } from "../fn.ts";
import { Command } from "../model/command.ts";
import { InstallOsPackage } from "./common/os-package.ts";
import { vim } from "./vim.ts";
import { gsettings } from "./gsettings.ts";
import { debian } from "./debian.ts";
import { debian1PrepareInstallEnv } from "./debian-1-prepare-install-env.ts";
import {
  debian2DiskFormatting,
  zfsBootPool,
  zfsRootPool,
} from "./debian-2-disk-formatting.ts";
import { destroyAllPoolsAndDisks } from "./destroy-all-pools-and-disks.ts";
import { aptSourcesList } from "./apt-sources-list.ts";
import { debian3SystemInstallation } from "./debian-3-system-installation.ts";
import { debian4SystemConfiguration } from "./debian-4-system-configuration.ts";
import { REFRESH_OS_PACKAGES } from "./refresh-os-packages.ts";
import { chrootBasicSystemEnvironment } from "./chroot-basic-system-environment.ts";
import { chrootZfs } from "./chroot-zfs.ts";
import { chrootGrub } from "./chroot-grub.ts";
import { chrootPasswdRoot } from "./chroot-passwd-root.ts";
import { chrootZfsBpool } from "./chroot-zfs-bpool.ts";

const commands: Record<string, Command> = {
  debian,
  debian1PrepareInstallEnv,
  debian2DiskFormatting,
  debian3SystemInstallation,
  debian4SystemConfiguration,
  destroyAllPoolsAndDisks,
  nullCommand: Command.custom(),
  upgradeOsPackages: InstallOsPackage.upgradePackages(),
  REFRESH_OS_PACKAGES,
  aptSourcesList,
  vim,
  gsettings,
  zfsBootPool,
  zfsRootPool,
  chrootBasicSystemEnvironment,
  chrootZfs,
  chrootGrub,
  chrootPasswdRoot,
  chrootZfsBpool,
};

const kebabCommands: Record<string, Command> = Object.entries(commands)
  .map(([key, value]) => [kebabCase(key), value] as [string, Command])
  .reduce(
    toObject<string, Command>(),
    {},
  );

export const getCommand = (name: string): Command =>
  kebabCommands[name] || InstallOsPackage.of(name);

export const availableCommands: Array<string> = Object.keys(kebabCommands)
  .sort();
