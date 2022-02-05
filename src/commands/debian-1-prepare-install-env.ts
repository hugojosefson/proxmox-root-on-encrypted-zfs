import { InstallOsPackage } from "./common/os-package.ts";
import { Command } from "../model/command.ts";
import { gsettings } from "./gsettings.ts";
import { REFRESH_OS_PACKAGES } from "./refresh-os-packages.ts";

export const debian1PrepareInstallEnv = Command.custom().withDependencies([
  REFRESH_OS_PACKAGES,
  gsettings,
  ...["debootstrap", "gdisk", "zfsutils-linux"].map(InstallOsPackage.of),
]);
