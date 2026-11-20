// Допоміжні функції для всіх скриптів (підключаються через load())
db = db.getSiblingDB("library");
function show(title, value) {
  print("\n// " + title);
  if (value !== undefined) printjson(value);
}
// Короткий підсумок explain("executionStats")
function plan(cursor) {
  const e = cursor.explain("executionStats");
  const es = e.executionStats;
  let stage = e.queryPlanner.winningPlan, chain = [];
  while (stage) { chain.push(stage.stage + (stage.indexName ? "(" + stage.indexName + ")" : "")); stage = stage.inputStage || (stage.inputStages && stage.inputStages[0]); }
  return { plan: chain.join(" -> "), nReturned: es.nReturned, totalKeysExamined: es.totalKeysExamined,
           totalDocsExamined: es.totalDocsExamined, executionTimeMillis: es.executionTimeMillis };
}
