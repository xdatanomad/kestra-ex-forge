# Forge demo. Everything runs locally in Docker.
KESTRA = docker compose -p forge-kestra -f kestra/docker-compose.yml --env-file .env
DEMO   = docker compose -p forge --env-file .env

.PHONY: help up down reset status logs clean keys net

help:
	@echo "make up      start Kestra 2.0 + Forge portal, deploy flows/apps (first run takes a few minutes)"
	@echo "make reset   wipe all servers and tickets (Kestra flows stay)"
	@echo "make down    stop everything (data kept)"
	@echo "make clean   stop everything and DELETE all data"

.env:
	@test -f .env || (echo "Create .env from .env.example first"; exit 1)

keys:
	@mkdir -p .keys && test -f .keys/forge_ed25519 || ssh-keygen -q -t ed25519 -N "" -C forge-demo -f .keys/forge_ed25519

net:
	@docker network inspect forge-net >/dev/null 2>&1 || docker network create forge-net

up: .env keys net
	docker build -q -t forge-node ./node
	$(KESTRA) up -d
	$(DEMO) up -d --build
	@scripts/bootstrap.sh

reset:
	@curl -fsS -X POST localhost:8000/api/reset >/dev/null && echo "forge reset"

status:
	@docker ps --filter network=forge-net --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

logs:
	@docker logs -f forge-app

down:
	-$(DEMO) down
	-$(KESTRA) down

clean:
	-@docker ps -aq --filter label=forge.node=true | xargs -r docker rm -f
	-$(DEMO) down -v
	-$(KESTRA) down -v
