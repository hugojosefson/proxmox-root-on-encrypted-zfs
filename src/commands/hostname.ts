import { CreateFile, LineInFile } from "./common/file-commands.ts";
import { config } from "../config.ts";
import { FileSystemPath } from "../model/dependency.ts";
import { debian3SystemInstallation } from "./debian-3-system-installation.ts";
import { Command } from "../model/command.ts";
import { ROOT } from "../os/user/root.ts";
import { netmask } from "../deps.ts";

export const etcHostname = new CreateFile(
  ROOT,
  FileSystemPath.of(ROOT, "/mnt/etc/hostname"),
  config.FQDN.split(".")[0],
)
  .withDependencies([debian3SystemInstallation]);

function getHostnames() {
  return [config.FQDN, config.FQDN.split(".")[0]]
    .filter((s) => typeof s === "string" && s.length > 0)
    .join(" ");
}

function getIp(): string {
  return netmask(config.IP).ip;
}

export const etcHosts = new LineInFile(
  ROOT,
  FileSystemPath.of(ROOT, "/mnt/etc/hosts"),
  `${getIp()}       ${getHostnames()}`,
)
  .withDependencies([debian3SystemInstallation]);

export const hostname = Command.custom("hostname")
  .withDependencies([
    debian3SystemInstallation,
    etcHostname,
    etcHosts,
  ]);
