import { requireEnv } from "./os/require-env.ts";

export type Config = {
  VERBOSE: boolean;
  NON_INTERACTIVE: boolean;
  DISKS: string[];
  DISK_ENCRYPTION_PASSWORD: string;
  ROOT_PASSWORD: string;
  ROOT_AUTHORIZED_KEYS: string;
  FQDN: string;
  IP: string;
  INITRAMFS_IP: string;
};

export const config: Config = {
  VERBOSE: Deno.env.get("VERBOSE") === "true",
  NON_INTERACTIVE: Deno.env.get("NON_INTERACTIVE") === "true",
  DISKS: (await requireEnv("DISKS")).split(",").map((disk) => disk.trim()),
  DISK_ENCRYPTION_PASSWORD: await requireEnv("DISK_ENCRYPTION_PASSWORD"),
  ROOT_PASSWORD: await requireEnv("ROOT_PASSWORD"),
  ROOT_AUTHORIZED_KEYS: await requireEnv("ROOT_AUTHORIZED_KEYS"),
  FQDN: await requireEnv("FQDN"),
  IP: await requireEnv("IP"),
  INITRAMFS_IP: await requireEnv("INITRAMFS_IP", "IP"),
};
