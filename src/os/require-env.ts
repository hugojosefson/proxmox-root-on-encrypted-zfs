import { readFromUrl } from "./read-from-url.ts";
import { usageAndThrow } from "../usage.ts";

export async function requireEnv(
  name: string,
  ...alternativeNames: string[]
): Promise<string> {
  const value = Deno.env.get(name);
  const valueFile = Deno.env.get(name + "_FILE");
  const valueUrl = Deno.env.get(name + "_URL");

  if (typeof value === "string") {
    return value;
  }

  if (typeof valueFile === "string") {
    return await Deno.readTextFile(valueFile);
  }

  if (typeof valueUrl === "string") {
    return await readFromUrl(valueUrl);
  }

  const [nextName, ...followingNames] = alternativeNames;
  try {
    if (typeof nextName === "string") {
      return await requireEnv(nextName, ...followingNames);
    }
  } catch (_ignore) {
    // fallthrough
  }

  usageAndThrow(
    new Error(
      `Missing env variable "${name}". You may alternatively set "${name}_FILE" or "${name}_URL" to read its value from a file or URL.`,
    ),
  );
}
