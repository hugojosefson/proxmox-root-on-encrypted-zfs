import { Command } from "../model/command.ts";
import { chrootBasicSystemEnvironment } from "./chroot-basic-system-environment.ts";
import { inChrootCommand } from "./in-chroot-command.ts";

export const chrootProxmoxPrepare = inChrootCommand(
  "chrootProxmoxPrepare",
  `
apt install -y wget
echo "deb [arch=amd64] http://download.proxmox.com/debian/pve bullseye pve-no-subscription" > /etc/apt/sources.list.d/pve-install-repo.list

cd /etc/apt/trusted.gpg.d/
wget https://enterprise.proxmox.com/debian/proxmox-release-bullseye.gpg -O proxmox-release-bullseye.gpg
echo '7fb03ec8a1675723d2853b84aa4fdb49a46a3bb72b9951361488bfd19b29aab0a789a4f8c7406e71a69aabbc727c936d3549731c4659ffa1a08f44db8fdcebfa *proxmox-release-bullseye.gpg' | sha512sum --check --strict

apt update
apt full-upgrade -y
apt install -y open-iscsi postfix
apt install -y --download-only proxmox-ve
`,
);

export const chrootProxmox = Command.custom("chrootProxmox")
  .withDependencies([chrootBasicSystemEnvironment]);
