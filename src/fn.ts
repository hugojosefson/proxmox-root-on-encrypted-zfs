export const complement = <T>(fn: (t: T) => boolean): (t: T) => boolean =>
  (t: T) => !fn(t);

export const toObject = <K extends string | number | symbol, V>() =>
  (
    acc: Record<K, V>,
    [key, value]: [K, V],
  ): Record<K, V> => {
    acc[key] = value;
    return acc;
  };

export async function filterAsync<T>(
  predicate: (t: T) => Promise<boolean>,
  array: T[],
): Promise<T[]> {
  return (await Promise.all(
    array
      .map((t) => [t, predicate(t)] as [T, Promise<boolean>])
      .map(
        async ([t, shouldIncludePromise]) =>
          [t, await shouldIncludePromise] as [T, boolean],
      ),
  ))
    .filter(([_t, shouldInclude]) => shouldInclude)
    .map(([t, _shouldInclude]) => t);
}

export function tryJsonParse(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch (_ignored) {
    return input;
  }
}

export async function mapAsync<T, U>(
  fn: (t: T) => Ish<U>,
  array: Ish<T>[],
): Promise<U[]> {
  const uishs = array
    .map(resolveValue)
    .map(async (tPromise) => await resolveValue(fn(await tPromise)));
  return await resolveValues(uishs);
}

export async function flatmapAsync<T, U>(
  fn: (t: T) => Ish<U[]>,
  array: Ish<T>[],
): Promise<U[]> {
  return (await mapAsync(fn, array)).flat();
}

export function isPromise<T>(
  maybePromise: PromiseLike<T> | unknown,
): maybePromise is Promise<T> {
  return typeof (maybePromise as PromiseLike<T>)?.then === "function";
}

export type Getter<T> = () => T | Promise<T>;
export type Ish<T> = T | Promise<T> | Getter<T>;

export async function resolveValue<T>(x: Ish<T>): Promise<T> {
  if (typeof x === "function") {
    return resolveValue((x as Getter<T>)());
  }
  if (isPromise(x)) {
    return await x;
  }
  return x;
}

export async function resolveValues<T>(xs: Array<Ish<T>>): Promise<Array<T>> {
  const promises: Promise<T>[] = xs.map(resolveValue);
  return await Promise.all(promises);
}

export function isUndefined(x?: unknown): x is undefined {
  return typeof x === "undefined";
}
