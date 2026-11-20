#!/usr/bin/env bash
# Послідовно виконує всі скрипти лабораторної; результати — у output/
# Вимоги: запущений mongod як replica set з одним/трьома вузлами (див. README), mongosh у PATH.
set -euo pipefail
cd "$(dirname "$0")"; mkdir -p output
for s in 01_setup 02_seed 03_crud 04_indexes 05_level2 06_validation 07_geo_ttl 08_versioning 09_ukrainian_search 10_compare; do
  echo ">>> $s"; mongosh --quiet --file scripts/$s.js > output/$s.txt 2>&1
done
echo ">>> 11_replication"; ./scripts/11_replication.sh > output/11_replication.txt 2>&1
echo ">>> 12_backup";      BACKUP_DIR=./backups ./scripts/12_backup.sh > output/12_backup.txt 2>&1
echo ">>> 13_restore (у library_restore)"
./scripts/13_restore.sh "$(ls -t backups/*.archive.gz | head -1)" library_restore > output/13_restore.txt 2>&1
mongosh --quiet --eval 'const a=db.getSiblingDB("library"), b=db.getSiblingDB("library_restore"); printjson(["books","authors","users","books_history","libraries"].map(c=>c+": "+a[c].countDocuments()+" / "+b[c].countDocuments())); printjson(b.getCollectionInfos().map(c=>c.name+" ["+c.type+"]").sort()); b.dropDatabase()' >> output/13_restore.txt 2>&1
echo "готово"
