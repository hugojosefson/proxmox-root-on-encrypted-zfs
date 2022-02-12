import { NOOP } from "../commands/common/noop.ts";
import { config } from "../config.ts";
import { defer, Deferred } from "../os/defer.ts";
import { run } from "../run.ts";
import { Lock } from "./dependency.ts";

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
        ? `\n    .withRun(${this.run.toString()})`
        : "",
    ].join("");
  }

  private _shouldSkip: boolean | undefined = undefined;
  async shouldSkip(): Promise<boolean> {
    if (typeof this._shouldSkip === "boolean") {
      return this._shouldSkip;
    }

    if (this.skipIfAll.length === 0) {
      this._shouldSkip = false;
      return this._shouldSkip;
    }

    try {
      await Promise.all(
        this.skipIfAll.map(async (predicate) => {
          if (await predicate()) {
            return;
          }
          throw new Error(
            `Let's stop wasting time on any more predicates. We have already decided to go ahead and run this command.`,
          );
        }),
      );
      this._shouldSkip = true;
      return this._shouldSkip;
    } catch (_ignore) {
      // Some predicate failed, so we should run the command.
    }
    this._shouldSkip = false;
    return this._shouldSkip;
  }

  async runWhenDependenciesAreDone(): Promise<CommandResult> {
    const dependenciesDone = this.dependencies.map(({ done }) => done);
    if (await this.shouldSkip()) {
      config.VERBOSE && console.error(`Skipping command `, this.toString());
      await Promise.all(dependenciesDone);
      const runResult: CommandResult = {
        status: { success: true, code: 0 },
        stdout: `Already done: ${this.toString()}`,
        stderr: "",
      } as const;
      this.doneDeferred.resolve(runResult);
      return runResult;
    }

    if (this.doneDeferred.isDone) {
      return this.done;
    }

    config.VERBOSE && console.error(`Running command `, this.toString());
    const lockReleaserPromises = this.locks.map((lock) => lock.take());
    await Promise.all(dependenciesDone);

    const lockReleasers = await Promise.all(lockReleaserPromises);
    try {
      const innerResult: RunResult = await (this.run().catch(
        this.doneDeferred.reject,
      ));
      config.VERBOSE &&
        console.error(`Running command ${this.toString()} DONE.`);
      return this.resolve(innerResult);
    } finally {
      lockReleasers.forEach((releaseLock) => releaseLock());
    }
  }

  static custom(name: string): Command {
    return new Command(name);
  }

  async run(): Promise<RunResult> {
  }

  resolve(
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
      return run(postCommands).then((postCommandResults: CommandResult[]) =>
        this.resolve(postCommandResults[postCommandResults.length])
      );
    }

    this.doneDeferred.resolve(commandResult);
    return this.done;
  }

  static sequential(name: string, commands: Array<Command>): Command {
    if (commands.length === 0) {
      return NOOP();
    }
    if (commands.length === 1) {
      return commands[0];
    }
    const head = commands[0];
    const tail = commands.slice(1);
    return Command.custom(`sequential(${name}, ${head.name})`)
      .withDependencies([...tail, ...head.dependencies])
      .withLocks(head.locks)
      .withRun(head.run);
  }

  withDependencies(dependencies: Array<Command>): Command {
    if (this.dependencies.length === 0) {
      this.dependencies.push(...dependencies);
      return this;
    }
    return Command.sequential(this.name, [
      Command.custom(this.name).withDependencies(dependencies),
      this,
    ]);
  }

  withLocks(locks: Array<Lock>): Command {
    this.locks.push(...locks);
    return this;
  }

  withRun(run: RunFunction): Command {
    this.run = run;
    return this;
  }

  withSkipIfAll(predicates: Array<Predicate>): Command {
    this.skipIfAll.push(...predicates);
    return this;
  }
}

export type Predicate = () => boolean | Promise<boolean>;
export type RunResult = CommandResult | void | string | Command[];
export type RunFunction = () => Promise<RunResult>;
