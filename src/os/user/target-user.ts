import { parsePasswd, PasswdEntry } from "../../deps.ts";
import { ensureSuccessfulStdOut } from "../exec.ts";
import { ROOT } from "./root.ts";
import { defer, Deferred } from "../defer.ts";

const byUid = (a: PasswdEntry, b: PasswdEntry) => a?.uid - b?.uid;

const getUsers = async () =>
  parsePasswd(await ensureSuccessfulStdOut(ROOT, ["getent", "passwd"]))
    .sort(byUid);

const SUDO_USER = "SUDO_USER";

const getTargetUser = async (): Promise<PasswdEntry> => {
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
    throw new Error(
      `ERROR: Could not find requested ${SUDO_USER} "${sudoUser}".`,
    );
  }

  throw new Error(
    `ERROR: No target user found. Log in graphically as the target user. Then use sudo.`,
  );
};

const targetUserDefer: Deferred<PasswdEntry> = defer();
export const targetUserPromise: Promise<PasswdEntry> = targetUserDefer.promise;
setTimeout(() => {
  getTargetUser().then(targetUserDefer.resolve, targetUserDefer.reject);
}, 500);

export async function getDbusSessionBusAddress() {
  return `unix:path=/run/user/${(await targetUserPromise).uid}/bus`;
}
