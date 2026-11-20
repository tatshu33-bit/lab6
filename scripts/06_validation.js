// Рівень 3: валідація схеми (JSON Schema) через collMod + перевірка відхилення некоректних документів
load("scripts/00_common.js");

db.runCommand({ collMod: "books", validationLevel: "strict", validationAction: "error", validator: { $jsonSchema: {
  bsonType: "object",
  required: ["title", "author", "publication_year", "available"],
  properties: {
    title: { bsonType: "string", minLength: 1, maxLength: 200, description: "Назва: 1-200 символів" },
    author: { bsonType: "string", minLength: 1, description: "Автор обов'язковий" },
    publication_year: { bsonType: "int", minimum: 1000, maximum: 2100, description: "Рік між 1000 та 2100" },
    pages: { bsonType: "int", minimum: 1, maximum: 10000 },
    isbn: { bsonType: "string", pattern: "^978-\\d{1,5}-\\d{1,7}-\\d{1,7}-\\d{1}$", description: "ISBN формату 978-xxx-xx-xxxx-x" },
    available: { bsonType: "bool" },
    genres: { bsonType: "array", minItems: 1, uniqueItems: true, items: { bsonType: "string" } },
    publisher: { bsonType: "object", required: ["name"], properties: { name: { bsonType: "string" }, city: { bsonType: "string" } } },
    ratings: { bsonType: "array", items: { bsonType: "object", required: ["user", "score"],
      properties: { user: { bsonType: "string" }, score: { bsonType: "int", minimum: 1, maximum: 5 }, date: { bsonType: "date" } } } },
    version: { bsonType: "int", minimum: 1 }
  }
} } });

db.runCommand({ collMod: "users", validator: { $jsonSchema: {
  bsonType: "object", required: ["username", "email", "status"],
  properties: {
    username: { bsonType: "string", pattern: "^[a-z0-9_]{3,30}$" },
    email: { bsonType: "string", pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$" },
    status: { enum: ["active", "inactive", "suspended"] },
    borrowed_books: { bsonType: "array", maxItems: 5, items: { bsonType: "string" } }
  } } } });

show("Валідатор books встановлено", !!db.getCollectionInfos({ name: "books" })[0].options.validator);

function attempt(label, coll, doc) {
  try { const r = db[coll].insertOne(doc); db[coll].deleteOne({ _id: r.insertedId }); return label + " → ВСТАВЛЕНО (і одразу видалено)"; }
  catch (e) { return label + " → ВІДХИЛЕНО (код " + e.code + "): " + JSON.stringify((e.errInfo.details.schemaRulesNotSatisfied || []).map(r => r.propertiesNotSatisfied ? r.propertiesNotSatisfied.map(p => p.propertyName + ":" + (p.details ? p.details[0].operatorName : "")) : r.operatorName)); }
}
const ok = { title: "Тестова книга", author: "Тестовий автор", publication_year: 2020, available: true };
const t = [
  ["коректний документ", "books", { ...ok, isbn: "978-966-03-1111-1", pages: 100, genres: ["тест"] }],
  ["рік 3000 (> maximum)", "books", { ...ok, publication_year: 3000 }],
  ["немає поля author", "books", { title: "X", publication_year: 2000, available: true }],
  ["pages — рядок", "books", { ...ok, pages: "сто" }],
  ["некоректний ISBN", "books", { ...ok, isbn: "123-ABC" }],
  ["оцінка 7 (> 5)", "books", { ...ok, ratings: [{ user: "u", score: 7 }] }],
  ["жанри дублюються", "books", { ...ok, genres: ["а", "а"] }],
  ["порожня назва", "books", { ...ok, title: "" }],
  ["користувач зі статусом 'banned'", "users", { username: "test_user", email: "t@e.com", status: "banned" }],
  ["некоректний email", "users", { username: "test_user", email: "not-an-email", status: "active" }],
  ["6 взятих книг (maxItems 5)", "users", { username: "test_user", email: "t@e.com", status: "active", borrowed_books: ["1", "2", "3", "4", "5", "6"] }]
];
show("Тести валідації", t.map(x => attempt(x[0], x[1], x[2])));
show("Оновлення теж перевіряється: pages -> -5", (() => { try { db.books.updateOne({ title: "Кобзар" }, { $set: { pages: -5 } }); return "змінено (помилка!)"; } catch (e) { return "ВІДХИЛЕНО, код " + e.code; } })());
show("Існуючі документи відповідають схемі (strict)", db.books.countDocuments({ $nor: [{ $jsonSchema: db.getCollectionInfos({ name: "books" })[0].options.validator.$jsonSchema }] }) === 0);
