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

const commands: Record<string, Command> = {
  aptSourcesList,
  debian,
  debian1PrepareInstallEnv,
  debian2DiskFormatting,
  destroyAllPoolsAndDisks,
  nullCommand: Command.custom(),
  upgradeOsPackages: InstallOsPackage.upgradePackages(),
  vim,
  gsettings,
  zfsBootPool,
  zfsRootPool,
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
