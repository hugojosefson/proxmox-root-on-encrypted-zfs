import { inChrootCommand } from "./chroot-basic-system-environment.ts";
import { FileSystemPath } from "../model/dependency.ts";
import { CreateFile, MODE_SECRET_600 } from "./common/file-commands.ts";
import { config } from "../config.ts";
import { ROOT } from "../os/user/root.ts";

const chrootInstallOpenSshServer = inChrootCommand(
  "chrootInstallOpenSshServer",
  "apt-get install -y openssh-server",
);

const chrootWriteAuthorizedKeys = new CreateFile(
  ROOT,
  FileSystemPath.of(ROOT, "/mnt/root/.ssh/authorized_keys"),
  config.ROOT_AUTHORIZED_KEYS,
  true,
  MODE_SECRET_600,
);

export const chrootSsh = chrootWriteAuthorizedKeys
  .withDependencies([chrootInstallOpenSshServer]);
