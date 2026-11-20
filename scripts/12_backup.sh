#!/usr/bin/env bash
# Рівень 3: автоматизоване резервне копіювання MongoDB (mongodump).
# Змінні: MONGO_URI, MONGO_DB, BACKUP_DIR, KEEP_DAYS, MONGODUMP
# Cron (щодня о 02:30):  30 2 * * *  /шлях/до/scripts/12_backup.sh >> /var/log/mongo_backup.log 2>&1
set -euo pipefail
MONGODUMP=${MONGODUMP:-mongodump}
URI=${MONGO_URI:-mongodb://127.0.0.1:27017}
DB=${MONGO_DB:-library}
DIR=${BACKUP_DIR:-./backups}
KEEP_DAYS=${KEEP_DAYS:-7}
mkdir -p "$DIR"
STAMP=$(date +%Y%m%d_%H%M%S)
FILE="$DIR/${DB}_${STAMP}.archive.gz"
echo "[$(date '+%F %T')] backup start: db=$DB -> $FILE"
"$MONGODUMP" --uri "$URI" --db "$DB" --gzip --archive="$FILE" --excludeCollection=books_perf 2>&1 | tail -n 3
if [ ! -s "$FILE" ]; then echo "ПОМИЛКА: порожній архів" >&2; exit 1; fi
( cd "$DIR" && sha256sum "$(basename "$FILE")" > "$(basename "$FILE").sha256" )
echo "[$(date '+%F %T')] backup ok: $(du -h "$FILE" | cut -f1), sha256 збережено"
# Ротація: видаляємо архіви старші за KEEP_DAYS днів
find "$DIR" -name "${DB}_*.archive.gz*" -type f -mtime +"$KEEP_DAYS" -print -delete | sed 's/^/видалено старий: /' || true
