// Рівень 1, крок 5: базові CRUD-операції
load("scripts/00_common.js");

print("===== CREATE =====");
show("insertOne", db.books.insertOne({ title: "Тестова книга", author: "Тест", publication_year: 2020, pages: 100,
  genres: ["тест"], available: true }));
show("insertMany (2 тимчасові книги)", db.books.insertMany([
  { title: "Тимчасова книга 1", author: "Тест", publication_year: 2000, available: false, temp: true },
  { title: "Тимчасова книга 2", author: "Тест", publication_year: 2001, available: false, temp: true }
]).insertedIds);

print("\n===== READ =====");
show("available:true (назви)", db.books.find({ available: true }, { title: 1, _id: 0 }).toArray());
show("автор = Іван Франко", db.books.find({ author: "Іван Франко" }, { title: 1, _id: 0 }).toArray());
show("pages > 100 (порівняння)", db.books.find({ pages: { $gt: 100 } }, { title: 1, pages: 1, _id: 0 }).toArray());
show("genres = 'поезія' (елемент масиву)", db.books.find({ genres: "поезія" }, { title: 1, _id: 0 }).toArray());
show("$or: Шевченко або романтизм", db.books.find({ $or: [{ author: "Тарас Шевченко" }, { genres: "романтизм" }] }, { title: 1, _id: 0 }).toArray());
show("$regex /Лісова/i", db.books.find({ title: { $regex: /Лісова/i } }, { title: 1, _id: 0 }).toArray());
show("вкладений документ: publisher.city = 'Львів'", db.books.find({ "publisher.city": "Львів" }, { title: 1, "publisher.name": 1, _id: 0 }).toArray());
show("sort по року (спадання), limit 3", db.books.find({ temp: { $exists: false } }, { title: 1, publication_year: 1, _id: 0 }).sort({ publication_year: -1 }).limit(3).toArray());
show("genres = 'роман', limit 3", db.books.find({ genres: "роман" }, { title: 1, _id: 0 }).limit(3).toArray());

print("\n===== UPDATE =====");
show("updateOne: Кобзар -> available:false", db.books.updateOne({ title: "Кобзар" }, { $set: { available: false } }));
show("$push рейтингу (Лісова пісня)", db.books.updateOne({ title: "Лісова пісня" },
  { $push: { ratings: { user: "ivan_petrov", score: 5, date: new Date("2024-03-15") } } }));
db.books.updateOne({ title: "Лісова пісня" }, { $push: { ratings: { user: "maria_kovalenko", score: 4, date: new Date("2024-03-20") } } });
show("updateMany: category для книг до 1900 р.", db.books.updateMany({ publication_year: { $lt: 1900 } }, { $set: { category: "класика XIX століття" } }));
show("$inc borrowed_count", db.books.updateOne({ title: "Тіні забутих предків" }, { $inc: { borrowed_count: 1 } }));
show("$unset (поле, якого немає)", db.books.updateOne({ title: "Захар Беркут" }, { $unset: { temporary_note: "" } }));
show("replaceOne тестової книги (повна заміна)", db.books.replaceOne({ title: "Тестова книга" },
  { title: "Тестова книга", author: "Тест", publication_year: 2021, available: true, temp: true }));

print("\n===== DELETE =====");
show("deleteOne (немає такої книги)", db.books.deleteOne({ title: "Застарілий довідник" }));
show("deleteMany({temp:true, available:false})", db.books.deleteMany({ temp: true, available: false }));
show("deleteOne (тестова, temp:true)", db.books.deleteOne({ title: "Тестова книга", temp: true }));
show("deleteOne користувача suspended + old_user", db.users.deleteOne({ status: "suspended", username: "old_user" }));
show("Книг у колекції після очищення", db.books.countDocuments());
