proxmox-fetch-answer http | tee /run/automatic-installer-answers


until ping -c1 -W1 1.1.1.1; do dhclient -4 "$(ip l|grep enp8|cut -d: -f2|tr -d ' '|sort -V|head -n1)"; done
wget -O encrypt-zpool.sh https://raw.githubusercontent.com/hugojosefson/proxmox-root-on-encrypted-zfs/encrypt-zpool/encrypt-zpool.sh && chmod +x encrypt-zpool.sh && bash -x ./encrypt-zpool.sh 2>&1 | tee encrypt-zpool.log
