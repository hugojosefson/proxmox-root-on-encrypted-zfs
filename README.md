# proxmox-root-on-encrypted-zfs

Installs Proxmox Virtual Environment (Proxmox VE) with root filesystem on ZFS
with native encryption.

This is a more automated way of following these guides:

- [Debian Bookworm Root on ZFS](https://openzfs.github.io/openzfs-docs/Getting%20Started/Debian/Debian%20Bookworm%20Root%20on%20ZFS.html)
  (via [OpenZFS Documentation](https://openzfs.github.io/openzfs-docs/))
- [Install Proxmox VE on Debian 12 Bookworm](https://pve.proxmox.com/wiki/Install_Proxmox_VE_on_Debian_12_Bookworm)
  (via [Proxmox VE official wiki](https://pve.proxmox.com/wiki))

## Opinionated

For details and choices made, see
[Opinionated: Specifics](#opinionated-specifics) below.

## Requirements

See the above guides for
[**Caution**](https://openzfs.github.io/openzfs-docs/Getting%20Started/Debian/Debian%20Bookworm%20Root%20on%20ZFS.html#id2)
and
[System Requirements](https://openzfs.github.io/openzfs-docs/Getting%20Started/Debian/Debian%20Bookworm%20Root%20on%20ZFS.html#system-requirements).

## Install

Download and boot the recommended Debian ISO. See
[Step 1: Prepare The Install Environment](https://openzfs.github.io/openzfs-docs/Getting%20Started/Debian/Debian%20Bookworm%20Root%20on%20ZFS.html#step-1-prepare-the-install-environment).

Only do the first item in the list (until _Open a terminal_).

> **Tip!**
>
> If you want to boot much faster, and get dropped into a shell immediately, you
> may want to use `debian-live-12.*-amd64-standard.iso`! Download it from the
> same place as the other ISO:
>
> [https://cdimage.debian.org/debian-cd/current-live/amd64/iso-hybrid/](https://cdimage.debian.org/debian-cd/current-live/amd64/iso-hybrid/)
>
> Log in as `user`, with password `live`, if asked.

Instead of editing files etc. manually, launch this automated script from the
terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/hugojosefson/proxmox-root-on-encrypted-zfs/main/src/cli.ts | sudo sh -s --
```

> Note: You may suffix any environment variable with `_FILE` or `_URL` to load
> its contents from that file or url, respectively.

### More detailed full example

#### Install Debian from the LiveCD

```bash
curl -fsSL https://raw.githubusercontent.com/hugojosefson/proxmox-root-on-encrypted-zfs/main/src/cli.ts | sh -s --

sudo  NON_INTERACTIVE=true \
      VERBOSE=true \
      IP=192.168.122.253/24 \
      FQDN=pve1.example.com \
      DISKS=/dev/vda,/dev/vdb \
      DISK_ENCRYPTION_PASSWORD="I can't believe it's not as secure as it should be" \
      ROOT_PASSWORD="iamroot" \
      ROOT_AUTHORIZED_KEYS_URL=https://github.com/hugojosefson.keys \
      /tmp/deno-range*/bin/deno run --reload=https://raw.githubusercontent.com --unstable --allow-all \
        https://raw.githubusercontent.com/hugojosefson/proxmox-root-on-encrypted-zfs/main/src/cli.ts \
        debian
```

> If you want to inspect the chroot:
>
> ```bash
> sudo chroot /mnt /usr/bin/env bash --login
> ```

Reboot into the installed OS.

When you get to the initramfs prompt, run these two commands:

```sh
zpool import -fa
zpool export -a
```

Then press CTRL+ALT+DELETE to reboot again, and you will be prompted for the zfs
encryption key.

#### Install Proxmox VE

Login as `root`.

Continue manually at
[Install Proxmox VE Kernel etc](https://pve.proxmox.com/wiki/Install_Proxmox_VE_on_Debian_12_Bookworm#Install_the_Proxmox_VE_Kernel)
in the _Install Proxmox VE on Debian 12 Bookworm_ guide.

## Opinionated: Specifics

This is how this installer is more specific and/or different, compared to the
guides linked above.

### Debian

#### Step 1: Prepare The Install Environment

1.
2. Use
   [src/commands/files/etc/apt/sources.list](src/commands/files/etc/apt/sources.list).
3. Skip installing `openssh-server` in live boot environment during
   installation.

#### Step 2: Disk Formatting

1. Use environment variable `DISKS` to specify which disks to use.
2. Optionally clear any existing ZFS pools and disks with the command
   `destroy-all-pools-and-disks`. Make sure nothing is connected that you wish
   to keep!
3. No LUKS. ZFS native encryption. EFI 1GB partition, on all disks.
4. Mirror over all disks. If only one disk, using `copies=2` instead.
5. `zstd` compression for the root pool. ZFS native encryption. No LUKS. Mirror
   over all disks (or `copies=2` if single disk).

#### Step 3: System Installation

1.
2.
3. Skip separate dataset for
   `rpool/var/{games,mail,snap,www,lib/AccountsService}`, `rpool/tmp`. Set up
   tmpfs later.

#### Step 4: System Configuration

1. Configure hostname from first part of environment variable `FQDN`.
2. Configure network via environment variable `IP`.
3. Comment out `deb-src` lines.
4.
5. Pre-answer install questions with contents of
   [src/commands/files/debconf-selections](src/commands/files/debconf-selections).
6.
7. No LUKS.
8. Only install GRUB for UEFI, not for legacy (BIOS) booting.
9.
10. Set `root` password via environment variable `ROOT_PASSWORD`.
11.
12. Mount a tmpfs to `/tmp`.
13. No `PermitRootLogin yes`, but leave `/etc/ssh/sshd_config` default
    configured as `PermitRootLogin prohibit-password`. Pre-populate
    `/root/.ssh/authorized_keys` from environment variable
    `ROOT_AUTHORIZED_KEYS`.
14. Install Dropbear for remote unlocking, but let it generate its own server
    keys. Useful to access it using a different hostname, so that the ssh client
    keeps track of the two different sets of host keys at different hostnames.
15. Skip installing `popularity-contest`.

#### Step 5: GRUB Installation

1.
2.
3.
4. Make debugging GRUB easier.
5.
6. No BIOS, only UEFI booting.
7.

#### Step 6: First Boot

1. No snapshot. It's easy enough to re-run this installer :)
2.
3.
4. Rebooting and re-running the installer, usually works to resolve any
   partition or pool mounting/unmounting issues.
5.
6. Create no extra user account.
7. No BIOS, only UEFI booting. Mirror over all disks.

#### Step 7: Optional: Configure Swap

No swap.

#### Step 8: Full Software Installation

1.
2. Skip `tasksel`.
3. Disable log compression.
4. No need to reboot here. Move on to installing Proxmox VE.

#### Step 9: Final Cleanup

Skip the rest;

1. We're not rebooting, and only `root` exists.
2. No snapshots to delete.
3. Keep `root` password for now.
4. Keep ssh login as configured before.
5. Leave GRUB config at full text.
6. No LUKS.

### Proxmox VE

#### Install a standard Debian 12 Bookworm (amd64)

##### Add an /etc/hosts entry for your IP address

- 1 IPv4 address, configured via environment variable `IP`.
- Hostname and FQDN from environment variable `FQDN`.

#### Install Proxmox VE

##### Adapt your sources.list

- Put the `pve-no-subscription` repo in `/etc/apt/sources.list`.

##### Install Proxmox VE Kernel, and packages

- Pre-answer install questions with contents of
  [src/commands/files/debconf-selections](src/commands/files/debconf-selections).

- Not installing the `proxmox-default-kernel`, `proxmox-ve` packages, but
  leaving it up to manual installation and configuration.

See
[Install Proxmox VE Kernel](https://pve.proxmox.com/wiki/Install_Proxmox_VE_on_Debian_12_Bookworm#Install_the_Proxmox_VE_Kernel)
and the following sections in the _Install Proxmox VE on Debian 12 Bookworm_
guide.
