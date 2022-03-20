import { memoize, PasswdEntry } from "../deps.ts";
import { defer, deferAlreadyResolvedVoid, Deferred } from "../os/defer.ts";
import { resolvePath } from "../os/resolve-path.ts";
import { ROOT } from "../os/user/root.ts";
import { usageAndThrow } from "../usage.ts";

export type LockReleaser = () => void;

export class Lock {
  private currentLock: Deferred<void> = deferAlreadyResolvedVoid();

  async take(): Promise<LockReleaser> {
    const previousLock = this.currentLock.promise;
    this.currentLock = defer();
    try {
      await previousLock;
    } catch (e) {
      console.error(`ERROR: lock rejected`, e);
    }
    return this.currentLock.resolve;
  }
}

export class FileSystemPath extends Lock {
  readonly path: string;

  private constructor(path: string) {
    super();
    this.path = path;
  }

  toString() {
    return `FileSystemPath(${this.path.toString()})`;
  }

  private static ofAbsolutePath(absolutePath: string): FileSystemPath {
    if (!absolutePath) {
      usageAndThrow(
        new Error(
          `ofAbsolutePath(absolutePath: ${
            JSON.stringify(absolutePath)
          }): absolutePath is not.`,
        ),
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
      usageAndThrow(
        new Error(
          `of(user: ${user.toString()}, path: ${path.toString()}): resolvedPath is not.`,
        ),
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
