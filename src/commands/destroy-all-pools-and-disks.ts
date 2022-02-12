import { Command } from "../model/command.ts";
import { ensureSuccessful, ensureSuccessfulStdOut } from "../os/exec.ts";
import { InstallOsPackage } from "./common/os-package.ts";
import { FileSystemPath } from "../model/dependency.ts";
import { ROOT } from "../os/user/root.ts";
import { debian1PrepareInstallEnv } from "./debian-1-prepare-install-env.ts";
import { getDisk } from "../os/find-disk.ts";

export const destroyAllPoolsAndDisks = Command.custom("destroyAllPoolsAndDisks")
  .withLocks([FileSystemPath.of(ROOT, await getDisk())])
  .withDependencies([
    debian1PrepareInstallEnv,
    InstallOsPackage.of("gdisk"),
    InstallOsPackage.of("mdadm"),
  ])
  .withRun(async () => {
    await ensureSuccessful(ROOT, ["swapoff", "--all"]);
    await ensureSuccessful(ROOT, [
      "sh",
      "-c",
      `
mount | grep -v zfs | tac | awk '/\\/mnt/ {print $3}' | xargs -i{} umount -lf {}
zpool export -a

umount /mnt/* || true
rm -rf /mnt/debootstrap || true
rmdir /mnt/* || true
`,
    ]);
    const mdArrays: string[] = (await ensureSuccessfulStdOut(ROOT, [
      "sh",
      "-c",
      "[ -b /dev/md* ] && ls -d /dev/md* || true",
    ])).split("\n").filter(Boolean);
    await Promise.all(
      mdArrays
        .map((dev) => ["mdadm", "--stop", dev])
        .map((cmd) => ensureSuccessful(ROOT, cmd)),
    );
    if (mdArrays.length) {
      await ensureSuccessful(ROOT, [
        "mdadm",
        "--zero-superblock",
        "--force",
        await getDisk(),
      ]);
    }
    const pools =
      (await ensureSuccessfulStdOut(ROOT, "zpool list -o name -H".split(" ")))
        .split("\n").filter(Boolean);
    await Promise.all(
      pools.map((pool) =>
        ensureSuccessful(ROOT, `zpool destroy -f ${pool}`.split(" "))
      ),
    );

    await ensureSuccessful(ROOT, ["wipefs", "--all", await getDisk()]);
    await ensureSuccessful(ROOT, ["sgdisk", "--zap-all", await getDisk()]);
    await ensureSuccessful(ROOT, ["sgdisk", "--clear", await getDisk()]);
  });
