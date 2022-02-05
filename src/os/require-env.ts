export const requireEnv = async (name: string): Promise<string> => {
  const value = Deno.env.get(name);
  const valueFile = Deno.env.get(name + "_FILE");

  if (typeof value === "string") {
    return value;
  }

  if (typeof valueFile === "string") {
    return await Deno.readTextFile(valueFile);
  }

  throw new Error(
    `Missing env variable "${name}", or "${name}_FILE" to read its value from a file.`,
  );
};
