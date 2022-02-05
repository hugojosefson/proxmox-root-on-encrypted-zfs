import { Command } from "../model/command.ts";
import { debian1PrepareInstallEnv } from "./debian-1-prepare-install-env.ts";
import { debian2DiskFormatting } from "./debian-2-disk-formatting.ts";
import { debian3SystemInstallation } from "./debian-3-system-installation.ts";
import { debian4SystemConfiguration } from "./debian-4-system-configuration.ts";

export const debian = Command.custom().withDependencies([
  debian1PrepareInstallEnv,
  debian2DiskFormatting,
  debian3SystemInstallation,
  debian4SystemConfiguration,
]);
