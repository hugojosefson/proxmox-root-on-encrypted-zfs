import { requireEnv } from "./os/require-env.ts";

export type Config = {
  VERBOSE: boolean;
  DISK: string;
  DISK_ENCRYPTION_PASSWORD: string;
};

export const config: Config = {
  VERBOSE: Deno.env.get("VERBOSE") !== "false",
  DISK: requireEnv("DISK"),
  DISK_ENCRYPTION_PASSWORD: requireEnv("DISK_ENCRYPTION_PASSWORD"),
};
