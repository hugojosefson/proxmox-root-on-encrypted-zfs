import { inChrootCommand } from "./in-chroot-command.ts";
import { chrootPasswdRoot } from "./chroot-passwd-root.ts";

export const chrootZfsBpool = inChrootCommand(
  "chrootZfsBpool",
  `
mkdir -p /etc/systemd/system/

cat > /etc/systemd/system/zfs-import-bpool.service << 'EOF'
[Unit]
DefaultDependencies=no
Before=zfs-import-scan.service
Before=zfs-import-cache.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/sbin/zpool import -N -o cachefile=none bpool
# Work-around to preserve zpool cache:
ExecStartPre=-/bin/mv /etc/zfs/zpool.cache /etc/zfs/preboot_zpool.cache
ExecStartPost=-/bin/mv /etc/zfs/preboot_zpool.cache /etc/zfs/zpool.cache

[Install]
WantedBy=zfs-import.target
EOF

systemctl enable zfs-import-bpool.service
`,
)
  .withDependencies([chrootPasswdRoot]);
