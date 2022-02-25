import { readFromUrl } from "./os/read-from-url.ts";
import { availableCommands } from "./commands/available-commands.ts";
import { camelCase, kebabCase, yargs, YargsArguments } from "./deps.ts";
import { isUndefined } from "./fn.ts";

type GetterFunction<T, U> = (value: T) => Promise<U> | U;
function suffixMiddleware(
  suffix: string,
  getter: GetterFunction<string, string>,
) {
  return async function (argv: YargsArguments): Promise<YargsArguments> {
    const keys = Object.keys(argv);
    const suffixedKeys = keys.filter((s: string) => s.endsWith(suffix));
    for (const suffixedKey of suffixedKeys) {
      const keyLength = suffixedKey.length - suffix.length;
      const key = suffixedKey.substring(0, keyLength);
      if (argv.hasOwnProperty(key)) {
        continue;
      }
      argv[key] = (await getter(argv[suffixedKey])).trim();
    }
    return argv;
  };
}

function defaultMiddleware(
  assignDefaultValueToKey: string,
  copyFromKey: string,
) {
  const camelCasedKey = camelCase(assignDefaultValueToKey);
  const kebabCasedKey = kebabCase(assignDefaultValueToKey);
  return function (argv: YargsArguments): YargsArguments {
    if (typeof argv[kebabCasedKey] === "undefined") {
      argv[camelCasedKey] = argv[copyFromKey];
      argv[kebabCasedKey] = argv[copyFromKey];
    }
    return argv;
  };
}

const builder1 = yargs(Deno.args)
  .scriptName(`sudo ./src/cli.ts`)
  .env("PROXMOX_INSTALL")
  .middleware(suffixMiddleware("-file", Deno.readTextFile), true)
  .middleware(suffixMiddleware("-url", readFromUrl), true)
  .option("help", {
    alias: "h",
    type: "boolean",
    default: false,
    description: "Show help.",
  })
  .option("verbose", {
    alias: "v",
    type: "boolean",
    default: false,
    description: "Run with verbose logging.",
  })
  .option("disks", {
    type: "array",
    description:
      "Disk devices to use for the root pool, in a mirror vdev. ALL DATA ON THEM WILL BE DESTROYED!",
  })
  .option("disk-encryption-password", {
    type: "string",
    description: "Passphrase for zfs native encryption of the root pool.",
  })
  .option("root-password", {
    type: "string",
    description: "Password for the root account.",
  })
  .option("root-authorized-keys", {
    type: "string",
    description: "Contents for /root/.ssh/authorized_keys.",
  })
  .option("fqdn", {
    type: "string",
    description:
      "Fully Qualified Domain Name of the host, including its hostname.",
  })
  .option("ip", {
    type: "string",
    default: "dhcp",
    description:
      'IP address and network of the host in cidr form, for example "10.0.0.2/24", or "dhcp".',
  })
  .option("initramfs-ip", {
    type: "string",
    defaultDescription: "same as --ip",
    description:
      "IP address and network of the pre-boot disk-decryption ssh service in cidr form.",
  })
  .middleware(defaultMiddleware("initramfs-ip", "ip"), true)
  .demandOption([
    "disk-encryption-password",
    "root-password",
    "root-authorized-keys",
    "fqdn",
    "disks",
    "ip",
    "initramfs-ip",
  ]);
let builder2 = builder1;
for (const availableCommand of availableCommands) {
  builder2 = builder2.command(availableCommand);
}

export const args: YargsArguments = await builder2
  .demandCommand(1)
  .version(false)
  .exitProcess(true)
  .epilogue(
    `Suffix any option with -file or -url, to load its value from a file or url.
For example: --root-authorized-keys-url=https://github.com/hugojosefson.keys`,
  )
  .wrap(Deno.consoleSize(Deno.stdout.rid).columns)
  .parse();

if (isUndefined(args)) {
  throw new Error("args is undefined");
}

export type Config = {
  VERBOSE: boolean;
  DISKS: string[];
  DISK_ENCRYPTION_PASSWORD: string;
  ROOT_PASSWORD: string;
  ROOT_AUTHORIZED_KEYS: string;
  FQDN: string;
  IP: string;
  INITRAMFS_IP: string;
};

export const config: Config = {
  VERBOSE: args.verbose,
  DISKS: args.disks,
  DISK_ENCRYPTION_PASSWORD: args.diskEncryptionPassword,
  ROOT_PASSWORD: args.rootPassword,
  ROOT_AUTHORIZED_KEYS: args.rootAuthorizedKeys,
  FQDN: args.fqdn,
  IP: args.ip,
  INITRAMFS_IP: args.initramfsIp,
};
