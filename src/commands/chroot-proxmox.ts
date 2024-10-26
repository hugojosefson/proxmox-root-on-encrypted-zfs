import { Command } from "../model/command.ts";
import { chrootBasicSystemEnvironment } from "./chroot-basic-system-environment.ts";
import { inChrootCommand } from "./in-chroot-command.ts";

export const chrootProxmoxPrepare = inChrootCommand(
  "chrootProxmoxPrepare",
  `
apt install -y vim byobu nmap mtr-tiny man ncdu tree whois
echo EDITOR=vim >> /etc/environment
byobu-enable

apt install -y wget
echo "deb [arch=amd64] http://download.proxmox.com/debian/pve bookworm pve-no-subscription" > /etc/apt/sources.list.d/pve-install-repo.list

cd /etc/apt/trusted.gpg.d/
wget https://enterprise.proxmox.com/debian/proxmox-release-bookworm.gpg -O proxmox-release-bookworm.gpg
echo '7da6fe34168adc6e479327ba517796d4702fa2f8b4f0a9833f5ea6e6b48f6507a6da403a274fe201595edc86a84463d50383d07f64bdde2e3658108db7d6dc87 *proxmox-release-bookworm.gpg' | sha512sum --check --strict

apt update
apt full-upgrade -y
apt install -y open-iscsi postfix chrony
apt install -y --download-only proxmox-default-kernel proxmox-ve
`,
);

export const chrootProxmox = Command.custom("chrootProxmox")
  .withDependencies([chrootBasicSystemEnvironment]);
