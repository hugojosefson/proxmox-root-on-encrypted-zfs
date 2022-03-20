import { Command } from "../model/command.ts";
import { FileSystemPath } from "../model/dependency.ts";
import { ROOT } from "../os/user/root.ts";
import { chrootDropbearRemoteUnlocking } from "./chroot-dropbear-remote-unlocking.ts";
import { getDisks } from "../os/find-disk.ts";
import { chrootProxmox } from "./chroot-proxmox.ts";

export const debian4SystemConfiguration = Command.custom(
  "debian4SystemConfiguration",
)
  .withLocks((await getDisks()).map((disk) => FileSystemPath.of(ROOT, disk)))
  .withDependencies([
    chrootDropbearRemoteUnlocking,
    chrootProxmox,
  ]);
