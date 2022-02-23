import { CreateFile, LineInFile } from "./common/file-commands.ts";
import { config } from "../config.ts";
import { FileSystemPath } from "../model/dependency.ts";
import { debian3SystemInstallation } from "./debian-3-system-installation.ts";
import { Command } from "../model/command.ts";
import { ROOT } from "../os/user/root.ts";
import { netmask } from "../deps.ts";

export async function etcHostname() {
  return new CreateFile(
    ROOT,
    FileSystemPath.of(ROOT, "/mnt/etc/hostname"),
    (await config("FQDN")).split(".")[0],
  )
    .withDependencies([debian3SystemInstallation]);
}

async function getHostnames(): Promise<string> {
  const fqdn = (await config("FQDN"));
  return [fqdn, fqdn.split(".")[0]]
    .filter((s) => typeof s === "string" && s.length > 0)
    .join(" ");
}

async function getIp(): Promise<string> {
  const ip = (await config("IP"));
  if (ip === "dhcp") {
    return "127.0.1.1";
  }
  return netmask(ip).ip;
}

export async function etcHosts() {
  return new LineInFile(
    ROOT,
    FileSystemPath.of(ROOT, "/mnt/etc/hosts"),
    `${await getIp()}       ${await getHostnames()}`,
  )
    .withDependencies([debian3SystemInstallation]);
}

export const hostname = Command.custom("hostname").withDependencies([
  etcHostname,
  etcHosts,
]);
