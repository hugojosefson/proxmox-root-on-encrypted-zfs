import { jsonRun } from "../../deps.ts";

export async function isRunningAsRoot(): Promise<boolean> {
  return await jsonRun(["bash", "-ec", "echo $EUID"]) === 0;
}
