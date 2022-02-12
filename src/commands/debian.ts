import { Command } from "../model/command.ts";
import { debian5GrubInstallation } from "./debian-5-grub-installation.ts";

export const debian = Command.custom("debian").withDependencies([
  debian5GrubInstallation,
]);
