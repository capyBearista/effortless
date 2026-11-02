#!/usr/bin/env bash
# Runs effortless's tests.
set -euo pipefail
cd "$(dirname "$0")/.."
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test .
