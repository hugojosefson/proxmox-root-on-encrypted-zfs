# proxmox-root-on-encrypted-zfs

Installs Proxmox Virtual Environment (Proxmox VE) with root filesystem on ZFS with native encryption.

This is a more automated way of following these guides:

- [Debian Bullseye Root on ZFS](https://openzfs.github.io/openzfs-docs/Getting%20Started/Debian/Debian%20Bullseye%20Root%20on%20ZFS.html) (via [OpenZFS Documentation](https://openzfs.github.io/openzfs-docs/))
- [Install Proxmox VE on Debian 11 Bullseye](https://pve.proxmox.com/wiki/Install_Proxmox_VE_on_Debian_11_Bullseye) (via [Proxmox VE official wiki](https://pve.proxmox.com/wiki))

## Requirements

See the above guides for [**Caution**](https://openzfs.github.io/openzfs-docs/Getting%20Started/Debian/Debian%20Bullseye%20Root%20on%20ZFS.html#caution) and [System Requirements](https://openzfs.github.io/openzfs-docs/Getting%20Started/Debian/Debian%20Bullseye%20Root%20on%20ZFS.html#system-requirements).

## Install

Download and boot the recommended Debian ISO. See [Step 1: Prepare The Install Environment](https://openzfs.github.io/openzfs-docs/Getting%20Started/Debian/Debian%20Bullseye%20Root%20on%20ZFS.html#step-1-prepare-the-install-environment).

Only do the first item in the list. After opening the terminal, do this instead:

```bash
curl -fsSL https://raw.githubusercontent.com/hugojosefson/proxmox-root-on-encrypted-zfs/main/install \
| sudo bash
```
