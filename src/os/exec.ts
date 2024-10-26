import { config } from "../config.ts";
import {
  colorlog,
  type CommandFailure,
  PasswdEntry,
  runSimple,
} from "../deps.ts";
import { CommandResult } from "../model/command.ts";
import { FileSystemPath } from "../model/dependency.ts";
import { getDbusSessionBusAddress } from "./user/target-user.ts";
import { ROOT } from "./user/root.ts";

export function isCommandFailure(err: unknown): err is CommandFailure {
  return typeof err === "object" && err !== null && "cmd" in err &&
    "status" in err && "stdout" in err && "stderr" in err;
}
export type ExecOptions = Pick<Deno.CommandOptions, "cwd" | "env"> & {
  verbose?: boolean;
  stdin?: string;
};

const DEFAULT_ENV = { DEBIAN_FRONTEND: "noninteractive" };
async function runOptions(
  asUser: PasswdEntry,
  opts: ExecOptions,
): Promise<Pick<Deno.CommandOptions, "cwd" | "env">> {
  return {
    ...(opts.cwd ? { cwd: opts.cwd } : {}),
    env: {
      ...(asUser === ROOT
        ? { DBUS_SESSION_BUS_ADDRESS: await getDbusSessionBusAddress() }
        : {}),
      ...DEFAULT_ENV,
      ...(opts.env ?? {}),
    },
  };
}

export async function ensureSuccessful(
  asUser: PasswdEntry,
  cmd: Array<string>,
  options: ExecOptions = {},
): Promise<CommandResult> {
  const effectiveCmd = [
    ...(asUser === ROOT ? [] : [
      "sudo",
      `--preserve-env=DBUS_SESSION_BUS_ADDRESS,XAUTHORITY,DISPLAY,DEBIAN_FRONTEND`,
      `--user=${asUser.username}`,
      "--non-interactive",
      "--",
    ]),
    ...cmd,
  ];
  config.VERBOSE && console.error(
    colorlog.warning(
      JSON.stringify({ options, user: asUser.username, cmd, effectiveCmd }),
    ),
  );
  const stdinString = typeof options.stdin === "string" ? options.stdin : "";
  const shouldPipeStdin: boolean = stdinString.length > 0;
  try {
    const stdout = await runSimple(effectiveCmd, {
      ...await runOptions(asUser, options),
      ...(shouldPipeStdin ? { stdin: stdinString } : {}),
    });
    return {
      status: {
        success: true,
        code: 0,
        signal: null,
      },
      stdout,
      stderr: "",
    };
  } catch (err) {
    if (!(isCommandFailure(err))) {
      throw err;
    }
    return Promise.reject({
      status: err.output,
      ...err,
    });
  }
}

export const symlink = (
  owner: PasswdEntry,
  from: string,
  to: FileSystemPath,
): Promise<CommandResult> =>
  ensureSuccessful(owner, [
    "ln",
    "-s",
    from,
    to.path,
  ]);

export const ensureSuccessfulStdOut = async (
  asUser: PasswdEntry,
  cmd: Array<string>,
  options: ExecOptions = {},
): Promise<string> =>
  (await ensureSuccessful(asUser, cmd, options)).stdout.trim();

export const isSuccessful = (
  asUser: PasswdEntry,
  cmd: Array<string>,
  options: ExecOptions = {},
): Promise<boolean> =>
  ensureSuccessful(asUser, cmd, options).then(
    () => Promise.resolve(true),
    () => Promise.resolve(false),
  );
