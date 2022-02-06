import { CreateFile } from "./common/file-commands.ts";
import { FileSystemPath } from "../model/dependency.ts";
import { readRelativeFile } from "../os/read-relative-file.ts";
import { debian3SystemInstallation } from "./debian-3-system-installation.ts";
import { ROOT } from "../os/user/root.ts";

export const aptSourcesList = new CreateFile(
  ROOT,
  FileSystemPath.of(ROOT, "/etc/apt/sources.list"),
  await readRelativeFile(
    "./files/etc/apt/sources.list",
    import.meta.url,
  ),
  true,
);
