import { CreateFile } from "./common/file-commands.ts";
import { ROOT } from "../os/user/root.ts";
import { FileSystemPath } from "../model/dependency.ts";
import { readRelativeFile } from "../os/read-relative-file.ts";
import { networkInterface } from "./network-interface.ts";

export const aptSourcesListMnt = new CreateFile(
  ROOT,
  FileSystemPath.of(ROOT, "/mnt/etc/apt/sources.list"),
  await readRelativeFile(
    "./files/etc/apt/sources.list",
    import.meta.url,
  ),
  false,
)
  .withDependencies([networkInterface]);
