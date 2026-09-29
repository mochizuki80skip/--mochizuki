#!/bin/sh
# 予約投稿の送信（5 分おき）と週次の分析（月曜 8 時台に 1 回）
last_week=""
while true; do
  curl -s -m 280 -H "Authorization: Bearer ${CRON_SECRET}" http://app:3000/api/cron/dispatch > /dev/null
  week=$(date +%G-%V)
  if [ "$(date +%u%H)" = "108" ] && [ "$week" != "$last_week" ]; then
    curl -s -m 600 -H "Authorization: Bearer ${CRON_SECRET}" http://app:3000/api/cron/analyze > /dev/null && last_week=$week
  fi
  sleep 300
done
