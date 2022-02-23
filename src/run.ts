import { NOOP } from "./commands/common/noop.ts";
import { toposort } from "./deps.ts";
import { Command, CommandResult } from "./model/command.ts";
import { Lock } from "./model/dependency.ts";
import { flatmapAsync, resolveValues } from "./fn.ts";

type CommandPair = [Command, Command];

async function getDependencyPairs(
  command: Command,
): Promise<Array<CommandPair>> {
  const dependencies = await resolveValues(command.dependencies);
  if (dependencies.length === 0) {
    return [[NOOP(), command]];
  }
  const thisCommandDependsOnItsDependencies: Array<CommandPair> = dependencies
    .map((
      dep,
    ) => [dep, command]);

  const dependenciesDependOnTheirDependencies: Array<CommandPair> =
    (await resolveValues(
      dependencies.map(async (dep) => await getDependencyPairs(dep)),
    )).flat();

  return [
    ...thisCommandDependsOnItsDependencies,
    ...dependenciesDependOnTheirDependencies,
  ];
}

type CommandForLog = {
  dependencies?: CommandForLog[];
  locks?: Lock[];
};

function forLog(depth: number) {
  return async (command: Command): Promise<CommandForLog> => {
    const dependencies: Array<Command> = await resolveValues(
      command.dependencies,
    );
    const locks: Array<Lock> = await resolveValues(command.locks);
    if (depth === 0) {
      return {};
    }
    const logifyCommand: (command: Command) => Promise<CommandForLog> = forLog(
      depth - 1,
    );
    return {
      dependencies: await Promise.all(dependencies.map(logifyCommand)),
      locks,
    };
  };
}

export async function sortCommands(commands: Command[]): Promise<Command[]> {
  const dependencyPairs: [Command, Command][] = await flatmapAsync(
    getDependencyPairs,
    commands,
  );

  const commandsInOrder: Command[] = toposort(dependencyPairs);
  return commandsInOrder;
}

export async function run(commands: Command[]): Promise<CommandResult[]> {
  const sortedCommands: Command[] = await sortCommands(commands);

  const commandResults: CommandResult[] = [];
  for (const command of sortedCommands) {
    console.log(`\nWill enqueue: ${await command.stringify()}\n`);
    commandResults.push(await command.runWhenDependenciesAreDone());
  }

  return commandResults;
}
