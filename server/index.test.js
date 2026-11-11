import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import initSqlJs from "sql.js";
import { createRequire } from "node:module";
import path from "node:path";
import { createApp } from "./index.js";

const require = createRequire(import.meta.url);

let database;
let app;

beforeAll(async () => {
  const SQL = await initSqlJs({
    locateFile: (file) =>
      path.join(path.dirname(require.resolve("sql.js")), file),
  });

  database = new SQL.Database();
  database.run(`
    CREATE TABLE groceries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      quantity REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      is_purchased INTEGER NOT NULL DEFAULT 0
    )
  `);

  app = createApp({
    database,
    persistDatabase: async () => {},
  });
});

beforeEach(() => {
  database.run("DELETE FROM groceries");
});

afterAll(() => {
  database.close();
});

describe("GET /api/groceries", () => {
 it("TC-002: Ostoslistan näyttäminen", async () => {
    const milk = await request(app)
      .post("/api/groceries")
      .send({ name: "Maito", quantity: 3 });
    const bread = await request(app)
      .post("/api/groceries")
      .send({ name: "Leipä", quantity: 2 });

    expect(milk.status).toBe(201);
    expect(bread.status).toBe(201);

    const response = await request(app).get("/api/groceries");
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "Maito", quantity: 3, is_purchased: 0 }),
      expect.objectContaining({ name: "Leipä", quantity: 2, is_purchased: 0 }),
    ]));
  });
});

describe("POST /api/groceries", () => {   
    it("TC-001: Tuotteen lisääminen kelvollisilla tiedoilla", async () => {
    const response = await request(app)
      .post("/api/groceries")
      .send({ name: "Maito", quantity: 1 });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ name: "Maito", quantity: 1 });

    const groceries = await request(app).get("/api/groceries");
    expect(groceries.status).toBe(200);
    expect(groceries.body).toContainEqual(response.body);
  });
  
  it("TC-003: Tuotteen lisääminen tyhjällä nimellä", async () => {
    const response = await request(app)
      .post("/api/groceries")
      .send({ name: "", quantity: 1 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Tuotteen nimen tulee olla 1–120 merkkiä.");
  });

//tuotteen lisääminen välilyönneillä
  it("TC-004: Tuotteen lisääminen pelkillä välilyönneillä nimessä", async () => {
    const response = await request(app)
      .post("/api/groceries")
      .send({ name: "   ", quantity: 1 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Tuotteen nimen tulee olla 1–120 merkkiä.");
  });

  //tuotteen lisääminen ilman määrää
  it("TC-005: Tuotteen lisääminen ilman määrää", async () => {
    const response = await request(app)
      .post("/api/groceries")
      .send({ name: "Kahvi" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Määrän tulee olla positiivinen luku, enintään 99.");
  });

  it("TC-006: Tuotteen lisääminen ilman nimeä", async () => {
    const response = await request(app)
      .post("/api/groceries")
      .send({ quantity: 2 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Tuotteen nimen tulee olla 1–120 merkkiä.");
  });
  
  it("TC-007: Nollamäärän hylkääminen", async () => {
    const response = await request(app)
      .post("/api/groceries")
      .send({ name: "Omena", quantity: 0 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Määrän tulee olla positiivinen luku, enintään 99.");
  });
    
  it("TC-008: Negatiivisen määrän hylkääminen", async () => {
    const response = await request(app)
      .post("/api/groceries")
      .send({ name: "Banaani", quantity: -1 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Määrän tulee olla positiivinen luku, enintään 99.");
  });
  
  it("TC-009: Desimaalimäärän hylkääminen", async () => {
    const response = await request(app)
      .post("/api/groceries")
      .send({ name: "Peruna", quantity: 1.5 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Määrän tulee olla positiivinen luku, enintään 99.");
  });

  // tuotteen merkiseminen ostetuksi
  it("TC-010: Tuotteen merkitseminen ostetuksi", async () => {
    const addResponse = await request(app)
      .post("/api/groceries")
      .send({ name: "Maito", quantity: 1 });

    const groceryId = addResponse.body.id;

    const response = await request(app)
      .patch(`/api/groceries/${groceryId}/purchased`)
      .send({ isPurchased: true });

    expect(response.status).toBe(200);
    expect(response.body.is_purchased).toBe(1);
  });

  it("hyväksyy määrän 99", async () => {
    const response = await request(app)
      .post("/api/groceries")
      .send({ name: "Kaurajuoma", quantity: 99 });

    expect(response.status).toBe(201);
    expect(response.body.quantity).toBe(99);
  });

  it("hylkää määrän 100", async () => {
    const response = await request(app)
      .post("/api/groceries")
      .send({ name: "Kaurajuoma", quantity: 100 });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("99");
  });
});