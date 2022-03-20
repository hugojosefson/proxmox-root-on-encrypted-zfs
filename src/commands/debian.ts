import { Command } from "../model/command.ts";
import { zfsRebootInstructions } from "./zfs-reboot-instructions.ts";

export const debian = Command.custom("debian")
  .withDependencies([zfsRebootInstructions]);
