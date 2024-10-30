#!/bin/sh
// 2>/dev/null;DENO_VERSION_RANGE="^2.0.3";DENO_RUN_ARGS="--reload=https://raw.githubusercontent.com --allow-all";set -e;V="$DENO_VERSION_RANGE";A="$DENO_RUN_ARGS";h(){ [ -x "$(command -v "$1" 2>&1)" ];};g(){ u="$([ "$(id -u)" != 0 ]&&echo sudo||:)";if h brew;then echo "brew install $1";elif h apt;then echo "($u apt update && $u DEBIAN_FRONTEND=noninteractive apt install -y $1)";elif h yum;then echo "$u yum install -y $1";elif h pacman;then echo "$u pacman -yS --noconfirm $1";elif h opkg-install;then echo "$u opkg-install $1";fi;};p(){ q="$(g "$1")";if [ -z "$q" ];then echo "Please install '$1' manually, then try again.">&2;exit 1;fi;eval "o=\"\$(set +o)\";set -x;$q;set +x;eval \"\$o\"">&2;};f(){ h "$1"||p "$1";};w(){ [ -n "$1" ] && "$1" -V >/dev/null 2>&1;};U="$(l=$(printf "%s" "$V"|wc -c);for i in $(seq 1 $l);do c=$(printf "%s" "$V"|cut -c $i);printf '%%%02X' "'$c";done)";D="$(w "$(command -v deno||:)"||:)";t(){ i="$(if h findmnt;then findmnt -Ononoexec,noro -ttmpfs -nboAVAIL,TARGET|sort -rn|while IFS=$'\n\t ' read -r a m;do [ "$a" -ge 150000000 ]&&[ -d "$m" ]&&printf %s "$m"&&break||:;done;fi)";printf %s "${i:-"${TMPDIR:-/tmp}"}";};z(){ m="$(command -v "$0"||true)";l="/* 2>/dev/null";! [ -z "$m" ]&&[ -r "$m" ]&&[ "$(head -c3 "$m")" = '#!/' ]&&(read x && read y &&[ "$x" = "#!/bin/sh" ]&&[ "$l" != "${y%"$l"*}" ])<"$m";};s(){ deno eval "import{satisfies as e}from'https://deno.land/x/semver@v1.4.1/mod.ts';Deno.exit(e(Deno.version.deno,'$V')?0:1);">/dev/null 2>&1;};e(){ R="$(t)/deno-range-$V/bin";mkdir -p "$R";export PATH="$R:$PATH";s&&return;f curl;v="$(curl -sSfL "https://semver-version.deno.dev/api/github/denoland/deno/$U")";i="$(t)/deno-$v";ln -sf "$i/bin/deno" "$R/deno";s && return;f unzip;([ "${A#*-q}" != "$A" ]&&exec 2>/dev/null;curl -fsSL https://deno.land/install.sh|DENO_INSTALL="$i" sh -s $DENO_INSTALL_ARGS "$v"|grep -iv discord>&2);};e;z&&exec deno run $A "$0" "$@";sed -E 's#from "\.#from "https://raw.githubusercontent.com/hugojosefson/proxmox-root-on-encrypted-zfs/main/src#g' <<'//🔚' | exec deno run $A - "$@"
import { getCommand } from "./commands/index.ts";
import { colorlog } from "./deps.ts";

import { Command, CommandResult } from "./model/command.ts";
import { RejectFn } from "./os/defer.ts";
import { isRunningAsRoot } from "./os/user/is-running-as-root.ts";
import { run } from "./run.ts";
import { errorAndExit, usageAndExit } from "./usage.ts";

export async function cli() {
  if (!await isRunningAsRoot()) {
    errorAndExit(
      3,
      "You must run this program as root. Try again with sudo :)",
    );
  }

  const args: string[] = Deno.args;
  if (!args.length) {
    usageAndExit();
  }

  const commands: Command[] = await Promise.all(args.map(getCommand));
  const runCommandsPromise = run(commands);
  await runCommandsPromise.then(
    (results: Array<CommandResult>) => {
      results.forEach((result) => {
        if (result.stdout) console.error(colorlog.success(result.stdout));
        if (result.stderr) console.error(colorlog.error(result.stderr));
        if (!(result?.status?.success)) {
          console.error(JSON.stringify(result.status));
        }
      });
      const anyError: CommandResult | undefined = results.find((result) =>
        (!result.status.success) ||
        (result.status.code > 0)
      );
      if (anyError) {
        const err: CommandResult = anyError;
        Deno.exit(err.status.code);
      }
    },
    (err: unknown): RejectFn => {
      let code = 1;
      if (typeof err === "object" && err !== null) {
        if ("message" in err && err?.message) {
          console.error("err.message: " + colorlog.error(err.message));
        }
        if ("stack" in err && err?.stack) {
          console.error("err.stack: " + colorlog.warning(err.stack));
        }
        if ("stdout" in err && err?.stdout) {
          console.error("err.stdout: " + colorlog.success(err.stdout));
        }
        if ("stderr" in err && err?.stderr) {
          console.error("err.stderr: " + colorlog.error(err.stderr));
        }
        if ("status" in err && err?.status && typeof err.status === "object") {
          if (
            "code" in err.status && err.status?.code &&
            typeof err.status.code === "number"
          ) {
            code = err.status.code;
          }
        }
        if ("code" in err && err?.code && typeof err.code === "number") {
          code = err.code;
        }
      }

      console.error("err: " + colorlog.error(JSON.stringify(err, null, 2)));
      // const code: number = err?.status?.code || err?.code || 1;
      Deno.exit(code);
    },
  );
}

if (import.meta.main) {
  await cli();
}

//🔚
