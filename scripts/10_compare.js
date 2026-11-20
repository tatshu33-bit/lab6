// Рівень 3: порівняння реляційного (нормалізованого, через $lookup) та документного (вбудованого) моделювання на MongoDB.
// books_emb — автор вбудований у кожну книгу; books_ref + authors_ref — посилання author_id (аналог FK + JOIN).
load("scripts/00_common.js");
["books_emb", "books_ref", "authors_ref"].forEach(c => db[c].drop());
const N_AUTHORS = 2000, PER_AUTHOR = 100, nat = ["український", "польський", "німецький", "французький"];
const authorsArr = []; for (let a = 0; a < N_AUTHORS; a++) authorsArr.push({ _id: a, name: "Автор " + a, birth_year: 1800 + (a % 150), nationality: nat[a % 4],
  biography: "Короткий життєпис автора номер " + a + ", письменника, поета і перекладача." });
db.authors_ref.insertMany(authorsArr);
let tEmb = Date.now(), tRef;
let b1 = [], b2 = [];
const flush = (c, arr) => { if (arr.length) db[c].insertMany(arr, { ordered: false }); };
tEmb = 0; tRef = 0;
for (let i = 0; i < N_AUTHORS * PER_AUTHOR; i++) {
  const a = authorsArr[i % N_AUTHORS], base = { title: "Книга " + i, publication_year: 1850 + (i % 170), pages: 40 + (i * 13) % 700, genres: ["роман", "повість"] };
  b1.push({ ...base, author: { id: a._id, name: a.name, birth_year: a.birth_year, nationality: a.nationality, biography: a.biography } });
  b2.push({ ...base, author_id: a._id });
  if (b1.length === 10000) { let t = Date.now(); flush("books_emb", b1); tEmb += Date.now() - t; t = Date.now(); flush("books_ref", b2); tRef += Date.now() - t; b1 = []; b2 = []; }
}
db.books_emb.createIndex({ "author.id": 1 }); db.books_ref.createIndex({ author_id: 1 });
show("Вставка 200 000 документів, мс (вбудований / посилання)", { embedded: tEmb, referenced: tRef });
const s1 = db.books_emb.stats(), s2 = db.books_ref.stats(), s3 = db.authors_ref.stats();
show("Розмір даних, МБ", { embedded: +(s1.size / 1048576).toFixed(1), referenced_books: +(s2.size / 1048576).toFixed(1), referenced_authors: +(s3.size / 1048576).toFixed(2) });

function bench(fn, n) { fn(); const t = Date.now(); for (let i = 0; i < n; i++) fn(i); return +((Date.now() - t) / n).toFixed(2); }
const R = 100;
show("Читання: 100 книг одного автора разом з даними автора, середній час, мс", {
  embedded_find: bench(i => db.books_emb.find({ "author.id": (i * 17) % N_AUTHORS }).toArray(), R),
  referenced_lookup: bench(i => db.books_ref.aggregate([{ $match: { author_id: (i * 17) % N_AUTHORS } }, { $lookup: { from: "authors_ref", localField: "author_id", foreignField: "_id", as: "author" } }, { $unwind: "$author" }]).toArray(), R) });
show("Читання: тільки книги (без даних автора), мс", {
  embedded_find: bench(i => db.books_emb.find({ "author.id": (i * 17) % N_AUTHORS }, { title: 1 }).toArray(), R),
  referenced_find: bench(i => db.books_ref.find({ author_id: (i * 17) % N_AUTHORS }, { title: 1 }).toArray(), R) });
show("Запис: змінити ім'я автора, середній час, мс", {
  embedded_updateMany_100_docs: bench(i => db.books_emb.updateMany({ "author.id": i % N_AUTHORS }, { $set: { "author.name": "Нове ім'я " + i } }), 50),
  referenced_updateOne_1_doc: bench(i => db.authors_ref.updateOne({ _id: i % N_AUTHORS }, { $set: { name: "Нове ім'я " + i } }), 50) });
const tA = Date.now(); const rA = db.books_emb.aggregate([{ $group: { _id: "$author.nationality", n: { $sum: 1 } } }]).toArray(); const dA = Date.now() - tA;
const tB = Date.now(); const rB = db.books_ref.aggregate([{ $lookup: { from: "authors_ref", localField: "author_id", foreignField: "_id", as: "a" } }, { $unwind: "$a" }, { $group: { _id: "$a.nationality", n: { $sum: 1 } } }]).toArray(); const dB = Date.now() - tB;
show("Аналітика (підрахунок книг за національністю автора по всіх 200 000 книг), мс", { embedded: dA, referenced_lookup: dB, same_result: JSON.stringify(rA.sort((x, y) => x._id.localeCompare(y._id))) === JSON.stringify(rB.sort((x, y) => x._id.localeCompare(y._id))) });
db.books_emb.drop(); db.books_ref.drop(); db.authors_ref.drop();
