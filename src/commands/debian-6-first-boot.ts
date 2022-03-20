import { Command } from "../model/command.ts";
import { zfsRebootInstructions } from "./zfs-reboot-instructions.ts";

export const debian6FirstBoot = Command.custom("debian6FirstBoot")
  .withDependencies([zfsRebootInstructions]);
