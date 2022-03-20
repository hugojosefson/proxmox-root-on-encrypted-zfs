import { config } from "../config.ts";
import { inChrootCommand } from "./in-chroot-command.ts";
import { chrootGrub } from "./chroot-grub.ts";

export const chrootPasswdRoot = inChrootCommand(
  "chrootPasswdRoot",
  `passwd root`,
  {
    stdin: `${config.ROOT_PASSWORD}\n${config.ROOT_PASSWORD}\n`,
  },
)
  .withDependencies([chrootGrub]);
