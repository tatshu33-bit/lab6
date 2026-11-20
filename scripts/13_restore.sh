#!/usr/bin/env bash
# Відновлення з архіву: ./13_restore.sh <архів> [цільова_БД]   (за замовчуванням — у ту саму БД з --drop)
set -euo pipefail
MONGORESTORE=${MONGORESTORE:-mongorestore}
URI=${MONGO_URI:-mongodb://127.0.0.1:27017}
SRC_DB=${MONGO_DB:-library}
FILE=${1:?Вкажіть архів}; TARGET=${2:-$SRC_DB}
( cd "$(dirname "$FILE")" && sha256sum -c "$(basename "$FILE").sha256" )   # перевірка цілісності
if [ "$TARGET" = "$SRC_DB" ]; then
  "$MONGORESTORE" --uri "$URI" --gzip --archive="$FILE" --nsInclude "$SRC_DB.*" --drop
else
  "$MONGORESTORE" --uri "$URI" --gzip --archive="$FILE" --nsInclude "$SRC_DB.*" --nsFrom "$SRC_DB.*" --nsTo "$TARGET.*"
fi
