import { Command } from "../../model/command.ts";
import { memoize } from "../../deps.ts";

export const NOOP = memoize(() => (new Command()));
