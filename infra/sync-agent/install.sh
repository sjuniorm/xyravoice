#!/usr/bin/env bash
# Install xyra-sync as a systemd service on the VPS host.
# Run as root: sudo bash install.sh
set -euo pipefail

REPO_DIR="/opt/xyravoice"
AGENT_DIR="$REPO_DIR/infra/sync-agent"
SECRETS_FILE="$AGENT_DIR/secrets.env"

if [[ $EUID -ne 0 ]]; then
  echo "Must be run as root (sudo bash install.sh)"
  exit 1
fi

echo "→ Installing python deps"
apt-get update -qq
apt-get install -y -qq python3-psycopg2 >/dev/null

if [[ ! -f "$SECRETS_FILE" ]]; then
  cat <<EOF
ERROR: $SECRETS_FILE not found.
Create it with:
  SYNC_DB_URL=postgres://asterisk_ro.<project>:<pwd>@aws-X-eu-west-X.pooler.supabase.com:6543/postgres?sslmode=require
EOF
  exit 1
fi

echo "→ Installing systemd unit"
cat > /etc/systemd/system/xyra-sync.service <<UNIT
[Unit]
Description=Xyra Voice — Asterisk sync agent
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=$SECRETS_FILE
Environment=SYNC_OUTPUT_DIR=$REPO_DIR/infra/asterisk/etc/generated
Environment=SYNC_ASTERISK_CTNR=xyra-asterisk
Environment=SYNC_INTERVAL=30
ExecStart=/usr/bin/python3 $AGENT_DIR/sync.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable xyra-sync.service
systemctl restart xyra-sync.service

echo "→ Done. Tail logs with: journalctl -u xyra-sync -f"
