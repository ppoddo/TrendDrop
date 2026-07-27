#!/bin/bash
# launchd에서 매시간 호출되는 래퍼. (com.trendcollector.sources)
# launchd는 최소 PATH로 실행되므로 nvm node 경로를 직접 주입해야 npm/tsx가 잡힌다.
# node 버전을 올리면 아래 경로도 같이 갱신할 것.
set -euo pipefail

export PATH="/Users/yang/.nvm/versions/node/v22.12.0/bin:$PATH"
PROJECT_DIR="/Users/yang/trend-collector"
cd "$PROJECT_DIR"

mkdir -p logs
STAMP="$(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "===== run-sources start $STAMP =====" >> logs/cron.log
npm run sources >> logs/cron.log 2>&1
echo "===== run-sources end   $(date '+%Y-%m-%d %H:%M:%S %Z') =====" >> logs/cron.log
