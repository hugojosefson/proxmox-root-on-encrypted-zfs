import { Command } from "../model/command.ts";
import { hostname } from "./hostname.ts";

export const debian4SystemConfiguration = Command.custom()
  .withDependencies([
    hostname,
  ]);
