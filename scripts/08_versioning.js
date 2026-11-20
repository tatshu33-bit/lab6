// Рівень 3: версіонування документів (історія змін) на основі транзакцій
load("scripts/00_common.js");
db.books_history.drop();
db.books.updateMany({ version: { $exists: false } }, { $set: { version: 1 } });
db.books_history.createIndex({ book_id: 1, version: -1 }, { unique: true });

// Атомарно: зберегти поточну версію в books_history і застосувати зміну (version++).
function updateBookVersioned(filter, changes, user, comment) {
  const s = db.getMongo().startSession();
  try {
    s.withTransaction(() => {
      const sdb = s.getDatabase("library");
      const old = sdb.books.findOne(filter);
      if (!old) throw new Error("Книгу не знайдено");
      sdb.books_history.insertOne({ book_id: old._id, version: old.version, snapshot: old, changed_by: user, changed_at: new Date(), comment: comment || "" });
      const res = sdb.books.updateOne({ _id: old._id, version: old.version },     // оптимістичне блокування
        { $set: { ...changes, version: old.version + 1, updated_at: new Date() } });
      if (res.modifiedCount !== 1) throw new Error("Конфлікт версій");
    });
  } finally { s.endSession(); }
}
function restoreBookVersion(bookId, version, user) {
  const s = db.getMongo().startSession();
  try {
    s.withTransaction(() => {
      const sdb = s.getDatabase("library");
      const cur = sdb.books.findOne({ _id: bookId });
      const old = sdb.books_history.findOne({ book_id: bookId, version });
      if (!old) throw new Error("Версії немає");
      sdb.books_history.insertOne({ book_id: cur._id, version: cur.version, snapshot: cur, changed_by: user, changed_at: new Date(), comment: "перед відкатом до v" + version });
      const snap = old.snapshot; snap.version = cur.version + 1; snap.updated_at = new Date();
      sdb.books.replaceOne({ _id: bookId }, snap);
    });
  } finally { s.endSession(); }
}
function diff(a, b) { const d = {}; new Set([...Object.keys(a), ...Object.keys(b)]).forEach(k => { if (k !== "version" && k !== "updated_at" && JSON.stringify(a[k]) !== JSON.stringify(b[k])) d[k] = { from: a[k], to: b[k] }; }); return d; }

const id = db.books.findOne({ title: "Кобзар" })._id;
updateBookVersioned({ _id: id }, { pages: 240, available: true }, "admin", "уточнено кількість сторінок");
updateBookVersioned({ _id: id }, { description: "Збірка поезій Тараса Шевченка (повне видання)" }, "librarian", "новий опис");
updateBookVersioned({ _id: id }, { "publisher.name": "Наукова думка" }, "librarian", "змінено видавця");
show("Поточна версія Кобзаря", db.books.findOne({ _id: id }, { title: 1, pages: 1, version: 1, "publisher.name": 1, description: 1, _id: 0 }));
show("Історія змін", db.books_history.find({ book_id: id }, { version: 1, changed_by: 1, comment: 1, _id: 0 }).sort({ version: 1 }).toArray());
const hist = db.books_history.find({ book_id: id }).sort({ version: 1 }).toArray();
show("Diff v1 → v2", diff(hist[0].snapshot, hist[1].snapshot));
show("Diff v3 → поточна", diff(hist[2].snapshot, db.books.findOne({ _id: id })));
show("Конфлікт версій блокується (оновлення зі старою version)", (() => {
  try { const r = db.books.updateOne({ _id: id, version: 1 }, { $set: { pages: 1 } }); return "matchedCount=" + r.matchedCount; } catch (e) { return e.message; } })());
restoreBookVersion(id, 1, "admin");
show("Після відкату до v1", db.books.findOne({ _id: id }, { title: 1, pages: 1, version: 1, "publisher.name": 1, description: 1, _id: 0 }));
show("Історія після відкату", db.books_history.find({ book_id: id }, { version: 1, comment: 1, _id: 0 }).sort({ version: 1 }).toArray());
