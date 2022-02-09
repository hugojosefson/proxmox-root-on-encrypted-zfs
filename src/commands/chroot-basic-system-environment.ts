import { readRelativeFile } from "../os/read-relative-file.ts";
import { ensureSuccessful, ExecOptions } from "../os/exec.ts";
import { Command } from "../model/command.ts";
import { ROOT } from "../os/user/root.ts";
import { hostname } from "./hostname.ts";
import { networkInterface } from "./network-interface.ts";
import { aptSourcesListMnt } from "./apt-sources-list-mnt.ts";

function inChrootPrefix(cmds: string): string[] {
  return [
    `chroot`,
    `/mnt`,
    `/usr/bin/env`,
    `bash`,
    `--login`,
    `-c`,
    cmds,
  ];
}

const chrootMount = (paths: string[]) =>
  Command.custom()
    .withDependencies(paths.map((path) =>
      Command.custom()
        .withDependencies([
          hostname,
          networkInterface,
          aptSourcesListMnt,
        ])
        .withSkipIfAll([async () => {
          await ensureSuccessful(ROOT, [
            "sh",
            "-c",
            `mount | grep "/mnt${path}"`,
          ]);
          return true;
        }])
        .withRun(async () => {
          await ensureSuccessful(ROOT, [
            "mount",
            "--make-private",
            "--rbind",
            path,
            "/mnt" + path,
          ]);
        })
    ));

export function inChrootCommand(
  cmds: string,
  options?: ExecOptions,
  skipDependencyOnChrootBasicSystemEnvironment = false,
): Command {
  return Command.custom()
    .withDependencies([
      skipDependencyOnChrootBasicSystemEnvironment
        ? chrootMount(["/dev", "/proc", "/sys"])
        : chrootBasicSystemEnvironment,
    ])
    .withRun(async () => {
      await ensureSuccessful(ROOT, inChrootPrefix(cmds), options);
    });
}

export const chrootBasicSystemEnvironment = inChrootCommand(
  `
ln -sf /proc/self/mounts /etc/mtab
apt-get update

debconf-set-selections << 'EOF'
${await readRelativeFile("./files/debconf-selections", import.meta.url)}
EOF

apt-get install -y console-setup locales
dpkg-reconfigure -f noninteractive locales tzdata keyboard-configuration console-setup

`,
  undefined,
  true,
);
