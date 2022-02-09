import { inChrootCommand } from "./chroot-basic-system-environment.ts";
import { zfsBootPool } from "./debian-2-disk-formatting.ts";

const zfsImportBpoolService = inChrootCommand(`

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
  `).withDependencies([zfsBootPool]);

export const chrootZfsBpool = inChrootCommand(
  "systemctl enable zfs-import-bpool.service",
)
  .withDependencies([zfsImportBpoolService]);
