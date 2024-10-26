import { dirname } from "jsr:@std/path@1.0.7";
export { dirname };

import {
  error,
  success,
  warning,
} from "https://deno.land/x/colorlog@v1.0/mod.ts";

type LogColorer = (val: unknown) => string;
export const colorlog: {
  error: LogColorer;
  success: LogColorer;
  warning: LogColorer;
} = { error, success, warning };

export interface PasswdEntry {
  username: string;
  uid: number;
  gid: number;
  homedir: string;
  toJSON: () => unknown;
  toString: () => string;
}
interface PasswdEntry_ {
  username: unknown;
  homedir: unknown;
  uid: unknown;
  gid: unknown;
}

import parsePasswd_ from "npm:parse-passwd@1.0.0";
export function parsePasswd(content: string): Array<PasswdEntry> {
  const parsed = parsePasswd_(content) as Array<PasswdEntry_>;
  return parsed
    .map(
      (
        { username, uid, gid, homedir }: PasswdEntry_,
      ) => ({
        username: username as string,
        homedir: homedir as string,
        uid: parseInt(uid as string, 10),
        gid: parseInt(gid as string, 10),
        toJSON: function () {
          return this.username;
        },
        toString: function () {
          return this.username;
        },
      }),
    );
}

import { fetch as fetchFile } from "https://deno.land/x/file_fetch@0.2.0/mod.ts";
export { fetchFile };

import memoize from "https://deno.land/x/memoizy@1.0.0/mod.ts";
export { memoize };

import { isDocker } from "https://deno.land/x/is_docker@v2.0.0/mod.ts";
export { isDocker };

import toposort_ from "npm:toposort@2.0.2";
export function toposort<T>(things: Array<[T, T]>): Array<T> {
  return toposort_(things);
}

import {
  compose,
  composeUnary,
  pipe,
  pipeline,
  pipelineUnary,
} from "https://deno.land/x/compose@1.3.5/index.js";
export { compose, composeUnary, pipe, pipeline, pipelineUnary };

import { paramCase } from "https://deno.land/x/case@2.2.0/mod.ts";
export function kebabCase(s: string): string {
  const kebab: string = paramCase(s);

  return kebab
    .replace(/([a-z])([0-9])/, "$1-$2") // Insert '-' between 'all' and the number.
    .replace(/\bv-4l/, "v4l"); // fix v4l (video for linux)
}

/** https://raw.githubusercontent.com/geongeorge/i-hate-regex/a8e8aec729390ae14ff7d6a774e4b4899bf56821/static/regex/data.json */
export const ipRegex =
  "(\\b25[0-5]|\\b2[0-4][0-9]|\\b[01]?[0-9][0-9]?)(\\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}";

import { Netmask as Netmask_ } from "npm:netmask@2.0.2";
export interface Netmask {
  ip: string;
  base: string;
  bitmask: number;
  mask: string;
  broadcast: string;
  gateway: string;
  // and more
}
export function netmask(input: string): Netmask {
  const parts = input.split("/");
  const [ip, _bitmask, gateway] = parts;
  const net = new Netmask_(input);
  return {
    ...net,
    ip,
    gateway: gateway ?? net.first,
  };
}

export {
  type CommandFailure,
  jsonRun,
  run as runSimple,
} from "jsr:@hugojosefson/run-simple@2.3.8";
