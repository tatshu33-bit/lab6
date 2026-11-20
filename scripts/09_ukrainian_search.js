// Рівень 3: повнотекстовий пошук для української мови.
// У MongoDB немає українського стемера (вбудовані мови text-індексу: da, nl, en, fi, fr, de, hu, it, nb, pt, ro, ru, es, sv, tr),
// тому: default_language "none" + власна нормалізація (стемінг по суфіксах) під час запису й пошуку.
load("scripts/00_common.js");

// Лише відмінкові закінчення іменників/прикметників (дієслівні форми свідомо не обробляємо — це евристика без словника)
const ENDINGS = ["ннями", "ннях", "нням", "ння", "нню", "нні", "ами", "ями", "ові", "еві", "ого", "ому", "ими", "їми", "ією", "ії", "ія", "ію",
  "ах", "ях", "ою", "ею", "ям", "ом", "ем", "ів", "їв", "ий", "ій", "ої", "а", "я", "у", "ю", "і", "и", "е", "є", "о", "ь"]
  .sort((a, b) => b.length - a.length);
function ukStem(w) {
  w = w.toLowerCase().replace(/['’ʼ]/g, "");
  for (const e of ENDINGS) if (w.length - e.length >= 3 && w.endsWith(e)) return w.slice(0, -e.length);
  return w;
}
function ukTokens(text) { return (text.match(/[\p{L}\p{N}]+(?:['’ʼ][\p{L}\p{N}]+)*/gu) || []).map(ukStem); }

// 1. Індексований «нормалізований» текст
db.books.find().forEach(b => {
  const stems = ukTokens([b.title, b.description, (b.genres || []).join(" "), b.author].join(" "));
  db.books.updateOne({ _id: b._id }, { $set: { search_stems: [...new Set(stems)].join(" ") } });
});
// 2. Замінюємо текстовий індекс (у колекції дозволено лише один)
try { db.books.dropIndex("text_title_desc"); } catch (e) { /* вже видалено */ }
show("text-індекс по search_stems", db.books.createIndex({ search_stems: "text" }, { default_language: "none", name: "text_uk_stems" }));
function ukSearch(q) {
  const query = ukTokens(q).join(" ");
  return { запит: q, нормалізовано: query, знайдено: db.books.find({ $text: { $search: query } }, { title: 1, score: { $meta: "textScore" }, _id: 0 }).sort({ score: { $meta: "textScore" } }).toArray().map(d => d.title) };
}
show("Приклад стемінгу", ["кохання", "коханні", "коханням", "Карпати", "Карпатах", "селян", "селянами", "повість", "повісті", "поезія", "поезії", "романтичний"].map(w => w + " → " + ukStem(w)));
["кохання", "коханні", "Карпатах", "Карпати", "повісті", "поезії", "селянами", "Франка", "відьми"].forEach(q => show("Пошук", ukSearch(q)));
show("Для порівняння: вбудований індекс без стемінгу не знаходив 'Карпати' (див. рівень 2)", "OK");
