import { Command } from "../../model/command.ts";
import { memoize } from "../../deps.ts";

function getNoop(): Command {
  return Command.custom("NOOP");
}

export const NOOP: typeof getNoop = memoize(getNoop);
