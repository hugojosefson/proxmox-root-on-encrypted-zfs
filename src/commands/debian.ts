import { Command } from "../model/command.ts";
import { debian5GrubInstallation } from "./debian-5-grub-installation.ts";
import { debian8DisableLogCompression } from "./debian-8-disable-log-compression.ts";
import { debian6FirstBoot } from "./debian-6-first-boot.ts";
import { debian4SystemConfiguration } from "./debian-4-system-configuration.ts";
import { debian3SystemInstallation } from "./debian-3-system-installation.ts";
import { debian2DiskFormatting } from "./debian-2-disk-formatting.ts";
import { debian1PrepareInstallEnv } from "./debian-1-prepare-install-env.ts";

export const debian = Command.custom("debian")
  .withDependencies([
    debian1PrepareInstallEnv,
    debian2DiskFormatting,
    debian3SystemInstallation,
    debian4SystemConfiguration,
    debian5GrubInstallation,
    debian6FirstBoot,
    debian8DisableLogCompression,
  ]);
