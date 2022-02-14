import { Command } from "../model/command.ts";
import { debian5GrubInstallation } from "./debian-5-grub-installation.ts";
import { debian8DisableLogCompression } from "./debian-8-disable-log-compression.ts";

export const debian = Command.custom("debian").withDependencies([
  debian5GrubInstallation,
  debian8DisableLogCompression,
]);
