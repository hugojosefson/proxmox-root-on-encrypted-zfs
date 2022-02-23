import { config } from "../config.ts";
import { defer, Deferred } from "../os/defer.ts";
import { run } from "../run.ts";
import { Lock, LockReleaser } from "./dependency.ts";
import { Ish, resolveValue, resolveValues } from "../fn.ts";
import { Stringifiable } from "./stringifiable.ts";

export interface CommandResult {
  status: Deno.ProcessStatus;
  stdout: string;
  stderr: string;
}

export class Command implements Stringifiable {
  readonly name: string;
  readonly dependencies: Array<Ish<Command>> = new Array(0);
  readonly locks: Array<Ish<Lock>> = new Array(0);
  readonly skipIfAll: Array<Ish<Predicate>> = new Array(0);
  readonly doneDeferred: Deferred<CommandResult> = defer();
  readonly done: Promise<CommandResult> = this.doneDeferred.promise;

  constructor(name: string) {
    this.name = name;
  }

  async stringify(): Promise<string> {
    return [
      `Command.custom(${this.name})`,
      this.locks.length
        ? `\n    .withLocks([${
          (await resolveValues(this.locks))
            .map(async (lock) => (await lock.stringify()))
            .join(", ")
        }])`
        : "",
      this.dependencies.length
        ? `\n    .withDependencies([${
          (await resolveValues(this.dependencies))
            .map((dep) => dep.name)
            .join(", ")
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
        this.skipIfAll.map(async (predicatish) => {
          const predicate = await resolveValue(predicatish);
          if (predicate()) {
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
    if (this.doneDeferred.isDone) {
      return this.done;
    }

    const dependencies: Array<Command> = await resolveValues(
      this.dependencies,
    );
    dependencies.forEach((dep) => dep.runWhenDependenciesAreDone());
    const dependenciesDone = dependencies.map(({ done }) => done);
    await Promise.all(dependenciesDone);

    const verbose = (await config("VERBOSE"));
    if (await this.shouldSkip()) {
      verbose && console.error(`Skipping command `, await this.stringify());
      const runResult: CommandResult = {
        status: { success: true, code: 0 },
        stdout: `Already done: ${await this.stringify()}`,
        stderr: "",
      } as const;
      this.doneDeferred.resolve(runResult);
    }

    if (this.doneDeferred.isDone) {
      return this.done;
    }

    verbose && console.error(`Running command `, await this.stringify());

    const locks: Array<Lock> = await resolveValues(this.locks);
    const lockReleaserPromises: Promise<LockReleaser>[] = locks
      .map((lock) => lock.take());

    try {
      const innerResult: RunResult = await (this.run().catch(
        this.doneDeferred.reject,
      ));
      verbose &&
        console.error(`Running command ${await this.stringify()} DONE.`);
      return this.resolve(innerResult);
    } finally {
      for (const lockReleaserPromise of lockReleaserPromises) {
        const releaseTheLock: () => void = await lockReleaserPromise;
        releaseTheLock();
      }
    }
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
        stdout: `Success: ${await this.stringify()}`,
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

  withDependencies(dependencies: Array<Ish<Command>>): Command {
    this.dependencies.push(...dependencies);
    return this;
  }

  withLocks(locks: Array<Ish<Lock>>): Command {
    this.locks.push(...locks);
    return this;
  }

  withRun(run: RunFunction): Command {
    if (this.run !== Command.prototype.run) {
      throw new Error(`Unexpectedly trying to overwrite run method:
${this.run.toString()}

with:

${run.toString()}`);
    }
    this.run = run;
    return this;
  }

  withSkipIfAll(predicates: Array<Ish<Predicate>>): Command {
    this.skipIfAll.push(...predicates);
    return this;
  }
}

export class Sequential extends Command {
  readonly commands: Ish<Command>[];
  constructor(name: string, commands: Ish<Command>[]) {
    super(name);
    this.commands = commands;
  }

  async run(): Promise<RunResult> {
    let result: RunResult | undefined;
    const commands: Array<Command> = await resolveValues(this.commands);
    for (const command of commands) {
      console.error(
        `${this.name}: Running sequentially ${await command.stringify()}`,
      );
      result = await command.runWhenDependenciesAreDone();
    }
    return result;
  }
}

export type Predicate = () => boolean | Promise<boolean>;
export type RunResult = CommandResult | void | string | Command[];
export type RunFunction = () => Promise<RunResult>;
