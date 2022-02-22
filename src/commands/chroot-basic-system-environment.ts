import { readRelativeFile } from "../os/read-relative-file.ts";
import { ensureSuccessful, ExecOptions } from "../os/exec.ts";
import { Command, Sequential } from "../model/command.ts";
import { ROOT } from "../os/user/root.ts";
import { hostname } from "./hostname.ts";
import { networkInterface } from "./network-interface.ts";
import { aptSourcesListMnt } from "./apt-sources-list-mnt.ts";
import { FileSystemPath } from "../model/dependency.ts";
import { config } from "../config.ts";

export function inChrootPrefix(cmds: string): string[] {
  return [
    `chroot`,
    `/mnt`,
    `/usr/bin/env`,
    `bash`,
    `--login`,
    `-euo`,
    `pipefail`,
    `-c`,
    cmds,
  ];
}

const chrootMount = (paths: string[]) =>
  new Sequential(
    "chrootMount",
    paths.map((path) =>
      Command.custom(path)
        .withSkipIfAll([async () => {
          await ensureSuccessful(ROOT, [
            "sh",
            "-c",
            `mount | grep "/mnt${path}"`,
          ]);
          return true;
        }])
        .withRun(async () => {
          const mountPath = "/mnt" + path;
          await Deno.mkdir(mountPath, { recursive: true });
          await ensureSuccessful(ROOT, [
            "mount",
            "--make-private",
            "--rbind",
            path,
            mountPath,
          ]);
        })
    ),
  )
    .withDependencies([
      hostname,
      networkInterface,
      aptSourcesListMnt,
    ]);

export function inChrootCommand(
  name: string,
  cmds: string,
  options?: ExecOptions,
  skipDependencyOnChrootBasicSystemEnvironment = false,
): Command {
  return Command.custom(`inChrootCommand(${name})`)
    .withDependencies([
      skipDependencyOnChrootBasicSystemEnvironment
        ? chrootMount(["/dev", "/proc", "/sys"])
        : chrootBasicSystemEnvironment,
    ])
    .withLocks(
      cmds.includes("apt") ? [FileSystemPath.of(ROOT, "/mnt/var/lib/apt")] : [],
    )
    .withRun(async () => {
      await ensureSuccessful(ROOT, inChrootPrefix(cmds), options);
    });
}

export const chrootBasicSystemEnvironment = inChrootCommand(
  "chrootBasicSystemEnvironment",
  `
ln -sf /proc/self/mounts /etc/mtab
apt update
apt full-upgrade -y

debconf-set-selections << 'EOF'
${
    (await readRelativeFile("./files/debconf-selections", import.meta.url))
      .replace(/@@FQDN@@/g, config.FQDN)
  }
EOF

apt install -y console-setup locales
dpkg-reconfigure -f noninteractive locales tzdata keyboard-configuration console-setup

`,
  undefined,
  true,
);
