import { Command } from "../model/command.ts";
import { debian1PrepareInstallEnv } from "./debian-1-prepare-install-env.ts";

export const debian3SystemInstallation = Command.custom()
  .withDependencies([debian1PrepareInstallEnv]);
