// Рівень 2: складні запити, агрегації, compound-індекси, text-пошук, $lookup, view
load("scripts/00_common.js");
const titles = (cur) => cur.toArray().map(d => d.title);

print("===== 1. Складні запити ($and, $or, $in, $regex) =====");
show("$and: після 1900 р. І доступні І pages < 130", titles(db.books.find({ $and: [{ publication_year: { $gte: 1900 } }, { available: true }, { pages: { $lt: 130 } }] })));
show("$or + $and: (Франко АБО Коцюбинський) І доступні", titles(db.books.find({ $and: [{ $or: [{ author: "Іван Франко" }, { author: "Михайло Коцюбинський" }] }, { available: true }] })));
show("$in: жанри поезія / драма / новела", titles(db.books.find({ genres: { $in: ["поезія", "драма", "новела"] } })));
show("$nin: видавництва не Фоліо", titles(db.books.find({ "publisher.name": { $nin: ["Фоліо"] } })));
show("$regex: назви, що починаються на 'К' (з урахуванням регістру)", titles(db.books.find({ title: { $regex: "^К" } })));
show("$regex (i): опис містить 'кохання'", titles(db.books.find({ description: { $regex: /кохання/i } })));
show("$all: жанри романтизм І повість", titles(db.books.find({ genres: { $all: ["романтизм", "повість"] } })));
show("$size: рівно 3 жанри", titles(db.books.find({ genres: { $size: 3 } })));
show("$elemMatch: рейтинг ≥ 4 від ivan_petrov", (db.books.updateOne({ title: "Кобзар" }, { $push: { ratings: { $each: [{ user: "ivan_petrov", score: 5, date: new Date("2024-03-16") }, { user: "olena_shevchuk", score: 4, date: new Date("2024-04-10") }] } } }),
  titles(db.books.find({ ratings: { $elemMatch: { score: { $gte: 4 }, user: "ivan_petrov" } } }))));
show("користувачі з Луцька або Рівного зі статусом active", db.users.find({ "address.city": { $in: ["Луцьк", "Рівне"] }, status: "active" }, { username: 1, "address.city": 1, _id: 0 }).toArray());

print("\n===== 2. Агрегації =====");
db.books.updateOne({ title: "Тіні забутих предків" }, { $push: { ratings: { $each: [{ user: "anna_melnyk", score: 5, date: new Date("2024-05-01") }, { user: "taras_lysenko", score: 5, date: new Date("2024-05-02") }] } } });
db.books.updateOne({ title: "Intermezzo" }, { $push: { ratings: { user: "olena_shevchuk", score: 3, date: new Date("2024-06-01") } } });
show("Кількість книг за жанрами ($unwind + $group + $sort)", db.books.aggregate([
  { $unwind: "$genres" }, { $group: { _id: "$genres", count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }]).toArray());
show("Середня кількість сторінок за автором", db.books.aggregate([
  { $group: { _id: "$author", avg_pages: { $avg: "$pages" }, total_books: { $sum: 1 } } }, { $sort: { avg_pages: -1 } }]).toArray());
show("Книги за століттями", db.books.aggregate([
  { $project: { century: { $ceil: { $divide: ["$publication_year", 100] } }, author: 1 } },
  { $group: { _id: "$century", books_count: { $sum: 1 }, authors: { $addToSet: "$author" } } }, { $sort: { _id: 1 } }]).toArray());
show("Топ користувачів за кількістю взятих книг", db.users.aggregate([
  { $project: { username: 1, borrowed_count: { $size: "$borrowed_books" } } }, { $sort: { borrowed_count: -1, username: 1 } }, { $limit: 5 }]).toArray());
show("Середній рейтинг книг ($unwind ratings)", db.books.aggregate([
  { $unwind: "$ratings" }, { $group: { _id: "$title", avg_score: { $avg: "$ratings.score" }, votes: { $sum: 1 } } }, { $sort: { avg_score: -1, votes: -1 } }]).toArray());
show("Жанри після 1900 р. (складний pipeline з прикладу)", db.books.aggregate([
  { $match: { publication_year: { $gte: 1900 } } }, { $unwind: "$genres" },
  { $group: { _id: "$genres", count: { $sum: 1 }, avg_pages: { $avg: "$pages" }, books: { $push: "$title" } } },
  { $sort: { count: -1, _id: 1 } }, { $limit: 5 }]).toArray());
show("Статистика за видавництвами ($group + $min/$max)", db.books.aggregate([
  { $group: { _id: "$publisher.name", books: { $sum: 1 }, total_pages: { $sum: "$pages" }, first_year: { $min: "$publication_year" }, last_year: { $max: "$publication_year" } } },
  { $sort: { books: -1 } }]).toArray());

print("\n===== 3. Складені (compound) індекси — правило ESR на books_perf =====");
const qs = () => db.books_perf.find({ genres: "роман", available: true }).sort({ rating: -1 }).limit(20);
db.books_perf.dropIndexes();
show("без індексів", plan(qs()));
db.books_perf.createIndex({ genres: 1 });
show("одиночний {genres:1}: сортування в пам'яті", plan(qs()));
db.books_perf.dropIndex("genres_1");
db.books_perf.createIndex({ genres: 1, available: 1, rating: -1 });
show("compound {genres:1, available:1, rating:-1}", plan(qs()));
db.books_perf.createIndex({ author: 1 }); db.books_perf.createIndex({ isbn: 1 }, { unique: true });
db.books_perf.createIndex({ author: 1, publication_year: -1 }); db.books_perf.createIndex({ publication_year: 1, pages: 1 });

print("\n===== 4. Текстовий пошук =====");
show("createIndex text(title, description), default_language none", db.books.createIndex({ title: "text", description: "text" }, { default_language: "none", name: "text_title_desc" }));
show("$text: 'кохання Карпатах' (точні словоформи)", titles(db.books.find({ $text: { $search: "кохання Карпатах" } })));
show("$text з оцінкою релевантності", db.books.find({ $text: { $search: "повість кохання" } }, { title: 1, score: { $meta: "textScore" }, _id: 0 }).sort({ score: { $meta: "textScore" } }).toArray());
show("$text: точна фраза у лапках", titles(db.books.find({ $text: { $search: "\"забутих предків\"" } })));
show("$text: 'повість' без слова 'кохання' (виключення через -)", titles(db.books.find({ $text: { $search: "повість -кохання" } })));
show("Обмеження: 'Карпати' не знаходить 'Карпатах' (без стемінгу)", titles(db.books.find({ $text: { $search: "Карпати" } })));

print("\n===== 5. $lookup =====");
db.authors.find().forEach(a => db.books.updateMany({ author: a.name }, { $set: { author_id: a._id } }));
show("Книг без author_id", db.books.countDocuments({ author_id: { $exists: false } }));
show("books → authors ($lookup + $unwind)", db.books.aggregate([
  { $lookup: { from: "authors", localField: "author_id", foreignField: "_id", as: "author_details" } }, { $unwind: "$author_details" },
  { $project: { _id: 0, title: 1, author: "$author_details.name", born: "$author_details.birth_year", publication_year: 1, age_at_publication: { $subtract: ["$publication_year", "$author_details.birth_year"] } } },
  { $sort: { age_at_publication: 1 } }, { $limit: 5 }]).toArray());
show("authors → books (LEFT JOIN-подібно: автори без книг)", db.authors.aggregate([
  { $lookup: { from: "books", localField: "_id", foreignField: "author_id", as: "books" } },
  { $project: { _id: 0, name: 1, books_count: { $size: "$books" } } }, { $sort: { books_count: -1, name: 1 } }]).toArray());
show("$lookup з pipeline: користувачі та жанри їхніх книг", db.users.aggregate([
  { $match: { "borrowed_books.0": { $exists: true } } },
  { $lookup: { from: "books", let: { titles: "$borrowed_books" }, pipeline: [{ $match: { $expr: { $in: ["$title", "$$titles"] } } }, { $project: { _id: 0, genres: 1 } }], as: "b" } },
  { $project: { _id: 0, username: 1, genres: { $setUnion: [{ $reduce: { input: "$b.genres", initialValue: [], in: { $concatArrays: ["$$value", "$$this"] } } }, []] } } }, { $limit: 3 }]).toArray());

print("\n===== 6. Представлення (view) =====");
db.available_books.drop(); db.books_with_authors.drop();
db.createView("available_books", "books", [{ $match: { available: true } }, { $project: { title: 1, author: 1, publication_year: 1, pages: 1, _id: 0 } }]);
db.createView("books_with_authors", "books", [
  { $lookup: { from: "authors", localField: "author_id", foreignField: "_id", as: "a" } }, { $unwind: "$a" },
  { $project: { _id: 0, title: 1, publication_year: 1, author: "$a.name", author_birth_year: "$a.birth_year" } }]);
show("available_books: до 1900 р.", db.available_books.find({ publication_year: { $lt: 1900 } }).toArray());
show("books_with_authors (3 шт.)", db.books_with_authors.find().limit(3).toArray());
show("Список колекцій і view", db.getCollectionInfos().map(c => c.name + " [" + c.type + "]").sort());
