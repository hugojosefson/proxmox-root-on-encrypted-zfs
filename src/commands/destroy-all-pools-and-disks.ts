import { Command } from "../model/command.ts";
import { config } from "../config.ts";
import { ensureSuccessful, ensureSuccessfulStdOut } from "../os/exec.ts";
import { InstallOsPackage } from "./common/os-package.ts";
import { FileSystemPath } from "../model/dependency.ts";
import { ROOT } from "../os/user/target-user.ts";

export const destroyAllPoolsAndDisks = Command.custom()
  .withLocks([FileSystemPath.of(ROOT, config.DISK)])
  .withDependencies([
    InstallOsPackage.of("zfsutils-linux"),
    InstallOsPackage.of("gdisk"),
    InstallOsPackage.of("mdadm"),
  ])
  .withRun(async () => {
    console.log("destroyAllPoolsAndDisks: running...");
    await ensureSuccessful(ROOT, ["swapoff", "--all"]);
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
        config.DISK,
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

    await ensureSuccessful(ROOT, ["wipefs", "--all", config.DISK]);
    await ensureSuccessful(ROOT, ["sgdisk", "--zap-all", config.DISK]);
    console.log("destroyAllPoolsAndDisks: running...DONE.");
  });
