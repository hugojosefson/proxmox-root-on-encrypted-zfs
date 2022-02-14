import { Command, RunResult } from "../model/command.ts";
import { OS_PACKAGE_SYSTEM } from "../model/dependency.ts";
import { ensureSuccessful } from "../os/exec.ts";
import { aptSourcesList } from "./apt-sources-list.ts";
import { ROOT } from "../os/user/root.ts";

export const REFRESH_OS_PACKAGES = Command.custom("REFRESH_OS_PACKAGES")
  .withLocks([OS_PACKAGE_SYSTEM])
  .withRun(async (): Promise<RunResult> => {
    await ensureSuccessful(ROOT, [
      "apt",
      "update",
    ], {
      env: { DEBIAN_FRONTEND: "noninteractive" },
    });
    return `Refreshed list of OS packages.`;
  })
  .withDependencies([aptSourcesList]);
