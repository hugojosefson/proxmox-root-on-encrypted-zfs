import { requireEnv } from "./os/require-env.ts";

export type Config = {
  VERBOSE: boolean;
  DISK: string;
  DISK_ENCRYPTION_PASSWORD: string;
};

export const config: Config = {
  VERBOSE: Deno.env.get("VERBOSE") !== "false",
  DISK: await requireEnv("DISK"),
  DISK_ENCRYPTION_PASSWORD: await requireEnv("DISK_ENCRYPTION_PASSWORD"),
};
