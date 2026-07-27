#!/bin/bash
# launchd가 매시간 이 스크립트를 실행해 v-he 파이프라인을 수집한다.
# 로컬 dev 서버(npm run dev, http://localhost:3000)가 떠 있어야 동작한다.
set -uo pipefail

PROJECT_DIR="/Users/songhaeun/Desktop/dev/TrendDrop"
LOG_FILE="$PROJECT_DIR/logs/pipeline-v-he.log"
APP_URL="${NEXT_PUBLIC_APP_URL:-http://localhost:3000}"

mkdir -p "$PROJECT_DIR/logs"

echo "==== $(date '+%Y-%m-%d %H:%M:%S') 실행 시작 ====" >> "$LOG_FILE"

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$APP_URL/api/admin/collect/pipeline-v-he" \
  -H "Content-Type: application/json" \
  -d '{"geo":"KR","limit":15}')

echo "$RESPONSE" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"
