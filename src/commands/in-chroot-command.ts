import { Command } from "../model/command.ts";
import { ensureSuccessful, ExecOptions } from "../os/exec.ts";
import { FileSystemPath } from "../model/dependency.ts";
import { ROOT } from "../os/user/root.ts";
import {
  chrootBasicSystemEnvironment,
  inChrootPrefix,
} from "./chroot-basic-system-environment.ts";

export function inChrootCommand(
  name: string,
  cmds: string,
  options?: ExecOptions,
): Command {
  return Command.custom(`inChrootCommand(${name})`)
    .withDependencies([chrootBasicSystemEnvironment])
    .withLocks(
      cmds.includes("apt") ? [FileSystemPath.of(ROOT, "/mnt/var/lib/apt")] : [],
    )
    .withRun(async () => {
      await ensureSuccessful(ROOT, inChrootPrefix(cmds), options);
    });
}
