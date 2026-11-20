// Рівень 3: геопросторові індекси (2dsphere) та TTL-індекс
load("scripts/00_common.js");
db.libraries.drop();
// Навчальні (наближені) координати центрів міст. GeoJSON: [довгота, широта]
db.libraries.insertMany([
  { name: "Центральна бібліотека, Луцьк", city: "Луцьк", location: { type: "Point", coordinates: [25.3254, 50.7472] }, books_total: 120000 },
  { name: "Міська бібліотека, Ковель", city: "Ковель", location: { type: "Point", coordinates: [24.7197, 51.2174] }, books_total: 45000 },
  { name: "Центральна бібліотека, Рівне", city: "Рівне", location: { type: "Point", coordinates: [26.2516, 50.6199] }, books_total: 98000 },
  { name: "Центральна бібліотека, Львів", city: "Львів", location: { type: "Point", coordinates: [24.0297, 49.8397] }, books_total: 310000 },
  { name: "Національна бібліотека, Київ", city: "Київ", location: { type: "Point", coordinates: [30.5234, 50.4501] }, books_total: 900000 },
  { name: "Центральна бібліотека, Харків", city: "Харків", location: { type: "Point", coordinates: [36.2304, 49.9935] }, books_total: 420000 },
  { name: "Центральна бібліотека, Одеса", city: "Одеса", location: { type: "Point", coordinates: [30.7233, 46.4825] }, books_total: 380000 },
  { name: "Центральна бібліотека, Дніпро", city: "Дніпро", location: { type: "Point", coordinates: [35.0462, 48.4647] }, books_total: 275000 }
]);
show("2dsphere-індекс", db.libraries.createIndex({ location: "2dsphere" }));
const lutsk = { type: "Point", coordinates: [25.3254, 50.7472] };
show("$near: найближчі до Луцька, ≤ 150 км", db.libraries.find({ location: { $near: { $geometry: lutsk, $maxDistance: 150000 } } }, { name: 1, _id: 0 }).toArray());
show("$geoNear (aggregation): відстань у км", db.libraries.aggregate([
  { $geoNear: { near: lutsk, distanceField: "dist_m", spherical: true } },
  { $project: { _id: 0, city: 1, dist_km: { $round: [{ $divide: ["$dist_m", 1000] }, 0] } } }, { $limit: 5 }]).toArray());
show("$geoWithin $centerSphere: радіус 200 км від Луцька", db.libraries.find({ location: { $geoWithin: { $centerSphere: [lutsk.coordinates, 200 / 6378.1] } } }, { city: 1, _id: 0 }).toArray());
show("$geoWithin $geometry Polygon (прямокутник «захід України»)", db.libraries.find({ location: { $geoWithin: { $geometry: { type: "Polygon", coordinates: [[[22, 48], [27, 48], [27, 52], [22, 52], [22, 48]]] } } } }, { city: 1, _id: 0 }).toArray());
show("explain $near (використання 2dsphere)", plan(db.libraries.find({ location: { $near: { $geometry: lutsk, $maxDistance: 150000 } } })));

print("\n===== TTL-індекс =====");
db.sessions.drop(); db.sessions_ttl_demo.drop();
show("Робочий TTL: сесії живуть 1 год", db.sessions.createIndex({ created_at: 1 }, { expireAfterSeconds: 3600 }));
show("Демо-TTL: 5 с", db.sessions_ttl_demo.createIndex({ created_at: 1 }, { expireAfterSeconds: 5 }));
db.sessions_ttl_demo.insertMany([{ user: "ivan_petrov", created_at: new Date() }, { user: "maria_kovalenko", created_at: new Date() }]);
show("Документів одразу після вставки", db.sessions_ttl_demo.countDocuments());
print("Чекаємо 75 с (фонова задача TTL запускається раз на 60 с)...");
sleep(75000);
show("Документів після очікування", db.sessions_ttl_demo.countDocuments());
db.sessions_ttl_demo.drop();
