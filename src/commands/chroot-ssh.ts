import { InstallOsPackage } from "./common/os-package.ts";
import { chrootBasicSystemEnvironment } from "./chroot-basic-system-environment.ts";

export const chrootSsh = InstallOsPackage.of("openssh-server")
  .withDependencies([chrootBasicSystemEnvironment]);
