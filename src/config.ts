import { requireEnv } from "./os/require-env.ts";

export type Config = {
  VERBOSE: boolean;
  DISK: string;
  DISK_ENCRYPTION_PASSWORD: string;
  HOSTNAME: string;
  FQDN?: string;
};

export const config: Config = {
  VERBOSE: Deno.env.get("VERBOSE") !== "false",
  DISK: await requireEnv("DISK"),
  DISK_ENCRYPTION_PASSWORD: await requireEnv("DISK_ENCRYPTION_PASSWORD"),
  HOSTNAME: await requireEnv("HOSTNAME"),
  FQDN: Deno.env.get("FQDN"),
};
