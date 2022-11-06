import { NOOP } from "./commands/common/noop.ts";
import { memoize, toposort } from "./deps.ts";
import { Command, CommandResult } from "./model/command.ts";
import { Lock } from "./model/dependency.ts";
import { indent } from "./fn.ts";
import { config } from "./config.ts";

function getDependencyPairs_(
  command: Command,
  depth = 0,
): Array<[Command, Command]> {
  console.log(indent(depth, command.toString()));
  if (command.dependencies.length === 0) {
    return [[NOOP(), command]];
  }
  const thisCommandDependsOnItsDependencies: Array<[Command, Command]> = command
    .dependencies
    .map((dep) => [dep, command]);

  const dependenciesDependOnTheirDependencies: Array<[Command, Command]> =
    command.dependencies.flatMap((dep) =>
      dep === command ? [] : getDependencyPairs(dep, depth + 1)
    );

  return [
    ...thisCommandDependsOnItsDependencies,
    ...dependenciesDependOnTheirDependencies,
  ];
}
const getDependencyPairs: typeof getDependencyPairs_ = memoize(
  getDependencyPairs_,
  { cacheKey: (command: Command) => JSON.stringify(command) },
);

type CommandForLog = {
  dependencies?: CommandForLog[];
  locks?: Lock[];
};

const forLog = (depth: number) => (command: Command): CommandForLog => {
  const { dependencies, locks } = command;
  return (depth > 0)
    ? {
      dependencies: dependencies.map(forLog(depth - 1)),
      locks,
    }
    : {};
};

export const sortCommands = (commands: Command[]): Command[] => {
  const dependencyPairs: [Command, Command][] = commands.flatMap(
    getDependencyPairs,
  );

  const commandsInOrder: Command[] = toposort(dependencyPairs);
  return commandsInOrder;
};

export async function run(commands: Command[]): Promise<CommandResult[]> {
  for (const command of commands) {
    console.log(command.toString());
    console.log();
  }
  console.log("Sorting them...");

  const sortedCommands: Command[] = sortCommands(commands);
  for (const sortedCommand of sortedCommands) {
    console.log(sortedCommand.toString());
    console.log();
  }
  if (!config.NON_INTERACTIVE && prompt("OK to start?", "y") !== "y") {
    console.log("You did not answer 'y'. Quitting.");
    Deno.exit(0);
  }

  const commandResults: CommandResult[] = [];
  for (const command of sortedCommands) {
    if (command.doneDeferred.isDone) {
      console.log(`Already done, so not enqueueing: ${command.toString()}\n`);
    } else if (await command.shouldSkip()) {
      console.log(`Should skip, so not enqueueing: ${command.toString()}\n`);
    } else {
      console.log(`\nWill enqueue: ${command.toString()}\n`);
      if (!config.NON_INTERACTIVE && prompt("OK to continue?", "y") === "n") {
        console.log("You did not answer 'y'. Quitting.");
        Deno.exit(0);
      }
      commandResults.push(await command.runWhenDependenciesAreDone());
    }
  }

  return commandResults;
}
