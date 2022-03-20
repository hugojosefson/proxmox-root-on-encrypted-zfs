import { config } from "../config.ts";
import { defer, Deferred } from "../os/defer.ts";
import { run } from "../run.ts";
import { Lock, LockReleaser } from "./dependency.ts";
import { usageAndThrow } from "../usage.ts";
import { resolveValue } from "../fn.ts";

export interface CommandResult {
  status: Deno.ProcessStatus;
  stdout: string;
  stderr: string;
}

export class Command {
  readonly name: string;
  readonly dependencies: Array<Command> = new Array(0);
  readonly locks: Array<Lock> = new Array(0);
  readonly skipIfAll: Array<Predicate> = new Array(0);
  readonly doneDeferred: Deferred<CommandResult> = defer();
  readonly done: Promise<CommandResult> = this.doneDeferred.promise;

  constructor(name: string) {
    this.name = name;
  }

  toJSON() {
    return this.toString();
  }

  toString(): string {
    return [
      `Command.custom(${this.name})`,
      this.locks.length
        ? `\n    .withLocks([${
          this.locks.map((lock) => lock.toString()).join(", ")
        }])`
        : "",
      this.dependencies.length
        ? `\n    .withDependencies([${
          this.dependencies.map((dep) => dep.name).join(", ")
        }])`
        : "",
      this.run !== Command.prototype.run
        ? `\n    .withRun(${
          this.run.toString().substring(0, 20).replace("\n", "; ")
        }...)`
        : "",
    ].join("");
  }

  private _shouldSkip: boolean | undefined = undefined;
  async shouldSkip(): Promise<boolean> {
    if (this._shouldSkip === true) {
      if (!this.doneDeferred.isDone) {
        this.doneDeferred.resolve(this.alreadyDoneResult());
      }
      return true;
    }

    if (this._shouldSkip === false) {
      return false;
    }

    if (this.skipIfAll.length === 0) {
      this._shouldSkip = false;
      return false;
    }

    try {
      for (const predicate of this.skipIfAll) {
        const shouldSkipBecauseOfThisPredicate: boolean = await resolveValue(
          predicate(),
        );
        if (!shouldSkipBecauseOfThisPredicate) {
          this._shouldSkip = false;
          return false;
        }
      }
      this._shouldSkip = true;
      if (!this.doneDeferred.isDone) {
        this.doneDeferred.resolve(this.alreadyDoneResult());
      }
      return true;
    } catch (e) {
      console.warn(`Some predicate failed, so we should run the command.`, e);
    }
    this._shouldSkip = false;
    return this._shouldSkip;
  }

  async runWhenDependenciesAreDone(): Promise<CommandResult> {
    try {
      if (this.doneDeferred.isDone) {
        return this.done;
      }

      for (const dependency of this.dependencies) {
        await dependency.runWhenDependenciesAreDone();
      }
      const dependenciesDone = this.dependencies.map(({ done }) => done);
      await Promise.all(dependenciesDone);

      if (await this.shouldSkip()) {
        config.VERBOSE && console.error(`Skipping command `, this.toString());
      }

      if (this.doneDeferred.isDone) {
        return this.done;
      }

      config.VERBOSE && console.error(`Running command `, this.toString());

      const lockReleaserPromises: Promise<LockReleaser>[] = this.locks
        .map(async (lock) => await lock.take());

      try {
        const innerResult: RunResult = await (this.run().catch(
          this.doneDeferred.reject,
        ));
        config.VERBOSE &&
          console.error(`Running command ${this.toString()} DONE.`);
        return this.resolve(innerResult);
      } finally {
        await Promise.all(
          lockReleaserPromises.map(async (releaserPromise) =>
            (await releaserPromise)()
          ),
        );
      }
    } catch (e) {
      if (!this.doneDeferred.isDone) {
        this.doneDeferred.reject(e);
      }
      return this.done;
    }
    if (!this.doneDeferred.isDone) {
      this.doneDeferred.resolve(this.strangelyDoneResult());
    }
    return this.done;
  }

  static custom(name: string): Command {
    return new Command(name);
  }

  async run(): Promise<RunResult> {
  }

  async resolve(
    commandResult: RunResult,
  ): Promise<CommandResult> {
    if (!commandResult) {
      this.doneDeferred.resolve({
        status: { success: true, code: 0 },
        stdout: `Success: ${this.toString()}`,
        stderr: "",
      });
      return this.done;
    }
    if (typeof commandResult === "string") {
      this.doneDeferred.resolve({
        status: { success: true, code: 0 },
        stdout: commandResult,
        stderr: "",
      });
      return this.done;
    }
    if (Array.isArray(commandResult)) {
      const postCommands: Command[] = commandResult;
      return await run(postCommands).then((
        postCommandResults: CommandResult[],
      ) => this.resolve(postCommandResults[postCommandResults.length]));
    }

    this.doneDeferred.resolve(commandResult);
    return this.done;
  }

  withDependencies(dependencies: Array<Command>): Command {
    this.dependencies.push(...dependencies);
    return this;
  }

  withLocks(locks: Array<Lock>): Command {
    this.locks.push(...locks);
    return this;
  }

  withRun(run: RunFunction): Command {
    if (this.run !== Command.prototype.run) {
      usageAndThrow(
        new Error(
          `Unexpectedly trying to overwrite run method of ${this.toString()}`,
        ),
      );
    }
    this.run = run;
    return this;
  }

  withSkipIfAll(predicates: Array<Predicate>): Command {
    this.skipIfAll.push(...predicates);
    return this;
  }

  private alreadyDoneResult(): CommandResult {
    return {
      status: { success: true, code: 0 },
      stdout: `Already done: ${this.toString()}`,
      stderr: "",
    };
  }

  private strangelyDoneResult(): CommandResult {
    return {
      status: { success: true, code: 0 },
      stdout: `Strangely done: ${this.toString()}`,
      stderr: "",
    };
  }
}

export class Sequential extends Command {
  readonly commands: Command[];
  constructor(name: string, commands: Array<Command>) {
    super(name);
    this.commands = commands;
  }

  async run(): Promise<RunResult> {
    let result: RunResult | undefined;
    for (const command of this.commands) {
      console.error(`${this.name}: Running sequentially ${command.name}`);
      result = await command.runWhenDependenciesAreDone();
    }
    return result;
  }
}

export type Predicate = () => boolean | Promise<boolean>;
export type RunResult = CommandResult | void | string | Command[];
export type RunFunction = () => Promise<RunResult>;
