import { Command } from "../model/command.ts";
import { debian4SystemConfiguration } from "./debian-4-system-configuration.ts";

export const debian = Command.custom().withDependencies([
  debian4SystemConfiguration,
]);
