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
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/proxmox-archive-keyring.gpg] http://download.proxmox.com/debian/pve trixie pve-no-subscription" > /etc/apt/sources.list.d/pve-install-repo.list

wget https://enterprise.proxmox.com/debian/proxmox-archive-keyring-trixie.gpg -O /usr/share/keyrings/proxmox-archive-keyring.gpg
echo '136673be77aba35dcce385b28737689ad64fd785a797e57897589aed08db6e45 /usr/share/keyrings/proxmox-archive-keyring.gpg' | sha256sum --check --strict

apt update
apt full-upgrade -y
apt install -y open-iscsi postfix chrony
apt install -y --download-only proxmox-default-kernel proxmox-ve
`,
);

export const chrootProxmox = Command.custom("chrootProxmox")
  .withDependencies([chrootBasicSystemEnvironment]);