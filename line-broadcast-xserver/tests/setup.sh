#!/bin/bash
# 結合テスト用の環境を起動する（MariaDB が起動済みであること）。
# install.php は実行後に自分自身を削除するため、プロジェクトを /tmp/lhrun にコピーして動かす。
set -e
SRC="$(cd "$(dirname "$0")/.." && pwd)"
RUN=/tmp/lhrun
pkill -f "[p]hp -S 127.0.0.1:8080" 2>/dev/null || true
pkill -f "[p]hp -S 127.0.0.1:9001" 2>/dev/null || true
rm -rf "$RUN" && mkdir -p "$RUN"
(cd "$SRC" && tar --exclude=.git --exclude=build/node_modules -cf - .) | tar -C "$RUN" -xf -
rm -f "$RUN/app/config.php" "$RUN/tests/mock_line.log"
mysql -uroot -e "DROP DATABASE IF EXISTS linehub; CREATE DATABASE linehub CHARACTER SET utf8mb4; CREATE USER IF NOT EXISTS 'lh'@'localhost' IDENTIFIED BY 'lhpass'; GRANT ALL ON linehub.* TO 'lh'@'localhost';"
(cd "$RUN" && php -S 127.0.0.1:9001 tests/mock_line.php >/tmp/mock.log 2>&1 &)
(cd "$RUN" && php -S 127.0.0.1:8080 -t public tests/router.php >/tmp/app.log 2>&1 &)
sleep 1
echo "started: $RUN"
