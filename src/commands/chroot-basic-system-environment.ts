import { inChrootCommand } from "./chroot-mount.ts";
import { readRelativeFile } from "../os/read-relative-file.ts";

export const chrootBasicSystemEnvironment = inChrootCommand(`
ln -s /proc/self/mounts /etc/mtab
apt-get update

debconf-set-selections << 'EOF'
${await readRelativeFile("./files/debconf-selections", import.meta.url)}
EOF

apt-get install -y console-setup locales
dpkg-reconfigure -f noninteractive locales tzdata keyboard-configuration console-setup

`);
