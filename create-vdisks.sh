#!/usr/bin/env bash

set -euo pipefail
IFS=$'\t\n'

sudo qemu-img create -f qcow2 /var/lib/libvirt/images/debian11.qcow2 128G
sudo qemu-img create -f qcow2 /var/lib/libvirt/images/debian11-1.qcow2 500G
sudo qemu-img create -f qcow2 /var/lib/libvirt/images/debian11-2.qcow2 1024G

