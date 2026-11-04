const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");
const initSqlJs = require("sql.js");

const app = express();
const port = Number(process.env.PORT) || 3001;
const databasePath = path.join(__dirname, "data", "ruokaostokset.sqlite");

app.use(express.json());

let database;
let saveQueue = Promise.resolve();

async function persistDatabase() {
  const data = Buffer.from(database.export());
  saveQueue = saveQueue.then(() => fs.writeFile(databasePath, data));
  await saveQueue;
}

function readGroceries() {
  const result = database.exec(
    "SELECT id, name, quantity, is_purchased, created_at FROM groceries ORDER BY id DESC",
  );
  if (result.length === 0) {
    return [];
  }

  const { columns, values } = result[0];
  return values.map((row) =>
    Object.fromEntries(columns.map((column, index) => [column, row[index]])),
  );
}

app.get("/api/groceries", (_request, response) => {
  response.json(readGroceries());
});

app.post("/api/groceries", async (request, response, next) => {
  const body =
    request.body && typeof request.body === "object" ? request.body : {};
  const name =
    typeof body.name === "string" ? body.name.trim() : "";
  const quantity = Number(body.quantity);

  if (name.length === 0 || name.length > 120) {
    return response
      .status(400)
      .json({ error: "Tuotteen nimen tulee olla 1–120 merkkiä." });
  }
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 99) {
    return response
      .status(400)
      .json({ error: "Määrän tulee olla positiivinen luku, enintään 99." });
  }

  try {
    database.run(
      "INSERT INTO groceries (name, quantity) VALUES (?, ?)",
      [name, quantity],
    );
    await persistDatabase();
    return response.status(201).json(readGroceries()[0]);
  } catch (error) {
    return next(error);
  }
});

app.patch("/api/groceries/:id/purchased", async (request, response, next) => {
  const id = Number(request.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return response.status(400).json({ error: "Virheellinen tuotetunniste." });
  }
  if (typeof request.body?.isPurchased !== "boolean") {
    return response
      .status(400)
      .json({ error: "Ostoksen tilan tulee olla tosi tai epätosi." });
  }

  try {
    const statement = database.prepare("SELECT id FROM groceries WHERE id = ?");
    statement.bind([id]);
    const exists = statement.step();
    statement.free();
    if (!exists) {
      return response.status(404).json({ error: "Tuotetta ei löytynyt." });
    }

    database.run("UPDATE groceries SET is_purchased = ? WHERE id = ?", [
      Number(request.body.isPurchased),
      id,
    ]);
    await persistDatabase();
    return response.json(readGroceries().find((grocery) => grocery.id === id));
  } catch (error) {
    return next(error);
  }
});

app.delete("/api/groceries/:id", async (request, response, next) => {
  const id = Number(request.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return response.status(400).json({ error: "Virheellinen tuotetunniste." });
  }

  try {
    database.run("DELETE FROM groceries WHERE id = ?", [id]);
    if (database.getRowsModified() === 0) {
      return response.status(404).json({ error: "Tuotetta ei löytynyt." });
    }
    await persistDatabase();
    return response.status(204).end();
  } catch (error) {
    return next(error);
  }
});

app.use((error, _request, response, _next) => {
  console.error("API-virhe:", error);
  if (response.headersSent) {
    return;
  }
  response.status(500).json({ error: "Tietojen käsittely epäonnistui." });
});

async function start() {
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(path.dirname(require.resolve("sql.js")), file),
  });
  await fs.mkdir(path.dirname(databasePath), { recursive: true });

  try {
    const savedDatabase = await fs.readFile(databasePath);
    database = new SQL.Database(savedDatabase);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
    database = new SQL.Database();
  }

  database.run(`
    CREATE TABLE IF NOT EXISTS groceries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
      quantity REAL NOT NULL CHECK (quantity > 0),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const columns = database.exec("PRAGMA table_info(groceries)")[0].values;
  if (columns.some((column) => column[1] === "unit")) {
    database.run(`
      BEGIN TRANSACTION;
      CREATE TABLE groceries_without_unit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
        quantity REAL NOT NULL CHECK (quantity > 0),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO groceries_without_unit (id, name, quantity, created_at)
        SELECT id, name, quantity, created_at FROM groceries;
      DROP TABLE groceries;
      ALTER TABLE groceries_without_unit RENAME TO groceries;
      COMMIT;
    `);
  }

  const currentColumns = database.exec("PRAGMA table_info(groceries)")[0].values;
  if (!currentColumns.some((column) => column[1] === "is_purchased")) {
    database.run(`
      ALTER TABLE groceries
      ADD COLUMN is_purchased INTEGER NOT NULL DEFAULT 0
      CHECK (is_purchased IN (0, 1))
    `);
  }

  await persistDatabase();

  app.listen(port, () => {
    console.log(`API käynnissä osoitteessa http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error("Palvelimen käynnistys epäonnistui:", error);
  process.exitCode = 1;
});
