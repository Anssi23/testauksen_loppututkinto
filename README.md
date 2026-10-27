# Ruokaostokset

Reactilla toteutettu ostoslista, joka tallentaa ruokaostokset paikalliseen SQLite-tietokantaan REST-rajapinnan kautta.

## Käynnistys

Asenna riippuvuudet ja käynnistä käyttöliittymä sekä API-palvelin:

```sh
npm install
npm run dev
```

Avaa Viten tulostama osoite selaimessa. Kehityspalvelimen API-pyynnöt välitetään porttiin 3001.

Tuotantokäyttöä varten käyttöliittymän voi kääntää komennolla `npm run build`, ja API-palvelimen voi käynnistää komennolla `npm start`. API käyttää `PORT`-ympäristömuuttujaa tai oletuksena porttia 3001.

## API

- `GET /api/groceries` — listaa ostokset.
- `POST /api/groceries` — lisää ostoksen. JSON-runko: `{ "name": "Kaurajuoma", "quantity": 2 }`.
- `PATCH /api/groceries/:id/purchased` — merkitsee ostoksen ostetuksi tai ostamattomaksi. JSON-runko: `{ "isPurchased": true }`.
- `DELETE /api/groceries/:id` — poistaa ostoksen.

Ostetuksi merkitty tuote säilyy listalla. Ostoksen voi merkitä uudelleen ostamattomaksi tai poistaa erikseen. Tiedot tallennetaan tiedostoon `server/data/ruokaostokset.sqlite`.
