import { CreateFile } from "./common/file-commands.ts";
import { ROOT } from "../os/user/root.ts";
import { FileSystemPath } from "../model/dependency.ts";
import { inChrootCommand } from "./chroot-basic-system-environment.ts";

const zfsImportBpoolService = new CreateFile(
  ROOT,
  FileSystemPath.of(ROOT, "/mnt/etc/systemd/system/zfs-import-bpool.service"),
  `[Unit]
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
WantedBy=zfs-import.target`,
);

export const chrootZfsBpool = inChrootCommand(
  "systemctl enable zfs-import-bpool.service",
)
  .withDependencies([zfsImportBpoolService]);
