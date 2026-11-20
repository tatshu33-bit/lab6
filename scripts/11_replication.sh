#!/usr/bin/env bash
# Рівень 3: реплікація — replica set з 3 вузлів на одній машині (порти 27017-27019).
# Для запуску потрібні mongod і mongosh у PATH (або змінні MONGOD / MONGOSH).
set -euo pipefail
MONGOD=${MONGOD:-mongod}; MONGOSH=${MONGOSH:-mongosh}
BASE=${RS_DIR:-/tmp/mdb}; RS=rs0; PORTS=(27017 27018 27019)
mkdir -p "$BASE/log"
for p in "${PORTS[@]}"; do
  if ! "$MONGOSH" --quiet --port "$p" --eval 'db.runCommand({ping:1}).ok' >/dev/null 2>&1; then
    mkdir -p "$BASE/data$p"
    "$MONGOD" --dbpath "$BASE/data$p" --port "$p" --bind_ip 127.0.0.1 --replSet "$RS" --fork --logpath "$BASE/log/m$p.log" >/dev/null
    echo "запущено вузол на порту $p"
  fi
done
sleep 2
"$MONGOSH" --quiet --port 27017 --eval '
  let cfg; try { cfg = rs.conf(); } catch (e) { cfg = null; }
  if (!cfg) { printjson(rs.initiate({ _id: "rs0", members: [27017, 27018, 27019].map((p, i) => ({ _id: i, host: "127.0.0.1:" + p })) }).ok); sleep(8000); }
  else { const have = cfg.members.map(m => m.host); [27018, 27019].forEach(p => { if (!have.includes("127.0.0.1:" + p)) { print("rs.add " + p); rs.add("127.0.0.1:" + p); sleep(3000); } }); }
'
sleep 8
URI="mongodb://127.0.0.1:27017,127.0.0.1:27018,127.0.0.1:27019/?replicaSet=$RS"
"$MONGOSH" --quiet "$URI" --eval '
  const st = () => rs.status().members.map(m => m.name + " " + m.stateStr + (m.stateStr === "SECONDARY" ? " (відставання " + Math.round((rs.status().members.find(x => x.stateStr==="PRIMARY").optimeDate - m.optimeDate)/1000) + " с)" : ""));
  print("\n// Стан replica set"); printjson(st());
  const lib = db.getSiblingDB("library");
  print("\n// Запис з writeConcern {w: \"majority\"}");
  printjson(lib.replication_test.insertOne({ msg: "hello", at: new Date() }, { writeConcern: { w: "majority", wtimeout: 5000 } }).acknowledged);
  print("\n// Читання з вторинних вузлів (readPreference: secondary)");
  [27018, 27019].forEach(p => { const c = new Mongo("mongodb://127.0.0.1:" + p + "/?directConnection=true"); c.setReadPref("secondary");
    print("порт " + p + ": books=" + c.getDB("library").books.countDocuments() + ", replication_test=" + c.getDB("library").replication_test.countDocuments()); });
  print("\n// Запис на вторинному вузлі заборонено");
  try { new Mongo("mongodb://127.0.0.1:27018/?directConnection=true").getDB("library").x.insertOne({a:1}); } catch (e) { print(e.codeName); }
  print("\n// Відмовостійкість: step down поточного primary");
  const oldP = rs.status().members.find(m => m.stateStr === "PRIMARY").name; print("було PRIMARY: " + oldP);
  try { db.adminCommand({ replSetStepDown: 30, force: true }); } catch (e) { } print("команду replSetStepDown виконано");
' || true
sleep 12
"$MONGOSH" --quiet "$URI" --eval '
  print("стало PRIMARY: " + rs.status().members.find(m => m.stateStr === "PRIMARY").name);
  const lib = db.getSiblingDB("library");
  print("запис після перемикання: " + lib.replication_test.insertOne({ msg: "after failover" }, { writeConcern: { w: "majority" } }).acknowledged);
  print("документів у replication_test: " + lib.replication_test.countDocuments());
' || true
# повертаємо primary на порт 27017, щоб наступні скрипти працювали без replicaSet у URI
sleep 31
"$MONGOSH" --quiet --port 27017 --eval 'try { db.adminCommand({ replSetStepUp: 1 }); } catch (e) {} ' >/dev/null 2>&1 || true
sleep 6
"$MONGOSH" --quiet "$URI" --eval 'print("\n// Підсумковий стан"); printjson(rs.status().members.map(m => m.name + " " + m.stateStr)); db.getSiblingDB("library").replication_test.drop();'
