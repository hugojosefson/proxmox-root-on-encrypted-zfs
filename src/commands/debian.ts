import { Command } from "../model/command.ts";
import { debian1PrepareInstallEnv } from "./debian-1-prepare-install-env.ts";
import { debian2DiskFormatting } from "./debian-2-disk-formatting.ts";

export const debian = Command.custom().withDependencies([
  debian1PrepareInstallEnv,
  debian2DiskFormatting,
]);
