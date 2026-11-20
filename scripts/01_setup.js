// Рівень 1, кроки 2-3: база library і колекції (books — з JSON Schema валідацією)
load("scripts/00_common.js");
db.dropDatabase();
db = db.getSiblingDB("library");

db.createCollection("books", {
  validator: { $jsonSchema: {
    bsonType: "object",
    required: ["title", "author", "publication_year"],
    properties: {
      title: { bsonType: "string" },
      author: { bsonType: "string" },
      publication_year: { bsonType: "int", minimum: 1000 },
      pages: { bsonType: "int", minimum: 1 },
      genres: { bsonType: "array", items: { bsonType: "string" } },
      available: { bsonType: "bool" }
    }
  } }
});
db.createCollection("authors");
db.createCollection("users");
show("Колекції бази library", db.getCollectionNames());
