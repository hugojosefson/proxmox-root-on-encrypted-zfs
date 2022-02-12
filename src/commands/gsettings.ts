import { Command } from "../model/command.ts";
import { targetUserPromise } from "../os/user/target-user.ts";
import { gsettingsToCmds } from "./common/gsettings-to-cmds.ts";
import { InstallOsPackage, isInstalledOsPackage } from "./common/os-package.ts";
import { Exec } from "./exec.ts";

async function gsettingsExecCommand(cmd: Array<string>): Promise<Exec> {
  return new Exec(
    [InstallOsPackage.of("libglib2.0-bin"), InstallOsPackage.of("gnome-shell")],
    [],
    await targetUserPromise,
    {},
    cmd,
  );
}

export const gsettings = await isInstalledOsPackage("libglib2.0-bin")
  ? Command.custom("gsettings")
    .withDependencies(
      await Promise.all(
        gsettingsToCmds(`
org.gnome.desktop.media-handling automount false
org.gnome.settings-daemon.plugins.power sleep-inactive-ac-type nothing
`).map(gsettingsExecCommand),
      ),
    )
  : Command.custom("!gsettings");
