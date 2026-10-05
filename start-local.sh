#!/bin/bash
# val - local only mode. run this, then open http://localhost:10000/val
cd "$(dirname "$0")"
export CREDS_KEY="${CREDS_KEY:-local-dev-key-change-me-12345}"
echo "starting val locally..."
echo "open http://localhost:10000/val in your browser"
node api/server.js
