# proxmox-root-on-encrypted-zfs

Installs Proxmox Virtual Environment (Proxmox VE) with root filesystem on ZFS with native encryption.

This is a more automated way of following these guides:

- [Debian Bullseye Root on ZFS](https://openzfs.github.io/openzfs-docs/Getting%20Started/Debian/Debian%20Bullseye%20Root%20on%20ZFS.html) (via [OpenZFS Documentation](https://openzfs.github.io/openzfs-docs/))
- [Install Proxmox VE on Debian 11 Bullseye](https://pve.proxmox.com/wiki/Install_Proxmox_VE_on_Debian_11_Bullseye) (via [Proxmox VE official wiki](https://pve.proxmox.com/wiki))

## Requirements

See the above guides for [**Caution**](https://openzfs.github.io/openzfs-docs/Getting%20Started/Debian/Debian%20Bullseye%20Root%20on%20ZFS.html#caution) and [System Requirements](https://openzfs.github.io/openzfs-docs/Getting%20Started/Debian/Debian%20Bullseye%20Root%20on%20ZFS.html#system-requirements).

## Install

Download and boot the recommended Debian ISO. See [Step 1: Prepare The Install Environment](https://openzfs.github.io/openzfs-docs/Getting%20Started/Debian/Debian%20Bullseye%20Root%20on%20ZFS.html#step-1-prepare-the-install-environment).

Only do the first item in the list (open the terminal).

> **Tip!**
>
> The `debian-live-11.*-amd64-standard.iso` boots faster, and drops you immediately into a terminal! Download it from the same place as other ISO:
>
> [https://cdimage.debian.org/debian-cd/current-live/amd64/iso-hybrid/](https://cdimage.debian.org/debian-cd/current-live/amd64/iso-hybrid/)

Instead of editing files etc. manually, launch this automated script from the terminal:

```bash
curl -fsSL http://dev-server:3000/src/cli.ts | sudo sh -s --
```