#!/bin/bash
# Starts postgres + redis only (lightweight, no GPU needed)
# Run from project root: bash scripts/start_dev.sh

docker compose -f infra/docker/docker-compose.dev.yml up postgres redis -d
echo "Postgres on :5432, Redis on :6379"
