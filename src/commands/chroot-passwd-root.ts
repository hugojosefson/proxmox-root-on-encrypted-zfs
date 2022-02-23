import { inChrootCommand } from "./chroot-basic-system-environment.ts";
import { config } from "../config.ts";

export async function chrootPasswdRoot() {
  return inChrootCommand(
    "chrootPasswdRoot",
    `passwd root`,
    {
      stdin: `${(await config("ROOT_PASSWORD"))}\n${(await config(
        "ROOT_PASSWORD",
      ))}\n`,
    },
  );
}
