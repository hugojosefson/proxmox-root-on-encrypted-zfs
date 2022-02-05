import { requireEnv } from "./os/require-env.ts";

export type Config = {
  VERBOSE: boolean;
  DISK: string;
};

export const config: Config = {
  VERBOSE: Deno.env.get("VERBOSE") !== "false",
  DISK: requireEnv("DISK"),
};
