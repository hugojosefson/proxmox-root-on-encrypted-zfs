#!/bin/bash
###############################################################################
# encrypt-zpool.sh
# Converts unencrypted ZFS datasets to encrypted ones, preserving all data
# and properties.
#
# Usage:
# wget -O encrypt-zpool.sh https://raw.githubusercontent.com/hugojosefson/proxmox-root-on-encrypted-zfs/f84ade4/encrypt-zpool.sh && chmod +x encrypt-zpool.sh && ./encrypt-zpool.sh
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
#   - Uses keyformat=passphrase with keylocation=file:///.zfs-encryption.key
#   - Passphrase automatically generated and stored in key file
#   - Key file protected (chmod 400, chattr +i)
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
readonly CONFIGURED_KEY_FILE="/.zfs-encryption.key"
readonly CURRENT_KEY_FILE="${TEMP_ROOT_MOUNT}/${CONFIGURED_KEY_FILE}"

___ "Global variables for tracking state"
declare -a MOUNTED_CHROOTS=()
declare -a TEMP_FILES=()
declare -i ENCRYPTION_COUNT=0

___ "Function declarations"
cleanup() {
    local exit_code="${?}"

    # Cleanup any temporary files
    if ((${#TEMP_FILES[@]} > 0)); then
        for file in "${TEMP_FILES[@]}"; do
            rm -f "${file}" || true
        done
    fi

    ___ "Cleanup any remaining chroots"
    if ((${#MOUNTED_CHROOTS[@]} > 0)); then
        for mountpoint in "${MOUNTED_CHROOTS[@]}"; do
            cleanup_chroot "${mountpoint}" || true
        done
    fi

    echo "Exporting all zpools..."
    zfs umount -a || true
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

___ "Create a key file"
create_key_file() {
  local key_file
  key_file="${1:-"$(echo "" | create_temp_file)"}"

  mkdir -p "$(dirname "${key_file}")"
  touch "${key_file}"
  chmod 400 "${key_file}"
  cat > "${key_file}"
  chattr +i "${key_file}" || echo "Warning: Could not set immutable flag on ${key_file}" >&2
  echo "${key_file}"
}

generate_passphrase() {
    head -c 32 /dev/urandom | base64
}

___ "Get option arguments for all settable ZFS properties for a dataset"
get_settable_properties_options_arguments() {
    local dataset
    local -a except_keys=()
    local -a result=()

    dataset="${1}"
    except_keys=("${@:2}")

    ___ "Get all properties that are:"
    ___ " - not default (source != 'default')"
    ___ " - not inherited (source does not start with 'inherited')"
    ___ " - not read-only (source != '-')"
    ___ " - have a value set (value != '-')"
    while IFS=$'\t' read -r name value source; do
        if [[ "${source}" == "default" ]]; then
            echo "Skipping property ${name} with value ${value} and source ${source}, because it is default." >&2
            continue
        fi
        if [[ "${source}" =~ ^inherited ]]; then
            echo "Skipping property ${name} with value ${value} and source ${source}, because it is inherited." >&2
            continue
        fi
        if [[ "${except_keys[*]}" =~ "${name}" ]]; then
            echo "Skipping property ${name} with value ${value} and source ${source}, because it is explicitly excluded." >&2
            continue
        fi
        if [[ "${source}" == "-" ]]; then
            echo "Skipping property ${name} with value ${value} and source ${source}, because it is read-only." >&2
            continue
        fi
        if [[ "${value}" == "-" ]]; then
            echo "Skipping property ${name} with value ${value} and source ${source}, because it has no value." >&2
            continue
        fi
        echo "Adding property ${name} with value ${value} (source ${source}) to list of settable properties arguments." >&2
        result+=("-o" "${name}=${value}")
    done < "$(zfs get -pH -o property,value,source all "${dataset}" | create_temp_file)"

    if ((${#result[@]} > 0)); then
        echo "${result[@]}"
    else
        echo ""
    fi
}

setup_chroot() {
    local mountpoint
    mountpoint="${1}"
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
    local mountpoint
    mountpoint="${1}"
    local mounts=(dev sys proc)

    for mount in "${mounts[@]}"; do
        umount --recursive "${mountpoint}/${mount}" 2>/dev/null || true
    done

    ___ "Remove from global tracking array"
    local -a new_mounted_chroots=()
    for dir in "${MOUNTED_CHROOTS[@]}"; do
        [[ "${dir}" != "${mountpoint}" ]] && new_mounted_chroots+=("${dir}")
    done
    MOUNTED_CHROOTS=("${new_mounted_chroots[@]}")
}

create_unlock_service() {
    local mountpoint
    mountpoint="${1}"
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
    local pool
    pool="${1}"

    zfs list -H -o name,mountpoint | awk '$2 == "'"${TEMP_ROOT_MOUNT}"'" {print $1}'
}

___ "Find the encryption root dataset"
find_encryption_root() {
    local dataset
    dataset="${1}"

    local encroot
    encroot="$(zfs get -H -o value encryptionroot "${dataset}")"

    if [[ "${encroot}" == "-" ]]; then
        echo ""
    else
        echo "${encroot}"
    fi
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
    local -a pools=()
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

    # NOTE: we imported the pool with -R "${TEMP_ROOT_MOUNT}" so all datasets' mountpoints are under "${TEMP_ROOT_MOUNT}"
    # DONE: collect each first-level dataset in the pool.
    # DONE: find the dataset that has mountpoint="${TEMP_ROOT_MOUNT}". this is the root filesystem dataset, typically rpool/ROOT/pve-1. save it in a variable named "root_fs_dataset"
    # DONE: find the first level dataset that the root filesystem dataset belongs to, or is. typically rpool/ROOT. save it in a variable named "root_fs_dataset_first_level"
    # DONE: encrypt_dataset "${root_fs_dataset_first_level}"
    # DONE: zfs mount "${root_fs_dataset}"
    # DONE: CONFIGURED_KEY_FILE="/.zfs-encryption.key"
    # DONE: CURRENT_KEY_FILE="${TEMP_ROOT_MOUNT}/${CONFIGURED_KEY_FILE}"
    # DONE: create_key_file "${CURRENT_KEY_FILE}"
    # DONE: set encryption properties on the pool itself, that all current and future datasets will inherit, except "${root_fs_dataset_first_level}" which has its own encryption properties. zfs set -O encryption=aes-256-gcm -O keyformat=passphrase -O keylocation="file://${CURRENT_KEY_FILE}" "${selected_pool}"
    # DONE: for each first-level dataset (except "${root_fs_dataset_first_level}", which is already encrypted): encrypt_dataset_or_load_key "file" "${dataset}"
    # DONE: zfs set -u keylocation="${CONFIGURED_KEY_FILE}" "${selected_pool}"

    ___ "Collect first-level datasets"
    local -a first_level_datasets=()
    mapfile -t first_level_datasets < "$(list_first_level_datasets "${selected_pool}" | create_temp_file)"

    ___ "Find root filesystem dataset"
    local root_fs_dataset
    root_fs_dataset="$(find_root_filesystem "${selected_pool}")"

    if [[ -z "${root_fs_dataset}" ]]; then
        ___ "Root filesystem dataset not found, we have no place to store keys"
        echo "Root filesystem dataset not found. Cannot proceed."
        exit 1
    fi
    echo "Found root filesystem dataset: ${root_fs_dataset}"

    ___ "Find the root filesystem dataset's first-level dataset"
    local root_fs_dataset_first_level
    root_fs_dataset_first_level="$(find_root_fs_dataset_first_level "${root_fs_dataset}" "${first_level_datasets[@]}")"

    if [[ -z "${root_fs_dataset_first_level}" ]]; then
        echo "Root filesystem's first-level dataset not found. Cannot proceed."
        exit 1
    fi
    echo "Found root filesystem's first-level dataset: ${root_fs_dataset_first_level}"

    ___ "Encrypt ${root_fs_dataset_first_level} with -o keylocation=prompt"
    encrypt_dataset_or_load_key "prompt" "${root_fs_dataset_first_level}"

    local -a root_fs_dataset_and_ancestors_with_oldest_first_except_first_level=()
    mapfile -t root_fs_dataset_and_ancestors_with_oldest_first_except_first_level < "$(get_root_fs_dataset_and_ancestors_with_oldest_first_except_first_level "${root_fs_dataset_first_level}" "${root_fs_dataset}" | create_temp_file)"

    ___ "Encrypt the rest of the ${root_fs_dataset_and_ancestors_with_oldest_first_except_first_level[*]} datasets with inherited encryption properties"
    for dataset in "${root_fs_dataset_and_ancestors_with_oldest_first_except_first_level[@]}"; do
        encrypt_dataset_or_load_key "inherit" "${dataset}"
    done

    ___ "Find all remaining unencrypted datasets in the selected pool"
    local -a unencrypted_datasets=()
    mapfile -t unencrypted_datasets < "$(zfs list -H -o name,encryption,keystatus \
        -t filesystem -s name -r "${selected_pool}" | \
        awk '($2 == "off" || ($2 != "off" && $3 == "none")) {print $1}' | \
        create_temp_file)"

    if [[ ${#unencrypted_datasets[@]} -eq 0 ]]; then
        echo "No (more) unencrypted datasets found in ${selected_pool}. Done."
        exit 0
    fi

    echo "Found ${#unencrypted_datasets[@]} unencrypted datasets."

    ___ "Create ${CURRENT_KEY_FILE}, unless already exists and is not empty"
    zfs mount "${root_fs_dataset}"
    if [[ -s "${CURRENT_KEY_FILE}" ]]; then
        echo "Key file ${CURRENT_KEY_FILE} already exists and is not empty. Skipping creation." >&2
    else
        echo "Creating key file ${CURRENT_KEY_FILE}" >&2
        generate_passphrase | create_key_file "${CURRENT_KEY_FILE}"
    fi

    ___ "Set encryption properties on the pool itself, that all current and future datasets will inherit, except ${root_fs_dataset_first_level} which has its own encryption properties"
    zfs set -O encryption=aes-256-gcm -O keyformat=passphrase -O keylocation="file://${CURRENT_KEY_FILE}" "${selected_pool}"

    ___ "Process each unencrypted dataset"
    for dataset in "${unencrypted_datasets[@]}"; do
        if ! encrypt_dataset_or_load_key "file" "${dataset}"; then
            echo "Failed to encrypt ${dataset}. Continuing with remaining datasets..."
            continue
        fi
    done

    ___ "Set correct keylocation for after boot"
    zfs set -u -O keylocation="file://${CONFIGURED_KEY_FILE}" "${selected_pool}"

    ___ "Create and enable systemd unlock service if we encrypted anything"
    if ((ENCRYPTION_COUNT > 0)); then
        if [[ -d "${TEMP_ROOT_MOUNT}" ]]; then
            echo "Creating systemd unlock service..."
            create_unlock_service "${TEMP_ROOT_MOUNT}"
        fi

        echo "Successfully encrypted ${ENCRYPTION_COUNT} datasets!"
        echo "IMPORTANT: You will find the encryption key for non-root datasets in ${CONFIGURED_KEY_FILE}, after boot."
        echo "Make sure to back it up to a secure location for recovery purposes."
    else
        echo "No datasets were encrypted successfully."
    fi

    echo "Exiting..."
}

encrypt_dataset_or_load_key() {
      local encryption_type
      local dataset
      local encrypted_dataset
      local snapshot
      local temp_mountpoint
      local final_mountpoint
      local -a dataset_option_arguments=()

      encryption_type="${1}"
      dataset="${2}"
      encrypted_dataset="${dataset}_encrypted"
      snapshot="${dataset}@pre_encryption_$(date +%Y%m%d_%H%M%S)"
      temp_mountpoint="$(get_temp_mountpoint "${dataset}")"

      if [[ "${temp_mountpoint}" == "${TEMP_ROOT_MOUNT}" ]]; then
          final_mountpoint="/"
      else
          final_mountpoint="${temp_mountpoint#"${TEMP_ROOT_MOUNT}"}"
      fi

      if [[ "${encryption_type}" == "file" ]]; then
          dataset_option_arguments+=("-o" "encryption=aes-256-gcm")
          dataset_option_arguments+=("-o" "keyformat=passphrase")
          dataset_option_arguments+=("-o" "keylocation=file://${CONFIGURED_KEY_FILE}")
      elif [[ "${encryption_type}" == "prompt" ]]; then
          local temp_key_file
          temp_key_file="$(generate_passphrase | create_key_file)"
          dataset_option_arguments+=("-o" "encryption=aes-256-gcm")
          dataset_option_arguments+=("-o" "keyformat=passphrase")
          dataset_option_arguments+=("-o" "keylocation=file://${temp_key_file}")
      elif [[ "${encryption_type}" == "inherit" ]]; then
          : # nothing to do, just inherit
      else
          echo "Unknown encryption type: ${encryption_type}" >&2
          exit 1
      fi

      ___ "Take snapshot of ${dataset}"
      zfs snapshot -r "${snapshot}"

      ___ "Encrypt ${dataset}"
      echo "Encrypting dataset: ${dataset}"

      ___ "Transfer data"
      echo "Transferring data from ${snapshot} to ${encrypted_dataset}"
      if ! zfs send -R "${snapshot}" | zfs receive -u "${dataset_option_arguments[@]}" "${encrypted_dataset}"; then
          echo "Failed to transfer data to ${encrypted_dataset}"
          zfs destroy -r "${snapshot}"
          zfs destroy -r "${encrypted_dataset}"
          exit 1
      fi
      zfs set -u mountpoint="${final_mountpoint}" "${encrypted_dataset}"
      ((ENCRYPTION_COUNT+=1))

      ___ "Have the user choose a new encryption passphrase"
      if [[ "${encryption_type}" == "prompt" ]]; then
          until zfs change-key -o keylocation="prompt" "${encrypted_dataset}"; do
              echo "Failed to change encryption passphrase on ${encrypted_dataset}. Try again. When you succeed, it will replace ${dataset}." >&2
              sleep 1
          done
      fi

      ___ "Clean up original dataset and snapshot"
      zfs destroy -r "${snapshot}"
      zfs destroy -r "${dataset}"

      ___ "Rename encrypted dataset"
      zfs rename "${encrypted_dataset}" "${dataset}"

}

list_first_level_datasets() {
    local pool="${1}"
    zfs list -H -o name -d 1 "${pool}" | grep -v "^${pool}$"
}

find_root_fs_dataset_first_level() {
    local root_fs_dataset="${1}"
    shift
    local -a first_level_datasets=("$@")

    for dataset in "${first_level_datasets[@]}"; do
        if [[ "${root_fs_dataset}" == "${dataset}" || "${root_fs_dataset}" =~ ^"${dataset}"/ ]]; then
            echo "${dataset}"
            return 0
        fi
    done
    return 1
}

get_root_fs_dataset_and_ancestors_with_oldest_first_except_first_level() {
    local root_fs_dataset_first_level="${1}"
    local root_fs_dataset="${2}"
    local current
    local -a ancestors=()

    if [[ -z "${root_fs_dataset_first_level}" ]]; then
        echo "ERROR: root_fs_dataset_first_level must be supplied as first argument" >&2
        return 1
    fi
    if [[ -z "${root_fs_dataset}" ]]; then
        echo "ERROR: root_fs_dataset must be supplied as second argument" >&2
        return 1
    fi

    current="${root_fs_dataset}"
    while [[ "${current}" != "${root_fs_dataset_first_level}" ]]; do
        ancestors+=("${current}")
        current="${current%/*}"
    done

    # Print in reverse order (oldest first)
    for ((i=${#ancestors[@]}-1; i>=0; i--)); do
        echo "${ancestors[i]}"
    done
}

get_temp_mountpoint() {
    local dataset
    local current_mountpoint

    dataset="${1}"
    current_mountpoint="$(zfs get -H -o value mountpoint "${dataset}")"

    if [[ "${current_mountpoint}" == "${TEMP_ROOT_MOUNT}" ]]; then
        echo "/"
    else
        echo "${current_mountpoint#"${TEMP_ROOT_MOUNT}"}"
    fi
}

main "$@"
