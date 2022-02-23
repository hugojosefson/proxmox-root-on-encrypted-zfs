import { requireEnv } from "./os/require-env.ts";
import { resolveValue } from "./fn.ts";

export type Config = {
  VERBOSE: boolean;
  DISK_ENCRYPTION_PASSWORD: string;
  ROOT_PASSWORD: string;
  ROOT_AUTHORIZED_KEYS: string;
  FQDN: string;
  IP: string;
  INITRAMFS_IP: string;
};

export function config(key: keyof Config): Promise<string> {
  return resolveValue(
    ({
      VERBOSE: () => Deno.env.get("VERBOSE") === "true" ? "true" : "",
      DISK_ENCRYPTION_PASSWORD: async () =>
        await requireEnv("DISK_ENCRYPTION_PASSWORD"),
      ROOT_PASSWORD: async () => await requireEnv("ROOT_PASSWORD"),
      ROOT_AUTHORIZED_KEYS: async () =>
        await requireEnv("ROOT_AUTHORIZED_KEYS"),
      FQDN: async () => await requireEnv("FQDN"),
      IP: () => Deno.env.get("IP") ?? "dhcp",
      INITRAMFS_IP: () =>
        Deno.env.get("INITRAMFS_IP") ?? Deno.env.get("IP") ?? "dhcp",
    })[key],
  );
}
