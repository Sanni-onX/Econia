#!/bin/sh
set -eu
# Railway mounts its persistent volume before this entrypoint runs.
mkdir -p /app/.data
chown node:node /app/.data
exec su-exec node "$@"
