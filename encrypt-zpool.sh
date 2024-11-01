#!/bin/bash
###############################################################################
# encrypt-zpool.sh
# Converts unencrypted ZFS datasets to encrypted ones, preserving all data
# and properties.
#
# Usage:
#   wget -O- https://raw.githubusercontent.com/hugojosefson/proxmox-root-on-encrypted-zfs/encrypt-zpool/encrypt-zpool.sh | bash -s --
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
#   - Uses keyformat=passphrase with keylocation=file:///.${dataset_name}.key
#   - Passphrases are automatically generated and stored in key files
#   - Key files are protected (chmod 400, chattr +i)
#
# Note: This script is designed to be pipe-safe and can be interrupted safely
# during download without leaving the system in an inconsistent state.
###############################################################################

set -euo pipefail

# Global variables for tracking state
declare -a MOUNTED_CHROOTS=()
declare -a TEMP_FILES=()
declare -i ENCRYPTION_COUNT=0

# Function declarations
cleanup() {
    local exit_code="${?}"

    # Cleanup any temporary files
    for file in "${TEMP_FILES[@]}"; do
        rm -f "${file}" || true
    done

    # Cleanup any remaining chroots
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

# Get all settable ZFS properties for a dataset
get_settable_properties() {
    local dataset="${1}"
    local -a properties

    # Get all properties that are:
    # - not read-only (source != '-')
    # - not inherited (source != 'inherited')
    # - not default (source != 'default')
    # - have a value set (value != '-')
    while IFS=$'\t' read -r name value source; do
        if [[ "${source}" == "-" ]]; then
            continue
        fi
        if [[ "${source}" == "inherited" ]]; then
            continue
        fi
        if [[ "${source}" == "default" ]]; then
            continue
        fi
        if [[ "${value}" == "-" ]]; then
            continue
        fi
        properties+=("${name}" "${value}")
    done < "$(zfs get -H -o property,value,source all "${dataset}" | create_temp_file)"

    echo "${properties[@]}"
}

setup_chroot() {
    local mountpoint="${1}"
    local mounts=(proc sys dev)

    # Add to global tracking array
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

    # Remove from global tracking array
    MOUNTED_CHROOTS=("${MOUNTED_CHROOTS[@]/${mountpoint}}")
}

create_unlock_service() {
    local mountpoint="${1}"
    local service_name="zfs-dataset-unlock.service"

    # Ensure the root dataset is mounted and we have write access
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

    # Set up chroot environment with error handling
    if ! setup_chroot "${mountpoint}"; then
        echo "Failed to set up chroot environment. Skipping service enablement."
        return 1
    fi

    # Enable the service within a subshell to capture all errors
    if ! (chroot "${mountpoint}" systemctl enable "${service_name}"); then
        echo "Failed to enable unlock service. Manual intervention may be required."
        cleanup_chroot "${mountpoint}"
        return 1
    fi

    cleanup_chroot "${mountpoint}"
}

check_and_load_root_key() {
    local dataset="${1}"
    local encryption_root

    # Check if dataset is encrypted
    encryption_root="$(zfs get -H -o value encryptionroot "${dataset}")"

    if [[ "${encryption_root}" != "-" ]]; then
        echo "Root dataset ${dataset} is encrypted. Loading encryption key..."
        if ! zfs load-key "${encryption_root}"; then
            echo "Failed to load key for ${dataset}. Cannot proceed."
            return 1
        fi
        return 0
    fi

    return 0
}

encrypt_dataset() {
    local dataset="${1}"
    local mountpoint
    local snapshot_name
    local encrypted_dataset
    local -a props

    mountpoint="$(zfs get -H -o value mountpoint "${dataset}")"
    snapshot_name="${dataset}@pre_encryption_$(date +%Y%m%d_%H%M%S)"
    encrypted_dataset="${dataset}_encrypted"

    echo "Processing dataset: ${dataset}"
    echo "Creating snapshot: ${snapshot_name}"

    # Create snapshot with error handling
    if ! zfs snapshot "${snapshot_name}"; then
        echo "Failed to create snapshot for ${dataset}"
        return 1
    fi

    # Get properties
    read -r -a props <<< "$(get_settable_properties "${dataset}")"

    # Handle root vs non-root datasets
    if [[ "${mountpoint}" == "/" ]]; then
        echo "Root dataset detected. Using passphrase encryption with prompt."
        local passphrase
        read -r -s -p "Enter passphrase for ${dataset}: " passphrase
        echo

        if ! zfs create -o encryption=aes-256-gcm \
                       -o keyformat=passphrase \
                       -o keylocation=prompt \
                       -o mountpoint="${mountpoint}" \
                       "${props[@]/#/-o }" \
                       "${encrypted_dataset}"; then
            echo "Failed to create encrypted dataset ${encrypted_dataset}"
            zfs destroy "${snapshot_name}"
            return 1
        fi

        echo "${passphrase}" | zfs load-key "${encrypted_dataset}"
    else
        echo "Non-root dataset detected. Using passphrase encryption with key file."
        local key_file="/.${dataset//\//_}.key"
        local passphrase

        passphrase="$(generate_passphrase)"

        # Create and secure key file
        if ! echo "${passphrase}" > "${key_file}"; then
            echo "Failed to create key file ${key_file}"
            zfs destroy "${snapshot_name}"
            return 1
        fi

        chmod 400 "${key_file}"
        chattr +i "${key_file}" || echo "Warning: Could not set immutable flag on ${key_file}"

        if ! zfs create -o encryption=aes-256-gcm \
                       -o keyformat=passphrase \
                       -o keylocation="file://${key_file}" \
                       -o mountpoint="${mountpoint}" \
                       "${props[@]/#/-o }" \
                       "${encrypted_dataset}"; then
            echo "Failed to create encrypted dataset ${encrypted_dataset}"
            rm -f "${key_file}"
            zfs destroy "${snapshot_name}"
            return 1
        fi

        echo "${passphrase}" | zfs load-key "${encrypted_dataset}"
    fi

    # Transfer data
    echo "Transferring data from ${snapshot_name} to ${encrypted_dataset}"
    if ! zfs send -R "${snapshot_name}" | zfs receive "${encrypted_dataset}"; then
        echo "Failed to transfer data to ${encrypted_dataset}"
        zfs destroy -r "${encrypted_dataset}"
        return 1
    fi

    # Clean up original dataset and snapshot
    zfs destroy -r "${snapshot_name}"
    zfs destroy -r "${dataset}"

    # Rename encrypted dataset
    if ! zfs rename "${encrypted_dataset}" "${dataset}"; then
        echo "Failed to rename ${encrypted_dataset} to ${dataset}"
        return 1
    fi

    ((ENCRYPTION_COUNT++))
    echo "Successfully encrypted dataset: ${dataset}"
    return 0
}

main() {
    # Register cleanup function
    trap cleanup EXIT INT TERM

    # Import all zpools forcibly
    echo "Importing all available zpools..."
    zpool import -a -f || {
        echo "Failed to import zpools. Exiting."
        exit 1
    }

    # Get list of available zpools
    local -a pools
    mapfile -t pools < "$(zpool list -H -o name | create_temp_file)"

    if [[ ${#pools[@]} -eq 0 ]]; then
        echo "No zpools found. Exiting."
        exit 1
    fi

    # If multiple pools exist, let user choose which to encrypt
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

    # Check and load root dataset key if encrypted
    local root_dataset="${selected_pool}"
    if ! check_and_load_root_key "${root_dataset}"; then
        exit 1
    fi

    # Find all unencrypted datasets in the selected pool
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

    # Process each unencrypted dataset
    for dataset in "${unencrypted_datasets[@]}"; do
        if ! encrypt_dataset "${dataset}"; then
            echo "Failed to encrypt ${dataset}. Continuing with remaining datasets..."
            continue
        fi
    done

    # Create and enable systemd unlock service if we encrypted anything
    if ((ENCRYPTION_COUNT > 0)); then
        local pool_mountpoint
        pool_mountpoint="$(zfs get -H -o value mountpoint "${selected_pool}")"
        if [[ -d "${pool_mountpoint}" ]]; then
            echo "Creating systemd unlock service..."
            create_unlock_service "${pool_mountpoint}"
        fi

        echo "Successfully encrypted ${ENCRYPTION_COUNT} datasets!"
        echo "IMPORTANT: The encryption keys for non-root datasets are stored in /.${dataset_name}.key files."
        echo "Make sure to back these up to a secure location for recovery purposes."
    else
        echo "No datasets were encrypted successfully."
    fi

    echo "Exiting..."
}

main "$@"
