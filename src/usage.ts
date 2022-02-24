import { colorlog } from "./deps.ts";
import { availableCommands } from "./commands/available-commands.ts";

function usage() {
  console.error(`
Usage, if you only have curl, unzip and sh:

         curl -fsSL https://raw.githubusercontent.com/hugojosefson/proxmox-root-on-encrypted-zfs/main/src/cli.ts \\
         | sudo sh -s <command...>


Usage, if you have deno:

         sudo deno -A --unstable https://raw.githubusercontent.com/hugojosefson/proxmox-root-on-encrypted-zfs/main/src/cli.ts <command...>


Usage, if you have deno, and have cloned this git repo:

         sudo deno -A --unstable ./src/cli.ts <command...>


         Available commands:
${
    availableCommands.map((name) => `            ${name}`)
      .join("\n")
  }

         ...or any valid OS-level package.
  `);
}

export function usageAndExit(
  code = 1,
  message?: string,
): never {
  if (message) {
    console.error(colorlog.error(message));
  }
  usage();
  return Deno.exit(code);
}

export function usageAndThrow(error: Error): never {
  usage();
  throw error;
}

export function errorAndExit(
  code = 1,
  message?: string,
): never {
  if (message) {
    console.error(colorlog.error(message));
  }
  return Deno.exit(code);
}
