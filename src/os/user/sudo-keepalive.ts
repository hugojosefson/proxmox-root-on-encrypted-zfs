import { PasswdEntry } from "../../deps.ts";

export function sudoKeepalive(asUser: PasswdEntry): () => void {
  const process: Deno.Process = Deno.run({
    cmd: [
      "sh",
      "-c",
      `while true; do sudo --non-interactive --user="${asUser.username}" -- sudo true; sleep 10; done;`,
    ],
    stdin: "null",
    stdout: "null",
    stderr: "null",
  });
  return () => process.kill("SIGTERM");
}
