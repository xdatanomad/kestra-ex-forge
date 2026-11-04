# A tiny "server": sshd + python3, so Ansible can manage it exactly like a real VM.
FROM debian:bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssh-server python3 ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /run/sshd /root/.ssh /opt/forge/packages \
 && sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/;s/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
COPY entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
