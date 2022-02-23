import { Command } from "../model/command.ts";
import { debian5GrubInstallation } from "./debian-5-grub-installation.ts";
import { debian8DisableLogCompression } from "./debian-8-disable-log-compression.ts";
import { debian6FirstBoot } from "./debian-6-first-boot.ts";

export function debian() {
  return Command.custom("debian")
    .withDependencies([
      debian5GrubInstallation,
      debian8DisableLogCompression,
      debian6FirstBoot,
    ]);
}
