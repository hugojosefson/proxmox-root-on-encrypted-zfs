import { CreateFile } from "./common/file-commands.ts";
import { FileSystemPath } from "../model/dependency.ts";
import { readRelativeFile } from "../os/read-relative-file.ts";
import { ROOT } from "../os/user/target-user.ts";

export const aptSourcesList = new CreateFile(
  ROOT,
  FileSystemPath.of(ROOT, "/etc/apt/sources.list"),
  await readRelativeFile(
    "./files/etc/apt/sources.list",
    import.meta.url,
  ),
  true,
);
