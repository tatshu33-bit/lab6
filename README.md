# ЛР №6. MongoDB: база даних `library` (рівні 1–3)

## Запуск
Потрібно: `mongod` 8.x, `mongosh`, MongoDB Database Tools (`mongodump`, `mongorestore`).

```bash
# mongod має працювати як replica set (потрібно для транзакцій у скрипті версіонування)
mongod --dbpath ./data --replSet rs0 --fork --logpath ./mongod.log
mongosh --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27017"}]})'
./run_all.sh          # виконує всі скрипти, результати — в output/
```
Або по одному: `mongosh --quiet --file scripts/03_crud.js` (запускати з кореня проєкту).
Скрипти 11–13 запускають ще два вузли реплікації й роблять/відновлюють бекап; шляхи до бінарників задаються змінними `MONGOD`, `MONGODUMP`, `MONGORESTORE`.

## Структура
| Файл | Рівень | Зміст |
|---|---|---|
| `scripts/01_setup.js`, `02_seed.js` | 1 | БД, колекції, валідатор, по 10 документів |
| `scripts/03_crud.js` | 1 | вставка / пошук / оновлення / видалення |
| `scripts/04_indexes.js` | 1 | 3 індекси, порівняння швидкості (10 і 200 000 документів) |
| `scripts/05_level2.js` | 2 | `$and/$or/$in/$regex`, агрегації, compound-індекси, `text`, `$lookup`, view |
| `scripts/06_validation.js` | 3 | JSON Schema, тести відхилення |
| `scripts/07_geo_ttl.js` | 3 | `2dsphere`, TTL |
| `scripts/08_versioning.js` | 3 | історія змін (транзакції, відкат, diff) |
| `scripts/09_ukrainian_search.js` | 3 | повнотекстовий пошук для української |
| `scripts/10_compare.js` | 3 | вбудовані документи vs посилання (виміри) |
| `scripts/11_replication.sh` | 3 | replica set із 3 вузлів, failover |
| `scripts/12_backup.sh`, `13_restore.sh` | 3 | резервне копіювання з ротацією, відновлення |
| `output/` | | фактичний вивід кожного скрипта |
| `report.md` | | звіт |
