#!/bin/sh
// 2>/dev/null;DENO_VERSION_RANGE="^2.0.3";DENO_RUN_ARGS="--reload=https://raw.githubusercontent.com --allow-all";set -e;V="$DENO_VERSION_RANGE";A="$DENO_RUN_ARGS";h(){ [ -x "$(command -v "$1" 2>&1)" ];};g(){ u="$([ "$(id -u)" != 0 ]&&echo sudo||:)";if h brew;then echo "brew install $1";elif h apt;then echo "($u apt update && $u DEBIAN_FRONTEND=noninteractive apt install -y $1)";elif h yum;then echo "$u yum install -y $1";elif h pacman;then echo "$u pacman -yS --noconfirm $1";elif h opkg-install;then echo "$u opkg-install $1";fi;};p(){ q="$(g "$1")";if [ -z "$q" ];then echo "Please install '$1' manually, then try again.">&2;exit 1;fi;eval "o=\"\$(set +o)\";set -x;$q;set +x;eval \"\$o\"">&2;};f(){ h "$1"||p "$1";};w(){ [ -n "$1" ] && "$1" -V >/dev/null 2>&1;};U="$(l=$(printf "%s" "$V"|wc -c);for i in $(seq 1 $l);do c=$(printf "%s" "$V"|cut -c $i);printf '%%%02X' "'$c";done)";D="$(w "$(command -v deno||:)"||:)";t(){ i="$(if h findmnt;then findmnt -Ononoexec,noro -ttmpfs -nboAVAIL,TARGET|sort -rn|while IFS=$'\n\t ' read -r a m;do [ "$a" -ge 150000000 ]&&[ -d "$m" ]&&printf %s "$m"&&break||:;done;fi)";printf %s "${i:-"${TMPDIR:-/tmp}"}";};z(){ m="$(command -v "$0"||true)";l="/* 2>/dev/null";! [ -z "$m" ]&&[ -r "$m" ]&&[ "$(head -c3 "$m")" = '#!/' ]&&(read x && read y &&[ "$x" = "#!/bin/sh" ]&&[ "$l" != "${y%"$l"*}" ])<"$m";};s(){ deno eval "import{satisfies as e}from'https://deno.land/x/semver@v1.4.1/mod.ts';Deno.exit(e(Deno.version.deno,'$V')?0:1);">/dev/null 2>&1;};e(){ R="$(t)/deno-range-$V/bin";mkdir -p "$R";export PATH="$R:$PATH";s&&return;f curl;v="$(curl -sSfL "https://semver-version.deno.dev/api/github/denoland/deno/$U")";i="$(t)/deno-$v";ln -sf "$i/bin/deno" "$R/deno";s && return;f unzip;([ "${A#*-q}" != "$A" ]&&exec 2>/dev/null;curl -fsSL https://deno.land/install.sh|DENO_INSTALL="$i" sh -s $DENO_INSTALL_ARGS "$v"|grep -iv discord>&2);};e;z&&exec deno run $A "$0" "$@";sed -E 's#from "\.#from "https://raw.githubusercontent.com/hugojosefson/proxmox-root-on-encrypted-zfs/debian-12/src#g' <<'//🔚' | exec deno run $A - "$@"
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
