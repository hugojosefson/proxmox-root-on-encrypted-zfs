import { inChrootCommand } from "./chroot-mount.ts";
import { chrootBasicSystemEnvironment } from "./chroot-basic-system-environment.ts";
import { config } from "../config.ts";

export const chrootPasswdRoot = inChrootCommand(
  `passwd root`,
  {
    stdin: `${config.ROOT_PASSWORD}\n${config.ROOT_PASSWORD}\n`,
  },
)
  .withDependencies([chrootBasicSystemEnvironment]);
