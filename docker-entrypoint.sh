#!/bin/sh
set -e

git config --global --add safe.directory /workspace >/dev/null 2>&1 || true

if [ -n "${GIT_USER_NAME:-}" ]; then
  git config --global user.name "$GIT_USER_NAME"
fi

if [ -n "${GIT_USER_EMAIL:-}" ]; then
  git config --global user.email "$GIT_USER_EMAIL"
fi

exec "$@"
