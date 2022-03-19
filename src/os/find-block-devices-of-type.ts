export async function findBlockDevicesOfType(
  type: string,
): Promise<Array<string>> {
  const lsblk = `lsblk --paths --nodeps --noheadings --output NAME,TYPE`;
  const awk = `awk '/ ${type}$/{print $1}'`;
  const cmd = ["sh", "-c", `${lsblk} | ${awk}`];

  const outputBytes = await Deno.run({ cmd, stdout: "piped" }).output();
  const stdout: string = new TextDecoder().decode(outputBytes).trim();
  return stdout.split("\n");
}
