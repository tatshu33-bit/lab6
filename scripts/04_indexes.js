// Рівень 1, кроки 5-6: індекси і порівняння швидкодії.
// Крім навчальної колекції books (10 док.) створюємо books_perf на 200 000 документів,
// бо на 10 документах різниця в мілісекундах непомітна.
load("scripts/00_common.js");

db.books.dropIndexes(); // повторний запуск з чистого стану
print("===== books: без індексів =====");
show("explain: author = 'Іван Франко'", plan(db.books.find({ author: "Іван Франко" })));
show("Поточні індекси", db.books.getIndexes().map(i => i.name));

print("\n===== Три індекси для books =====");
show("1) простий {title:1}", db.books.createIndex({ title: 1 }));
show("2) складений {author:1, publication_year:-1}", db.books.createIndex({ author: 1, publication_year: -1 }));
show("3) унікальний {isbn:1} (лише для рядків)", db.books.createIndex({ isbn: 1 }, { unique: true, partialFilterExpression: { isbn: { $type: "string" } } }));
show("getIndexes", db.books.getIndexes().map(i => i.name));
show("explain після індексу: author = 'Іван Франко'", plan(db.books.find({ author: "Іван Франко" })));
show("перевірка унікальності isbn (очікується E11000)", (() => {
  try { db.books.insertOne({ title: "Дубль", author: "X", publication_year: 2000, isbn: "978-966-03-4421-6" }); return "вставлено (помилка!)"; }
  catch (e) { return "E11000 duplicate key, code " + e.code; }
})());

print("\n===== books_perf: 200 000 документів =====");
db.books_perf.drop();
const authors = db.authors.find({}, { name: 1 }).toArray().map(a => a.name);
const genres = ["поезія", "роман", "повість", "драма", "новела", "реалізм", "романтизм", "модернізм", "містика", "історична проза"];
let batch = [];
for (let i = 0; i < 200000; i++) {
  batch.push({ title: "Книга " + i, author: authors[i % authors.length] + " #" + (i % 2000), publication_year: 1800 + (i % 220),
    pages: 30 + (i * 7) % 900, isbn: "978-966-" + String(i).padStart(7, "0"), genres: [genres[i % 10], genres[(i * 3) % 10]],
    available: i % 3 !== 0, rating: (i % 50) / 10 });
  if (batch.length === 10000) { db.books_perf.insertMany(batch); batch = []; }
}
show("Документів у books_perf", db.books_perf.countDocuments());

const q1 = () => db.books_perf.find({ author: "Іван Франко #2" });
const q2 = () => db.books_perf.find({ isbn: "978-966-0123456" });
const q3 = () => db.books_perf.find({ author: "Іван Франко #2", publication_year: { $gte: 1900 } }).sort({ publication_year: -1 });
const q4 = () => db.books_perf.find({ publication_year: { $gte: 2000 }, pages: { $lt: 100 } });

const before = { "author=": plan(q1()), "isbn=": plan(q2()), "author + year, sort": plan(q3()), "year>=2000 & pages<100": plan(q4()) };
show("БЕЗ індексів", before);

db.books_perf.createIndex({ author: 1 });
db.books_perf.createIndex({ isbn: 1 }, { unique: true });
db.books_perf.createIndex({ author: 1, publication_year: -1 });
db.books_perf.createIndex({ publication_year: 1, pages: 1 });
const after = { "author=": plan(q1()), "isbn=": plan(q2()), "author + year, sort": plan(q3()), "year>=2000 & pages<100": plan(q4()) };
show("З індексами", after);

// Середній реальний час 50 запусків (мс) — explain дає лише округлений executionTimeMillis
function bench(fn, n) { const t = Date.now(); for (let i = 0; i < n; i++) fn().toArray(); return (Date.now() - t) / n; }
db.books_perf.dropIndexes();
const noIdx = { "author=": bench(q1, 30), "isbn=": bench(q2, 30), "author+year sort": bench(q3, 30) };
db.books_perf.createIndex({ author: 1 }); db.books_perf.createIndex({ isbn: 1 }, { unique: true }); db.books_perf.createIndex({ author: 1, publication_year: -1 });
const withIdx = { "author=": bench(q1, 30), "isbn=": bench(q2, 30), "author+year sort": bench(q3, 30) };
show("Середній час запиту, мс (30 запусків), без індексів", noIdx);
show("Середній час запиту, мс (30 запусків), з індексами", withIdx);
show("Розмір колекції / індексів, МБ", { data: +(db.books_perf.stats().size / 1048576).toFixed(1), indexes: +(db.books_perf.stats().totalIndexSize / 1048576).toFixed(1) });
