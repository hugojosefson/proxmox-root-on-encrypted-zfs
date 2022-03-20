import { Command } from "../model/command.ts";
import { debian8DisableLogCompression } from "./debian-8-disable-log-compression.ts";

export const debian = Command.custom("debian")
  .withDependencies([
    debian8DisableLogCompression,
  ]);
