import { debian3SystemInstallation } from "./debian-3-system-installation.ts";
import { Command } from "../model/command.ts";
import { CreateFile } from "./common/file-commands.ts";
import { FileSystemPath } from "../model/dependency.ts";
import { findNetworkDevice } from "../os/find-network-device.ts";
import { ROOT } from "../os/user/root.ts";
import { config } from "../config.ts";
import { netmask } from "../deps.ts";

export const networkInterface = Command.custom("networkInterface")
  .withDependencies([debian3SystemInstallation])
  .withRun(async () => {
    const device = await findNetworkDevice();
    const interfacePath = FileSystemPath.of(
      ROOT,
      `/mnt/etc/network/interfaces.d/${device}`,
    );
    const contents = config.IP === "dhcp"
      ? `auto ${device}
iface ${device} inet dhcp`
      : `auto ${device}
iface ${device} inet static
address ${netmask(config.IP).ip}
netmask ${netmask(config.IP).mask}
gateway ${netmask(config.IP).gateway}
`;
    return [
      new CreateFile(ROOT, interfacePath, contents).withDependencies([
        debian3SystemInstallation,
      ]),
    ];
  });
