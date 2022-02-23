import { memoize, PasswdEntry } from "../deps.ts";
import { defer, deferAlreadyResolvedVoid, Deferred } from "../os/defer.ts";
import { resolvePath } from "../os/resolve-path.ts";
import { ROOT } from "../os/user/root.ts";
import { Stringifiable } from "./stringifiable.ts";

export type LockReleaser = () => void;

export class Lock implements Stringifiable {
  private currentLock: Deferred<void> = deferAlreadyResolvedVoid();
  private readonly randomId = `${Math.ceil(Math.random() * 10e5)}`;

  async take(): Promise<LockReleaser> {
    const previousLock = this.currentLock.promise;
    this.currentLock = defer();
    await previousLock;
    return this.currentLock.resolve;
  }

  stringify(): Promise<string> {
    return Promise.resolve(`Lock[randomId=${this.randomId}]`);
  }
}

export class FileSystemPath extends Lock {
  readonly path: string;

  private constructor(path: string) {
    super();
    this.path = path;
  }

  stringify(): Promise<string> {
    return Promise.resolve(`FileSystemPath(${this.path})`);
  }

  private static ofAbsolutePath(absolutePath: string): FileSystemPath {
    if (!absolutePath) {
      throw new Error(
        `ofAbsolutePath(absolutePath: ${
          JSON.stringify(absolutePath)
        }): absolutePath is not.`,
      );
    }
    return new FileSystemPath(absolutePath);
  }

  private static ofAbsolutePathMemoized: (path: string) => FileSystemPath =
    memoize(
      FileSystemPath.ofAbsolutePath,
    );

  static of(user: PasswdEntry, path: string): FileSystemPath {
    const resolvedPath: string = resolvePath(user, path);
    if (!resolvedPath) {
      throw new Error(
        `of(user: ${user.stringify()}, path: ${path}): resolvedPath is not.`,
      );
    }
    return FileSystemPath.ofAbsolutePathMemoized(resolvedPath);
  }
}

export const OS_PACKAGE_SYSTEM: Lock = FileSystemPath.of(
  ROOT,
  "/var/lib/apt",
);

export const FLATPAK = OS_PACKAGE_SYSTEM;
