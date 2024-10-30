#!/bin/sh
// 2>/dev/null;DENO_VERSION_RANGE="1.20.2";DENO_RUN_ARGS="--reload=https://raw.githubusercontent.com --unstable --allow-all";: "Via https://github.com/hugojosefson/deno-shebang CC BY 4.0";set -e;(command -v sudo>/dev/null||DEBIAN_FRONTEND=noninteractive apt install -y sudo>/dev/null);(command -v unzip>/dev/null||(sudo apt update && sudo DEBIAN_FRONTEND=noninteractive apt install -y unzip>/dev/null));V="$DENO_VERSION_RANGE";A="$DENO_RUN_ARGS";E="$(expr "$(echo "$V"|curl -Gso/dev/null -w%{url_effective} --data-urlencode @- "")" : '..\(.*\)...')";D="$(command -v deno||true)";t(){ d="$(mktemp)";rm "${d}";dirname "${d}";};f(){ m="$(command -v "$0"||true)";l="/* 2>/dev/null";! [ -z $m ]&&[ -r $m ]&&[ "$(head -c3 "$m")" = '#!/' ]&&(read x && read y &&[ "$x" = "#!/bin/sh" ]&&[ "$l" != "${y%"$l"*}" ])<"$m";};a(){ [ -n $D ];};s(){ a&&[ -x "$R/deno" ]&&[ "$R/deno" = "$D" ]&&return;deno eval "import{satisfies as e}from'https://deno.land/x/semver@v1.3.0/mod.ts';Deno.exit(e(Deno.version.deno,'$V')?0:1);">/dev/null 2>&1;};g(){ curl -sSfL "https://api.mattandre.ws/semver/github/denoland/deno/$U";};e(){ R="$(t)/deno-range-$V/bin";mkdir -p "$R";export PATH="$R:$PATH";[ -x "$R/deno" ]&&return;a&&s&&([ -L "$R/deno" ]||ln -s "$D" "$R/deno")&&return;v="$(g)";i="$(t)/deno-$v";[ -L "$R/deno" ]||ln -s "$i/bin/deno" "$R/deno";s && return;echo -n "Downloading temporary deno...">&2;curl -fsSL https://deno.land/x/install/install.sh|DENO_INSTALL="$i" sh -s "$v" 2>/dev/null >&2;};e;f&&exec deno run $A "$0" "$@";r="$(t)/write-availabla-commands.ts";cat > "$r" <<'//🔚'
// Run this script with sudo to update the list of available commands for the usage help text.

import { getTargetUser } from "./os/user/target-user.ts";

export async function writeAvailableCommands(): Promise<void> {
  const { kebabCommands } = await import("./commands/index.ts");
  const availableCommands: Array<string> = Object.keys(kebabCommands)
    .sort();
  const file = new URL("./commands/available-commands.ts", import.meta.url);
  const lines = availableCommands.map((command) =>
    `  "${command}",
`
  );
  const data =
    `// Update this file automatically by running \`sudo ./src/write-available-commands.ts\`
export const availableCommands: string[] = [
${lines.join("")}];
`;
  await Deno.writeTextFile(file, data);
  const { uid, gid } = await getTargetUser();
  await Deno.chown(file, uid, gid);
}

if (import.meta.main) {
  Object.entries({
    VERBOSE: "false",
    DISK_ENCRYPTION_PASSWORD: "string",
    ROOT_PASSWORD: "string",
    ROOT_AUTHORIZED_KEYS: "string",
    FQDN: "string",
    IP: "10.10.10.10/24",
    INITRAMFS_IP: "10.10.10.10/24",
    DISKS: "string",
  }).forEach(([key, value]) => Deno.env.set(key, value));

  await writeAvailableCommands();
}

//🔚
// 2>/dev/null || :; sed -E 's#from "\.#from "https://raw.githubusercontent.com/hugojosefson/proxmox-root-on-encrypted-zfs/debian11/src#g' -i "$r";exec deno run $A "$r" "$@"
