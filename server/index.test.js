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

    //tarkistetaan, että ostoslistassa ei ole tuotetta, jonka nimi on tyhjä
    const groceries = await request(app).get("/api/groceries");
    expect(groceries.status).toBe(200);
    expect(groceries.body).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "" })
      ])
    );
  });

  it("TC-004: Tuotteen lisääminen pelkillä välilyönneillä nimessä", async () => {
    const response = await request(app)
      .post("/api/groceries")
      .send({ name: "   ", quantity: 1 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Tuotteen nimen tulee olla 1–120 merkkiä.");

    //tarkistetaan, että ostoslistassa ei ole tuotetta, jonka nimi on pelkkiä välilyöntejä  
    const groceries = await request(app).get("/api/groceries");
    expect(groceries.status).toBe(200);
    expect(groceries.body).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "   " })
      ])
    );
  });
  
  it("TC-005: Tuotteen lisääminen ilman määrää", async () => {
    const response = await request(app)
      .post("/api/groceries")
      .send({ name: "Kahvi" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Määrän tulee olla positiivinen luku, enintään 99.");

    //tarkistetaan, että ostoslistassa ei ole tuotetta, jonka määrä puuttuu
    const groceries = await request(app).get("/api/groceries");
    expect(groceries.status).toBe(200);
    expect(groceries.body).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Kahvi" })
      ])
    );
  });

  it("TC-006: Tuotteen lisääminen ilman nimeä", async () => {
    const response = await request(app)
      .post("/api/groceries")
      .send({ quantity: 2 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Tuotteen nimen tulee olla 1–120 merkkiä.");

    //tarkistetaan, että ostoslistassa ei ole tuotetta, jonka nimi puuttuu
    const groceries = await request(app).get("/api/groceries");
    expect(groceries.status).toBe(200);
    expect(groceries.body).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ quantity: 2 })
      ])
    );
  });
       
  it("TC-007: Nollamäärän hylkääminen", async () => {
    const response = await request(app)
      .post("/api/groceries")
      .send({ name: "Omena", quantity: 0 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Määrän tulee olla positiivinen luku, enintään 99.");

    //tarkistetaan, että ostoslistassa ei ole tuotetta, jonka määrä on nolla
    const groceries = await request(app).get("/api/groceries");
    expect(groceries.status).toBe(200);
    expect(groceries.body).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Omena" })
      ])
    );
  });
    
  it("TC-008: Negatiivisen määrän hylkääminen", async () => {
    const response = await request(app)
      .post("/api/groceries")
      .send({ name: "Banaani", quantity: -1 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Määrän tulee olla positiivinen luku, enintään 99.");

    //tarkistetaan, että ostoslistassa ei ole tuotetta, jonka määrä on negatiivinen
    const groceries = await request(app).get("/api/groceries");
    expect(groceries.status).toBe(200);
    expect(groceries.body).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Banaani" })
      ])
    );
  });
  
  it("TC-009: Desimaalimäärän hylkääminen", async () => {
    const response = await request(app)
      .post("/api/groceries")
      .send({ name: "Peruna", quantity: 1.5 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Määrän tulee olla positiivinen luku, enintään 99.");

    //tarkistetaan, että ostoslistassa ei ole tuotetta, jonka määrä on desimaaliluku
    const groceries = await request(app).get("/api/groceries");
    expect(groceries.status).toBe(200);
    expect(groceries.body).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Peruna" })
      ])
    );
  });
     
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
 
  it("TC-011: Ostetun tuotteen palauttaminen ostamattomaksi", async () => {
    const addResponse = await request(app)
      .post("/api/groceries")
      .send({ name: "Juusto", quantity: 1 });

    const groceryId = addResponse.body.id;

    await request(app)
      .patch(`/api/groceries/${groceryId}/purchased`)
      .send({ isPurchased: true });

    const response = await request(app)
      .patch(`/api/groceries/${groceryId}/purchased`)
      .send({ isPurchased: false });

    expect(response.status).toBe(200);
    expect(response.body.is_purchased).toBe(0);
  });
  
  it("TC-012: Ostetun tuotteen poistaminen", async () => {
    const addResponse = await request(app)
      .post("/api/groceries")
      .send({ name: "Leipä", quantity: 1 });

    const groceryId = addResponse.body.id;

    await request(app)
      .patch(`/api/groceries/${groceryId}/purchased`)
      .send({ isPurchased: true });

    const response = await request(app)
      .delete(`/api/groceries/${groceryId}`);

    expect(response.status).toBe(204);
  });
  
  it("TC-013: Ostamattoman tuotteen poistaminen", async () => {
    const addResponse = await request(app)
      .post("/api/groceries")
      .send({ name: "Jogurtti", quantity: 1 });

    const groceryId = addResponse.body.id;

    
    const response = await request(app)
      .delete(`/api/groceries/${groceryId}`);

    expect(response.status).toBe(204);
  });

  // kaikkien tuotteiden suodatus
  // listalla ostettuja ja ostamattomia tuotteita  
  it("TC-014: Kaikkien tuotteiden suodatus", async () => {
    const yogurtResponse = await request(app)
      .post("/api/groceries")
      .send({ name: "Jogurtti", quantity: 1 });
    const appleResponse = await request(app)
      .post("/api/groceries")
      .send({ name: "Omena", quantity: 2 });

    expect(yogurtResponse.status).toBe(201);
    expect(appleResponse.status).toBe(201);

    const purchaseResponse = await request(app)
      .patch(`/api/groceries/${yogurtResponse.body.id}/purchased`)
      .send({ isPurchased: true });
    expect(purchaseResponse.status).toBe(200);

    const response = await request(app)
      .get("/api/groceries");

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: "Jogurtti",
        quantity: 1,
        is_purchased: 1,
      }),
      expect.objectContaining({
        name: "Omena",
        quantity: 2,
        is_purchased: 0,
      }),
    ]));
  });

  it("TC-015: Ostamattomien tuotteiden suodatus", async () => {
    const products = [
      { name: "Jogurtti", quantity: 1 },
      { name: "Omena", quantity: 2 },
      { name: "Maito", quantity: 1 },
      { name: "Leipä", quantity: 1 },
      { name: "Kahvi", quantity: 1 },
    ];
    const addedProducts = [];

    for (const product of products) {
      const addResponse = await request(app)
        .post("/api/groceries")
        .send(product);
      expect(addResponse.status).toBe(201);
      addedProducts.push(addResponse.body);
    }

    // merkitään ostetuiksi kaksi ensimmäistä tuotetta (Jogurtti ja Omena)    
    for (const grocery of addedProducts.slice(0, 2)) {
      const purchaseResponse = await request(app)
        .patch(`/api/groceries/${grocery.id}/purchased`)
        .send({ isPurchased: true });
      expect(purchaseResponse.status).toBe(200);
    }

    const initialResponse = await request(app).get("/api/groceries");
    expect(initialResponse.status).toBe(200);
    // ostettuja tuotteita 2
    expect(initialResponse.body.filter((grocery) => grocery.is_purchased === 1))
      .toHaveLength(2);
    // ostamattomia tuotteita 3
    expect(initialResponse.body.filter((grocery) => grocery.is_purchased === 0))
      .toHaveLength(3);

    // päivitetään 3. ostamaton tuote (Maito) ostetuksi
    const updateResponse = await request(app)
      .patch(`/api/groceries/${addedProducts[2].id}/purchased`)
      .send({ isPurchased: true });
    expect(updateResponse.status).toBe(200);

    const response = await request(app).get("/api/groceries");
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(5);
    
    // ostettuja tuotteita 3 kpl (jogurtti, omena, maito)
    expect(response.body.filter((grocery) => grocery.is_purchased === 1))
      .toHaveLength(3);
    // ostamattomia tuotteita 2 kpl (leipä, kahvi)
    expect(response.body.filter((grocery) => grocery.is_purchased === 0))
      .toHaveLength(2);
  });

  it("TC-016: Ostettujen tuotteiden suodatus", async () => {
    const products = [
      { name: "Jogurtti", quantity: 1 },
      { name: "Omena", quantity: 2 },
      { name: "Maito", quantity: 1 },
      { name: "Leipä", quantity: 1 },
      { name: "Kahvi", quantity: 1 },
    ];
    const addedProducts = [];

    for (const product of products) {
      const addResponse = await request(app)
        .post("/api/groceries")
        .send(product);
      expect(addResponse.status).toBe(201);
      addedProducts.push(addResponse.body);
    }

    // merkitään ensimmäiset kaksi tuotetta ostetuiksi (jogurtti, omena)
    for (const grocery of addedProducts.slice(0, 2)) {
      const purchaseResponse = await request(app)
        .patch(`/api/groceries/${grocery.id}/purchased`)
        .send({ isPurchased: true });
      expect(purchaseResponse.status).toBe(200);
    }

    const initialResponse = await request(app).get("/api/groceries");
    expect(initialResponse.status).toBe(200);
    
    // ostettuja tuotteita 2 kpl (jogurtti, omena)
    expect(initialResponse.body.filter((grocery) => grocery.is_purchased === 1))
      .toHaveLength(2);
    // ostamattomia tuotteita 3 kpl (maito, leipä, kahvi)
    expect(initialResponse.body.filter((grocery) => grocery.is_purchased === 0))
      .toHaveLength(3);

    // palautetaan ensimmäinen tuote ostamattomaksi (jogurtti)
    const updateResponse = await request(app)
      .patch(`/api/groceries/${addedProducts[0].id}/purchased`)
      .send({ isPurchased: false });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.is_purchased).toBe(0);

    const response = await request(app).get("/api/groceries");
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(5);
    
    // ostettuja tuotteita 1 kpl (omena)
    expect(response.body.filter((grocery) => grocery.is_purchased === 1))
      .toHaveLength(1);
    // ostamattomia tuotteita 4 kpl (jogurtti, maito, leipä, kahvi)
    expect(response.body.filter((grocery) => grocery.is_purchased === 0))
      .toHaveLength(4);
  });

  it("TC-017: Tietojen säilyminen sivun päivityksessä", async () => {
    const addResponse = await request(app)
      .post("/api/groceries")
      .send({ name: "Kauramaito", quantity: 1 });

    expect(addResponse.status).toBe(201);

    const purchaseResponse = await request(app)
      .patch(`/api/groceries/${addResponse.body.id}/purchased`)
      .send({ isPurchased: true });
    expect(purchaseResponse.status).toBe(200);

    // Uusi GET-pyyntö vastaa käyttöliittymän latausta sivun päivityksen jälkeen.
    const refreshResponse = await request(app).get("/api/groceries");

    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body).toContainEqual(
      expect.objectContaining({
        id: addResponse.body.id,
        name: "Kauramaito",
        quantity: 1,
        is_purchased: 1,
      }),
    );
  });
 
  //TC-018: Tietojen säilyminen palvelimen uudelleenkäynnistyksessä
  //manuaalinen testaus vaaditaan, koska palvelimen uudelleenkäynnistystä ei voida simuloida automaattisesti tässä testissä.

  //TC-019: API-pyyntö ilman tuotteen nimeä (Postman)
  // /Tämä testi tehty Postmanilla manuaalisesti 

  it("TC-020: API-pyyntö virheellisellä tietotyypillä", async () => {
    const response = await request(app)
      .post("/api/groceries")
      .send({ name: "Maito", quantity: "monta" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Määrän tulee olla positiivinen luku, enintään 99.");

    // Varmistetaan, että virheellisen pyynnön jälkeen ostoslista on tyhjä.
    const groceriesResponse = await request(app).get("/api/groceries");
    expect(groceriesResponse.status).toBe(200);
    expect(groceriesResponse.body).toEqual([]);
  });
    
  it("TC-021: Tuntemattoman tuotteen poistaminen", async () => {
    const response = await request(app)
      .delete("/api/groceries/9999");

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Tuotetta ei löytynyt.");
  });
  
  it("TC-022: Tyhjän ostoslistan näyttäminen", async () => {    
    const response = await request(app).get("/api/groceries");
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("TC-023: Ääkköset ja erikoismerkit nimessä", async () => {
    const response = await request(app)
      .post("/api/groceries")
      .send({ name: "Ääkkösleipä!@#", quantity: 1 });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe("Ääkkösleipä!@#");

    const groceriesResponse = await request(app).get("/api/groceries");
    expect(groceriesResponse.status).toBe(200);
    expect(groceriesResponse.body).toContainEqual(
      expect.objectContaining({ name: "Ääkkösleipä!@#", quantity: 1 }),
    );
  });

  //TC-024: API:n kautta lisätyn tuotteen näkyminen käyttöliittymässä
  //lisätään tuote API:n kautta ja tarkistetaan, että se näkyy ostoslistassa käyttöliittymässä localhost:5173
  //tämä testi tehty manuaalisesti
  
  it("TC-025: Tuotteen lisääminen määrällä 99 - hyväksytään", async () => {
    const response = await request(app)
      .post("/api/groceries")
      .send({ name: "Omena", quantity: 99 });

    expect(response.status).toBe(201);
    expect(response.body.quantity).toBe(99);
  });

  it("TC-026: Tuotteen lisääminen määrällä 100 - hylätään", async () => {
    const response = await request(app)
      .post("/api/groceries")
      .send({ name: "Banaani", quantity: 100 });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("Määrän tulee olla positiivinen luku, enintään 99.");

    const groceriesResponse = await request(app).get("/api/groceries");
    expect(groceriesResponse.status).toBe(200);
    expect(groceriesResponse.body).toEqual([]);
  });
  
  it("TC-027: Tuotteen lisääminen määrällä 98 - hyväksytään", async () => {
    const response = await request(app)
      .post("/api/groceries")
      .send({ name: "Päärynä", quantity: 98 });

    expect(response.status).toBe(201);
    expect(response.body.quantity).toBe(98);    
  });
  
  it("TC-028: Tuotteen lisääminen nimen pituudella 120 merkkiä - hyväksytään", async () => {
    const longName = "A".repeat(120);
    const response = await request(app)
      .post("/api/groceries")
      .send({ name: longName, quantity: 1 });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe(longName);
  });
  
  it("TC-029: Tuotteen lisääminen nimen pituudella 121 merkkiä - hylätään", async () => {
    const longName = "A".repeat(121);
    const response = await request(app)
      .post("/api/groceries")
      .send({ name: longName, quantity: 1 });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("Tuotteen nimen tulee olla 1–120 merkkiä.");

    const groceriesResponse = await request(app).get("/api/groceries");
    expect(groceriesResponse.status).toBe(200);
    expect(groceriesResponse.body).toEqual([]);
  });
  
  it("TC-030: Tuotteen lisääminen nimen pituudella 119 merkkiä - hyväksytään", async () => {
    const longName = "A".repeat(119);
    const response = await request(app)
      .post("/api/groceries")
      .send({ name: longName, quantity: 1 });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe(longName);
  });
  
  it("TC-031: Tuotteen lisääminen nimen pituudella 1 merkki - hyväksytään", async () => {
    const shortName = "A";
    const response = await request(app)
      .post("/api/groceries")
      .send({ name: shortName, quantity: 1 });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe(shortName);
  });
  
  it("TC-032: Tuotteen lisääminen, nimen pituudella 0 merkkiä - hylätään", async () => {
    const shortName = "";
    const response = await request(app)
      .post("/api/groceries")
      .send({ name: shortName, quantity: 1 });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("Tuotteen nimen tulee olla 1–120 merkkiä.");

    const groceriesResponse = await request(app).get("/api/groceries");
    expect(groceriesResponse.status).toBe(200);
    expect(groceriesResponse.body).toEqual([]);
  });
  
  it("TC-033: Tuotteen lisääminen, nimen pituudella 2 merkkiä - hyväksytään", async () => {
    const shortName = "AB";
    const response = await request(app)
      .post("/api/groceries")
      .send({ name: shortName, quantity: 1 });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe(shortName);
  });

   it("TC-034: Tuotteen lisääminen, jossa määrä on tyhjä - hylätään", async () => {
    const response = await request(app)
      .post("/api/groceries")
      .send({ name: "Kurkku", quantity: "" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Määrän tulee olla positiivinen luku, enintään 99.");

    const groceriesResponse = await request(app).get("/api/groceries");
    expect(groceriesResponse.status).toBe(200);
    expect(groceriesResponse.body).toEqual([]);
  });
    
  it("TC-035: Tuotteen lisääminen, jossa määrä on merkkijono - hylätään", async () => {
    const response = await request(app)
      .post("/api/groceries")
      .send({ name: "Kurkku", quantity: "abc" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Määrän tulee olla positiivinen luku, enintään 99.");

    const groceriesResponse = await request(app).get("/api/groceries");
    expect(groceriesResponse.status).toBe(200);
    expect(groceriesResponse.body).toEqual([]);

    //tarkistetaan, että ostoslistassa ei ole tuotetta, jonka määrä on merkkijono
    expect(groceriesResponse.body).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Kurkku" })
      ])
    );
  });
  
  it("TC-036: Tuotteen lisääminen, jossa nimi sisältää numeroita ja kirjaimia - hyväksytään", async () => {
    const name = "Kurkku123";
    const response = await request(app)
      .post("/api/groceries")
      .send({ name, quantity: 1 });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe(name);
  });
 
  it("TC-037: Tuotteen lisääminen, jossa nimi sisältää pelkkiä numeroita - hyväksytään", async () => {
    const name = "12345";
    const response = await request(app)
      .post("/api/groceries")
      .send({ name, quantity: 1 });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe(name);
  });
  
  it("TC-038: Tuotteen lisääminen, jossa nimi sisältää bittikombinaation - hyväksytään", async () => {
    const name = "010101";
    const response = await request(app)
      .post("/api/groceries")
      .send({ name, quantity: 1 });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe(name);
  });
});