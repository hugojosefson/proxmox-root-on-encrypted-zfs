import { CreateFile, LineInFile } from "./common/file-commands.ts";
import { ROOT } from "../os/user/target-user.ts";
import { config } from "../config.ts";
import { FileSystemPath } from "../model/dependency.ts";
import { debian3SystemInstallation } from "./debian-3-system-installation.ts";
import { Command } from "../model/command.ts";

export const etcHostname = new CreateFile(
  ROOT,
  FileSystemPath.of(ROOT, "/mnt/etc/hostname"),
  config.HOSTNAME,
)
  .withDependencies([debian3SystemInstallation]);

function getHostnames() {
  return [config.FQDN, config.HOSTNAME]
    .filter((s) => typeof s === "string" && s.length > 0)
    .join(" ");
}

export const etcHosts = new LineInFile(
  ROOT,
  FileSystemPath.of(ROOT, "/mnt/etc/hosts"),
  `127.0.1.1       ${getHostnames()}`,
);

export const hostname = Command.custom().withDependencies([
  etcHostname,
  etcHosts,
]);
