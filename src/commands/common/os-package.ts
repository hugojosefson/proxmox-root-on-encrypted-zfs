import { memoize } from "../../deps.ts";
import { Command, RunResult } from "../../model/command.ts";
import { FLATPAK, OS_PACKAGE_SYSTEM } from "../../model/dependency.ts";
import { ensureSuccessful, isSuccessful } from "../../os/exec.ts";
import { isInsideDocker } from "../../os/is-inside-docker.ts";
import { REFRESH_OS_PACKAGES } from "../refresh-os-packages.ts";
import { ROOT } from "../../os/user/root.ts";

export type OsPackageName = string;
export type AurPackageName = string;
export type FlatpakPackageName = string;
export type PackageName = OsPackageName | AurPackageName | FlatpakPackageName;

export abstract class AbstractPackageCommand<T extends PackageName>
  extends Command {
  readonly packageName: T;

  protected constructor(packageName: T) {
    super();
    this.packageName = packageName;
  }

  toString() {
    return JSON.stringify({ packageName: this.packageName });
  }
}

export class InstallOsPackage extends AbstractPackageCommand<OsPackageName> {
  private constructor(packageName: OsPackageName) {
    super(packageName);
    this.locks.push(OS_PACKAGE_SYSTEM);
    this.dependencies.push(
      REFRESH_OS_PACKAGES,
    );
  }

  async run(): Promise<RunResult> {
    if (await isInstalledOsPackage(this.packageName)) {
      return `Already installed OS package ${this.packageName}.`;
    }

    await ensureSuccessful(ROOT, [
      "apt-get",
      "install",
      "-y",
      this.packageName,
    ], { env: { DEBIAN_FRONTEND: "noninteractive" } });

    return `Installed OS package ${this.packageName}.`;
  }

  static of: (packageName: OsPackageName) => InstallOsPackage = memoize(
    (packageName: OsPackageName): InstallOsPackage =>
      new InstallOsPackage(packageName),
  );
  static upgradePackages() {
    return new Command().withLocks([OS_PACKAGE_SYSTEM]).withRun(() =>
      ensureSuccessful(ROOT, [
        "apt-get",
        "full-upgrade",
        "-y",
        "--purge",
        "--auto-remove",
      ])
    );
  }
}

export class RemoveOsPackage extends AbstractPackageCommand<OsPackageName> {
  private constructor(packageName: OsPackageName) {
    super(packageName);
    this.locks.push(OS_PACKAGE_SYSTEM);
    this.dependencies.push(REFRESH_OS_PACKAGES);
  }

  async run(): Promise<RunResult> {
    if (!await isInstalledOsPackage(this.packageName)) {
      return `Already removed OS package ${this.packageName}.`;
    }

    await ensureSuccessful(ROOT, [
      "apt-get",
      "purge",
      "-y",
      "--auto-remove",
      this.packageName,
    ], { env: { DEBIAN_FRONTEND: "noninteractive" } });

    return `Removed package ${this.packageName}.`;
  }

  static of: (packageName: OsPackageName) => RemoveOsPackage = (
    packageName: OsPackageName,
  ) => new RemoveOsPackage(packageName);
}

export class ReplaceOsPackage extends Command {
  readonly removePackageName: OsPackageName;
  readonly installPackageName: OsPackageName;

  private constructor(
    removePackageName: OsPackageName,
    installPackageName: OsPackageName,
  ) {
    super();
    this.locks.push(OS_PACKAGE_SYSTEM);
    this.dependencies.push(REFRESH_OS_PACKAGES);

    this.removePackageName = removePackageName;
    this.installPackageName = installPackageName;
  }

  async run(): Promise<RunResult> {
    await ensureSuccessful(ROOT, [
      "apt-get",
      "purge",
      "-y",
      this.removePackageName,
      this.installPackageName + "+",
    ], { env: { DEBIAN_FRONTEND: "noninteractive" } }).catch(
      this.doneDeferred.reject,
    );

    return `Replaced package ${this.removePackageName} with ${this.installPackageName}.`;
  }
  /**
   * @deprecated Use .of2() instead.
   */
  static of(): Command {
    throw new Error("Use .of2() instead.");
  }
  static of2: (
    removePackageName: OsPackageName,
    installPackageName: OsPackageName,
  ) => ReplaceOsPackage = (
    removePackageName: OsPackageName,
    installPackageName: OsPackageName,
  ) => new ReplaceOsPackage(removePackageName, installPackageName);
}

export const flatpakOsPackages = ["xdg-desktop-portal-gtk", "flatpak"];
export const flatpak: Command = Command.custom()
  .withDependencies(flatpakOsPackages.map(InstallOsPackage.of));

export class InstallFlatpakPackage
  extends AbstractPackageCommand<FlatpakPackageName> {
  private constructor(packageName: FlatpakPackageName) {
    super(packageName);
    this.locks.push(FLATPAK);
    this.dependencies.push(flatpak);
  }

  async run(): Promise<RunResult> {
    if (await isInstalledFlatpakPackage(this.packageName)) {
      return `Already installed Flatpak package ${this.packageName}.`;
    }

    await ensureSuccessful(ROOT, [
      "flatpak",
      "install",
      "--or-update",
      "--noninteractive",
      ...(isInsideDocker ? ["--no-deploy"] : []),
      "flathub",
      this.packageName,
    ]);

    return `Installed Flatpak package ${this.packageName}.`;
  }

  static of: (
    packageName: FlatpakPackageName,
  ) => InstallFlatpakPackage = memoize(
    (packageName: FlatpakPackageName): InstallFlatpakPackage =>
      new InstallFlatpakPackage(packageName),
  );
}

export class RemoveFlatpakPackage
  extends AbstractPackageCommand<FlatpakPackageName> {
  private constructor(packageName: FlatpakPackageName) {
    super(packageName);
    this.locks.push(FLATPAK);
    this.dependencies.push(flatpak);
  }

  async run(): Promise<RunResult> {
    if (!await isInstalledFlatpakPackage(this.packageName)) {
      return `Already removed Flatpak package ${this.packageName}.`;
    }

    await ensureSuccessful(ROOT, [
      "flatpak",
      "uninstall",
      "--noninteractive",
      this.packageName,
    ]);

    return `Removed Flatpak package ${this.packageName}.`;
  }

  static of: (packageName: FlatpakPackageName) => RemoveFlatpakPackage = (
    packageName: FlatpakPackageName,
  ) => new RemoveFlatpakPackage(packageName);
}

export function isInstalledOsPackage(
  packageName: OsPackageName,
): Promise<boolean> {
  return isSuccessful(ROOT, [
    `dpkg`,
    `--status`,
    packageName,
  ], { verbose: false });
}

export function isInstallableOsPackage(
  packageName: OsPackageName,
): Promise<boolean> {
  return isSuccessful(ROOT, [
    `apt-cache`,
    `show`,
    packageName,
  ], { verbose: false });
}

function isInstalledFlatpakPackage(
  packageName: FlatpakPackageName,
): Promise<boolean> {
  return isSuccessful(ROOT, [
    "bash",
    "-c",
    `flatpak list --columns application | grep --line-regexp '${packageName}'`,
  ], { verbose: false });
}
