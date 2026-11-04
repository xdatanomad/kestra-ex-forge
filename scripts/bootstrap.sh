#!/usr/bin/env bash
# Waits for Kestra, then stores secrets, uploads playbooks and deploys flows + apps. Safe to re-run.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Waiting for Kestra..."
for i in $(seq 1 120); do
  python3 -c "
import sys; sys.path.insert(0,'scripts'); import kapi
sys.exit(0 if kapi.call('GET','/api/v1/configs')[0]==200 else 1)" 2>/dev/null && break
  sleep 3
done

docker pull -q cytopia/ansible:latest-tools >/dev/null
docker pull -q python:3.12-slim >/dev/null
python3 scripts/kapi.py secret-value forge FORGE_SSH_KEY .keys/forge_ed25519
python3 scripts/kapi.py secret forge KESTRA_API_USER KESTRA_BASIC_AUTH_USERNAME
python3 scripts/kapi.py secret forge KESTRA_API_PASSWORD KESTRA_BASIC_AUTH_PASSWORD
python3 scripts/kapi.py secret forge GEMINI_API_KEY KESTRA_GEMINI_API_KEY || true
python3 scripts/kapi.py files forge
python3 scripts/kapi.py deploy
python3 scripts/kapi.py apps
echo "Ready: portal http://localhost:8000  |  Kestra http://localhost:8080"
