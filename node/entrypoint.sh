#!/bin/sh
# Installs the demo public key (passed by the provisioning API) and starts sshd.
echo "$AUTHORIZED_KEY" > /root/.ssh/authorized_keys
chmod 700 /root/.ssh && chmod 600 /root/.ssh/authorized_keys
exec /usr/sbin/sshd -D -e
