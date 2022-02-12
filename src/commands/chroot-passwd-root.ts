import { inChrootCommand } from "./chroot-basic-system-environment.ts";
import { config } from "../config.ts";

export const chrootPasswdRoot = inChrootCommand(
  "chrootPasswdRoot",
  `passwd root`,
  {
    stdin: `${config.ROOT_PASSWORD}\n${config.ROOT_PASSWORD}\n`,
  },
);
