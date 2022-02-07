import { requireEnv } from "./os/require-env.ts";
import { findDisk } from "./os/find-disk.ts";
import { memoize } from "./deps.ts";

export type Config = {
  VERBOSE: boolean;
  DISK: typeof getDisk;
  DISK_ENCRYPTION_PASSWORD: string;
  HOSTNAME: string;
  FQDN?: string;
};

async function getDisk(): Promise<string> {
  return Deno.env.get("DISK") ?? await findDisk();
}

export const config: Config = {
  VERBOSE: Deno.env.get("VERBOSE") !== "false",
  DISK: memoize(getDisk),
  DISK_ENCRYPTION_PASSWORD: await requireEnv("DISK_ENCRYPTION_PASSWORD"),
  HOSTNAME: await requireEnv("HOSTNAME"),
  FQDN: Deno.env.get("FQDN"),
};
