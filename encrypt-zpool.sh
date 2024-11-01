#!/bin/bash
###############################################################################
# encrypt-zpool.sh
# Converts unencrypted ZFS datasets to encrypted ones, preserving all data
# and properties.
#
# Usage:
# wget -O encrypt-zpool.sh https://raw.githubusercontent.com/hugojosefson/proxmox-root-on-encrypted-zfs/04c7a8c/encrypt-zpool.sh && chmod +x encrypt-zpool.sh && bash -x ./encrypt-zpool.sh
#
# Prerequisites:
#   - Proxmox VE 8 installation ISO
#   - Boot with Advanced Options > Terminal UI, debug mode
#   - Run bash
#
# The script will:
#   1. Import all available zpools
#   2. Let you choose which pool to encrypt (if multiple exist)
#   3. Load keys for any encrypted root datasets
#   4. Convert all unencrypted datasets to encrypted ones
#   5. Set up automatic unlocking at boot via systemd
#   6. Clean up and export pools on exit
#
# Root dataset (mountpoint=/):
#   - If already encrypted, you'll be prompted for the passphrase
#   - If unencrypted, uses keyformat=passphrase with keylocation=prompt
#   - You'll be prompted for the passphrase during encryption
#
# Non-root datasets (mountpoint!=/)
#   - Uses keyformat=passphrase with keylocation=file://${root_fs}/.${dataset_name}.key
#   - Passphrases are automatically generated and stored in key files
#   - Key files are protected (chmod 400, chattr +i)
#
# Note: This script is designed to be pipe-safe and can be interrupted safely
# during download without leaving the system in an inconsistent state.
###############################################################################

set -euo pipefail

___() {
  echo -e "\n\n${*}\n" >&2
}

___ "Global constants"
readonly TEMP_ROOT_MOUNT="/mnt/tmp_encryption"

___ "Global variables for tracking state"
declare -a MOUNTED_CHROOTS=()
declare -a TEMP_FILES=()
declare -i ENCRYPTION_COUNT=0

___ "Function declarations"
cleanup() {
    local exit_code="${?}"

#    # Cleanup any temporary files
#    for file in "${TEMP_FILES[@]}"; do
#        rm -f "${file}" || true
#    done

    ___ "Cleanup any remaining chroots"
    for mountpoint in "${MOUNTED_CHROOTS[@]}"; do
        cleanup_chroot "${mountpoint}" || true
    done

    echo "Exporting all zpools..."
    zpool export -a || true

    exit "${exit_code}"
}

create_temp_file() {
    local file

    file="$(mktemp)"
    TEMP_FILES+=("${file}")

    cat > "${file}"
    echo "${file}"
}

generate_passphrase() {
    head -c 32 /dev/urandom | base64
}

___ "Get option arguments for all settable ZFS properties for a dataset"
get_settable_properties_options_arguments() {
    local dataset="${1}"
    local -a args

    ___ "Get all properties that are:"
    ___ " - defined locally (source == 'local')"
    ___ " - not read-only (source != '-')"
    ___ " - have a value set (value != '-')"
    while IFS=$'\t' read -r name value source; do
        if [[ "${source}" == "-" ]]; then
            echo "Skipping property ${name} with value ${value} and source ${source}, because it is read-only." >&2
            continue
        fi
        if [[ "${value}" == "-" ]]; then
            echo "Skipping property ${name} with value ${value} and source ${source}, because it has no value." >&2
            continue
        fi
        echo "Adding property ${name} with value ${value} (source ${source}) to list of settable properties arguments." >&2
        args+=("-o" "${name}=${value}")
    done < "$(zfs get -pH -s local -o property,value,source all "${dataset}" | create_temp_file)"

    echo "${args[@]}"
}

setup_chroot() {
    local mountpoint="${1}"
    local mounts=(proc sys dev)

    ___ "Add to global tracking array"
    MOUNTED_CHROOTS+=("${mountpoint}")

    for mount in "${mounts[@]}"; do
        if [[ ! -d "${mountpoint}/${mount}" ]]; then
            mkdir -p "${mountpoint}/${mount}"
        fi
        mount --rbind "/${mount}" "${mountpoint}/${mount}" || {
            echo "Failed to mount ${mount} in chroot" >&2
            cleanup_chroot "${mountpoint}"
            return 1
        }
    done
}

cleanup_chroot() {
    local mountpoint="${1}"
    local mounts=(dev sys proc)

    for mount in "${mounts[@]}"; do
        umount --recursive "${mountpoint}/${mount}" 2>/dev/null || true
    done

    ___ "Remove from global tracking array"
    MOUNTED_CHROOTS=("${MOUNTED_CHROOTS[@]/${mountpoint}}")
}

create_unlock_service() {
    local mountpoint="${1}"
    local service_name="zfs-dataset-unlock.service"

    ___ "Ensure the root dataset is mounted and we have write access"
    if [[ ! -d "${mountpoint}/etc/systemd/system" ]]; then
        echo "Cannot access ${mountpoint}/etc/systemd/system. Skipping service creation."
        return 1
    fi

    cat > "${mountpoint}/etc/systemd/system/${service_name}" <<EOF
[Unit]
Description=Import and unlock ZFS encrypted datasets
DefaultDependencies=no
Before=zfs-mount.service
After=zfs-import.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/bin/sh -c 'zfs load-key -a'

[Install]
WantedBy=zfs-mount.service
EOF

    ___ "Set up chroot environment with error handling"
    if ! setup_chroot "${mountpoint}"; then
        echo "Failed to set up chroot environment. Skipping service enablement."
        return 1
    fi

    ___ "Enable the service within a subshell to capture all errors"
    if ! (chroot "${mountpoint}" systemctl enable "${service_name}"); then
        echo "Failed to enable unlock service. Manual intervention may be required."
        cleanup_chroot "${mountpoint}"
        return 1
    fi

    cleanup_chroot "${mountpoint}"
}

___ "Find the root filesystem dataset (mounted at ${TEMP_ROOT_MOUNT})"
find_root_filesystem() {
    local pool="${1}"
    zfs list -H -o name,mountpoint | awk '$2 == "'"${TEMP_ROOT_MOUNT}"'" {print $1}'
}

___ "Find the encryption root dataset"
find_encryption_root() {
    local dataset="${1}"
    local encroot
    encroot="$(zfs get -H -o value encryptionroot "${dataset}")"
    if [[ "${encroot}" == "-" ]]; then
        echo ""
    else
        echo "${encroot}"
    fi
}

check_and_load_root_key() {
    local dataset="${1}"
    local encryption_root
    local root_fs

    root_fs="$(find_root_filesystem "$(echo "${dataset}" | cut -d/ -f1)")"
    if [[ "${dataset}" == "${root_fs}" ]]; then
        encryption_root="$(find_encryption_root "${dataset}")"
        if [[ -n "${encryption_root}" ]]; then
            echo "Root filesystem dataset ${dataset} is encrypted. Loading encryption key..."
            if ! zfs load-key "${encryption_root}"; then
                echo "Failed to load key for ${dataset}. Cannot proceed."
                return 1
            fi
        fi
    fi

    return 0
}

encrypt_dataset() {
    local dataset="${1}"
    local temp_mountpoint
    local final_mountpoint
    local snapshot_name
    local encrypted_dataset
    local root_fs
    local -a option_arguments
    local configured_root_mount
    local configured_key_file
    local temp_key_file

    temp_mountpoint="$(zfs get -H -o value mountpoint "${dataset}")"
    final_mountpoint="${temp_mountpoint#"${TEMP_ROOT_MOUNT}"}"
    snapshot_name="${dataset}@pre_encryption_$(date +%Y%m%d_%H%M%S)"
    encrypted_dataset="${dataset}_encrypted"
    root_fs="$(find_root_filesystem "$(echo "${dataset}" | cut -d/ -f1)")"

    echo "Processing dataset: ${dataset}"
    echo "Creating snapshot: ${snapshot_name}"

    ___ "Create snapshot with error handling"
    if ! zfs snapshot "${snapshot_name}"; then
        echo "Failed to create snapshot for ${dataset}"
        return 1
    fi

    ___ "Get properties"
    read -r -a option_arguments <<< "$(get_settable_properties_options_arguments "${dataset}")"

    ___ "Get the configured (final) root mountpoint for key storage"
    configured_root_mount="$(zfs get -H -o value mountpoint "${root_fs}")"

    if [[ "${temp_mountpoint}" == "${TEMP_ROOT_MOUNT}" ]]; then
        ___ "Handle root filesystem dataset"

        if ! zfs create \
          -o encryption=aes-256-gcm \
          -o keyformat=passphrase \
          -o keylocation=prompt \
          "${option_arguments[@]}" \
          "${encrypted_dataset}"; then
            echo "Failed to create encrypted dataset ${encrypted_dataset}"
            zfs destroy "${snapshot_name}"
            return 1
        fi
        zfs set -u mountpoint="/" "${encrypted_dataset}"
    else
        local passphrase

        ___ "Handle non-root filesystem dataset"
        echo "Encrypting dataset: ${dataset}"

        ___ "Set up both temporary and final key paths"
        configured_key_file="${configured_root_mount}/.${dataset//\//_}.key"
        temp_key_file="${TEMP_ROOT_MOUNT}/.${dataset//\//_}.key"

        ___ "Create and secure key file in the temporary root filesystem location"
        passphrase="$(generate_passphrase)"
        mkdir -p "$(dirname "${temp_key_file}")"
        if ! echo "${passphrase}" > "${temp_key_file}"; then
            echo "Failed to create key file ${temp_key_file}"
            zfs destroy "${snapshot_name}"
            return 1
        fi

        chmod 400 "${temp_key_file}"
        chattr +i "${temp_key_file}" || echo "Warning: Could not set immutable flag on ${temp_key_file}"

        if ! zfs create \
         -u  \
         -o encryption=aes-256-gcm \
         -o keyformat=passphrase \
         -o keylocation="file://${configured_key_file}" \
         "${option_arguments[@]}" \
         "${encrypted_dataset}"; then
           echo "Failed to create encrypted dataset ${encrypted_dataset}"
            rm -f "${temp_key_file}"
            zfs destroy "${snapshot_name}"
            return 1
        fi
        echo "${passphrase}" | zfs load-key "${encrypted_dataset}"
    fi

    ___ "Transfer data"
    echo "Transferring data from ${snapshot_name} to ${encrypted_dataset}"
    if ! zfs send -R "${snapshot_name}" | zfs receive -F "${encrypted_dataset}"; then
        echo "Failed to transfer data to ${encrypted_dataset}"
        zfs destroy -r "${encrypted_dataset}"
        return 1
    fi

    ___ "Clean up original dataset and snapshot"
    zfs set -u mountpoint="${final_mountpoint}" "${encrypted_dataset}"
    zfs destroy -r "${snapshot_name}"
    zfs destroy -r "${dataset}"

    ___ "Rename encrypted dataset"
    if ! zfs rename "${encrypted_dataset}" "${dataset}"; then
        echo "Failed to rename ${encrypted_dataset} to ${dataset}"
        return 1
    fi

    ((ENCRYPTION_COUNT++))
    echo "Successfully encrypted dataset: ${dataset}"
    return 0
}

main() {
    ___ "Register cleanup function"
    trap cleanup EXIT INT TERM

    ___ "Ensure temp mount point exists"
    mkdir -p "${TEMP_ROOT_MOUNT}"

    echo "Exporting, then importing all available zpools, without mounting..."
    zpool export -fa || true
    zpool import -faN -R "${TEMP_ROOT_MOUNT}" || {
        echo "Failed to import zpools. Exiting."
        exit 1
    }

    ___ "Get list of available zpools"
    local -a pools
    mapfile -t pools < "$(zpool list -H -o name | create_temp_file)"

    if [[ ${#pools[@]} -eq 0 ]]; then
        echo "No zpools found. Exiting."
        exit 1
    fi

    ___ "If multiple pools exist, let user choose which to encrypt"
    local selected_pool
    if [[ ${#pools[@]} -eq 1 ]]; then
        selected_pool="${pools[0]}"
    else
        echo "Multiple zpools found. Please select one to encrypt:"
        select pool in "${pools[@]}"; do
            if [[ -n "${pool}" ]]; then
                selected_pool="${pool}"
                break
            fi
        done
    fi

    echo "Selected pool: ${selected_pool}"

    ___ "Find and handle root filesystem dataset first"
    local root_fs
    root_fs="$(find_root_filesystem "${selected_pool}")"

    if [[ -z "${root_fs}" ]]; then
        ___ "If no root filesystem is found, we have no place to store keys"
        echo "No root filesystem found. Cannot proceed."
        exit 1
    fi

    echo "Found root filesystem dataset: ${root_fs}"
    ___ "If root filesystem is unencrypted, encrypt it first"
    if [[ -z "$(find_encryption_root "${root_fs}")" ]]; then
        echo "Root filesystem is unencrypted. Encrypting it first..."
        if ! encrypt_dataset "${root_fs}"; then
            echo "Failed to encrypt root filesystem. Cannot proceed."
            exit 1
        fi
    else
        ___ "If root filesystem is already encrypted, load key"
        if ! check_and_load_root_key "${root_fs}"; then
            exit 1
        fi
    fi

    ___ "Find all remaining unencrypted datasets in the selected pool"
    local -a unencrypted_datasets
    mapfile -t unencrypted_datasets < "$(zfs list -H -o name,encryption,keystatus \
        -t filesystem -s name -r "${selected_pool}" | \
        awk '($2 == "off" || ($2 != "off" && $3 == "none")) {print $1}' | \
        create_temp_file)"

    if [[ ${#unencrypted_datasets[@]} -eq 0 ]]; then
        echo "No unencrypted datasets found in ${selected_pool}. Exiting."
        exit 0
    fi

    echo "Found ${#unencrypted_datasets[@]} unencrypted datasets."

    ___ "Process each unencrypted dataset"
    for dataset in "${unencrypted_datasets[@]}"; do
        ___ "Skip root filesystem as it's already handled"
        if [[ "${dataset}" == "${root_fs}" ]]; then
            continue
        fi

        if ! encrypt_dataset "${dataset}"; then
            echo "Failed to encrypt ${dataset}. Continuing with remaining datasets..."
            continue
        fi
    done

    ___ "Create and enable systemd unlock service if we encrypted anything"
    if ((ENCRYPTION_COUNT > 0)); then
        if [[ -n "${root_fs}" ]]; then
            if [[ -d "${TEMP_ROOT_MOUNT}" ]]; then
                echo "Creating systemd unlock service..."
                create_unlock_service "${TEMP_ROOT_MOUNT}"
            fi
        fi

        echo "Successfully encrypted ${ENCRYPTION_COUNT} datasets!"
        echo "IMPORTANT: You will find the encryption keys for non-root datasets in /.\${dataset_name}.key files, after boot."
        echo "Make sure to back them up to a secure location for recovery purposes."
    else
        echo "No datasets were encrypted successfully."
    fi

    echo "Exiting..."
}

main "$@"
