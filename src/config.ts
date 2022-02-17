import { requireEnv } from "./os/require-env.ts";

export type Config = {
  VERBOSE: boolean;
  DISK_ENCRYPTION_PASSWORD: string;
  ROOT_PASSWORD: string;
  ROOT_AUTHORIZED_KEYS: string;
  HOSTNAME: string;
  FQDN: string;
  IP: string;
  INITRAMFS_IP: string;
};

export const config: Config = {
  VERBOSE: Deno.env.get("VERBOSE") === "true",
  DISK_ENCRYPTION_PASSWORD: await requireEnv("DISK_ENCRYPTION_PASSWORD"),
  ROOT_PASSWORD: await requireEnv("ROOT_PASSWORD"),
  ROOT_AUTHORIZED_KEYS: await requireEnv("ROOT_AUTHORIZED_KEYS"),
  HOSTNAME: await requireEnv("HOSTNAME"),
  FQDN: await requireEnv("FQDN"),
  IP: Deno.env.get("IP") ?? "dhcp",
  INITRAMFS_IP: Deno.env.get("INITRAMFS_IP") ?? Deno.env.get("IP") ?? "dhcp",
};
