import { memoize, parsePasswd, PasswdEntry } from "../../deps.ts";
import { defer, Deferred } from "../defer.ts";
import { usageAndThrow } from "../../usage.ts";

const uidComparator = (a: PasswdEntry, b: PasswdEntry) => a?.uid - b?.uid;
async function _getUsers() {
  const runOptions: Deno.RunOptions = {
    cmd: ["getent", "passwd"],
    stdout: "piped",
  };
  const outputBytes: Uint8Array = await Deno.run(runOptions).output();
  const outputString = new TextDecoder().decode(outputBytes).trim();
  return parsePasswd(outputString)
    .sort(uidComparator);
}
const getUsers: typeof _getUsers = memoize(_getUsers);

const SUDO_USER = "SUDO_USER";
async function _getTargetUser(): Promise<PasswdEntry> {
  const users: Array<PasswdEntry> = await getUsers();
  const sudoUser: string | undefined = Deno.env.get(
    SUDO_USER,
  );
  if (sudoUser) {
    const targetUser: PasswdEntry | undefined = users.find((
      { username },
    ) => username === sudoUser);

    if (targetUser) {
      return targetUser;
    }
    usageAndThrow(
      new Error(
        `ERROR: Could not find requested ${SUDO_USER} "${sudoUser}".`,
      ),
    );
  }

  usageAndThrow(
    new Error(
      `ERROR: No target user found. Log in graphically as the target user. Then use sudo.`,
    ),
  );
}
export const getTargetUser: typeof _getTargetUser = memoize(_getTargetUser);

const targetUserDefer: Deferred<PasswdEntry> = defer();
export const targetUserPromise: Promise<PasswdEntry> = targetUserDefer.promise;
setTimeout(() => {
  try {
    getTargetUser().then(targetUserDefer.resolve, targetUserDefer.reject);
  } catch (e) {
    targetUserDefer.reject(e);
  }
}, 500);

export async function getDbusSessionBusAddress() {
  return `unix:path=/run/user/${(await targetUserPromise).uid}/bus`;
}
