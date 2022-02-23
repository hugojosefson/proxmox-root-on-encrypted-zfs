import { inChrootCommand } from "./chroot-basic-system-environment.ts";
import { FileSystemPath } from "../model/dependency.ts";
import { CreateFile, MODE_SECRET_600 } from "./common/file-commands.ts";
import { config } from "../config.ts";
import { ROOT } from "../os/user/root.ts";
import { resolveValue } from "../fn.ts";

const chrootInstallOpenSshServer = inChrootCommand(
  "chrootInstallOpenSshServer",
  "apt install -y openssh-server",
);

async function chrootWriteAuthorizedKeys() {
  return new CreateFile(
    ROOT,
    FileSystemPath.of(ROOT, "/mnt/root/.ssh/authorized_keys"),
    await config("ROOT_AUTHORIZED_KEYS"),
    false,
    MODE_SECRET_600,
  );
}

export async function chrootSsh() {
  return (await resolveValue(chrootWriteAuthorizedKeys))
    .withDependencies([chrootInstallOpenSshServer]);
}
