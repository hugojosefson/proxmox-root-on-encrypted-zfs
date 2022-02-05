import { Command } from "../model/command.ts";
import { targetUser } from "../os/user/target-user.ts";
import { gsettingsToCmds } from "./common/gsettings-to-cmds.ts";
import { InstallOsPackage } from "./common/os-package.ts";
import { Exec } from "./exec.ts";

const gsettingsExecCommand = (deps: Command[] = []) =>
  (cmd: Array<string>) =>
    new Exec(
      [InstallOsPackage.of("libglib2.0-bin"), ...deps],
      [],
      targetUser,
      {},
      cmd,
    );

export const gsettings = Command.custom()
  .withDependencies(
    gsettingsToCmds(`
org.gnome.desktop.media-handling automount false
org.gnome.settings-daemon.plugins.power sleep-inactive-ac-type nothing
`).map(gsettingsExecCommand([
      "gnome-shell",
    ].map(InstallOsPackage.of))),
  );
