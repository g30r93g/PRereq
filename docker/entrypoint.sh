#!/bin/sh
set -e

echo "==> Running database migrations"
pnpm db:migrate

echo "==> Starting PRereq app"
exec node --enable-source-maps dist/app.js
