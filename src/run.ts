import { NOOP } from "./commands/common/noop.ts";
import { toposort } from "./deps.ts";
import { Command, CommandResult } from "./model/command.ts";
import { Lock } from "./model/dependency.ts";

function getDependencyPairs(command: Command): Array<[Command, Command]> {
  if (command.dependencies.length === 0) {
    return [[NOOP(), command]];
  }
  const thisCommandDependsOnItsDependencies: Array<[Command, Command]> = command
    .dependencies
    .map((
      dep,
    ) => [dep, command]);

  const dependenciesDependOnTheirDependencies: Array<[Command, Command]> =
    command.dependencies.flatMap((dep) => getDependencyPairs(dep));

  return [
    ...thisCommandDependsOnItsDependencies,
    ...dependenciesDependOnTheirDependencies,
  ];
}

type CommandForLog = {
  dependencies?: CommandForLog[];
  locks?: Lock[];
};

const forLog = (depth: number) =>
  (command: Command): CommandForLog => {
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
  const sortedCommands: Command[] = sortCommands(commands);

  const commandResults: CommandResult[] = [];
  for (const command of sortedCommands) {
    console.log(`\nWill enqueue: ${command.toString()}\n`);
    commandResults.push(await command.runWhenDependenciesAreDone());
  }

  return commandResults;
}
