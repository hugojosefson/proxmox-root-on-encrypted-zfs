import { inChrootCommand } from "./chroot-basic-system-environment.ts";

export const debian8DisableLogCompression = inChrootCommand(
  "debian8DisableLogCompression",
  `
for file in /etc/logrotate.d/* ; do
    if grep -Eq "(^|[^#y])compress" "$file" ; then
        sed -i -r "s/(^|[^#y])(compress)/\\1#\\2/" "$file"
    fi
done
`,
);
