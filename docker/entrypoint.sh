#!/bin/sh
set -e

echo "==> Running database migrations"
pnpm db:migrate

echo "==> Starting PRereq app"
exec ./node_modules/.bin/probot run ./dist/src/app.js
