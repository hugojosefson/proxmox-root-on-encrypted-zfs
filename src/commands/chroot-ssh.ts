import { FileSystemPath } from "../model/dependency.ts";
import { CreateFile, MODE_SECRET_600 } from "./common/file-commands.ts";
import { config } from "../config.ts";
import { ROOT } from "../os/user/root.ts";
import { inChrootCommand } from "./in-chroot-command.ts";
import { chrootTmpfs } from "./chroot-tmpfs.ts";
import { Command } from "../model/command.ts";

const chrootInstallOpenSshServer = inChrootCommand(
  "chrootInstallOpenSshServer",
  "apt install -y openssh-server",
)
  .withDependencies([chrootTmpfs]);

const chrootWriteAuthorizedKeys = new CreateFile(
  ROOT,
  FileSystemPath.of(ROOT, "/mnt/root/.ssh/authorized_keys"),
  config.ROOT_AUTHORIZED_KEYS,
  false,
  MODE_SECRET_600,
)
  .withDependencies([chrootInstallOpenSshServer]);

export const chrootSsh = Command.custom("chrootSsh")
  .withDependencies([chrootWriteAuthorizedKeys]);
