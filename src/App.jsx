import { useCallback, useEffect, useState } from "react";

async function request(path, options) {
  const response = await fetch(path, options);
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(result?.error || "Pyyntö epäonnistui. Yritä uudelleen.");
  }
  return response.status === 204 ? null : response.json();
}

function App() {
  const [groceries, setGroceries] = useState([]);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [updatingIds, setUpdatingIds] = useState(() => new Set());

  const loadGroceries = useCallback(async () => {
    setError("");
    setIsLoading(true);
    try {
      setGroceries(await request("/api/groceries"));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGroceries();
  }, [loadGroceries]);

  async function addGrocery(event) {
    event.preventDefault();
    setError("");
    setIsSaving(true);
    try {
      const grocery = await request("/api/groceries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, quantity: Number(quantity) }),
      });
      setGroceries((current) => [grocery, ...current]);
      setName("");
      setQuantity("1");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function removeGrocery(id) {
    setError("");
    try {
      await request(`/api/groceries/${id}`, { method: "DELETE" });
      setGroceries((current) => current.filter((grocery) => grocery.id !== id));
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  async function togglePurchased(grocery) {
    setError("");
    setUpdatingIds((current) => new Set(current).add(grocery.id));
    try {
      const updatedGrocery = await request(
        `/api/groceries/${grocery.id}/purchased`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isPurchased: !grocery.is_purchased }),
        },
      );
      setGroceries((current) =>
        current.map((item) =>
          item.id === grocery.id ? updatedGrocery : item,
        ),
      );
    } catch (updateError) {
      setError(updateError.message);
    } finally {
      setUpdatingIds((current) => {
        const next = new Set(current);
        next.delete(grocery.id);
        return next;
      });
    }
  }

  function adjustQuantity(amount) {
    const current = Number(quantity);
    const next = Number.isFinite(current) ? current + amount : 1;
    setQuantity(String(Math.min(99, Math.max(1, next))));
  }

  const totalItems = groceries.length;
  const orderedGroceries = [...groceries].sort(
    (first, second) =>
      Number(first.is_purchased) - Number(second.is_purchased),
  );

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Ostoslista, etusivu">
          <span className="brand-mark" aria-hidden="true">
            O
          </span>
          <span>ostoslista</span>
        </a>
        <span className="topbar-note">Pienet ostokset, iso mielenrauha.</span>
      </header>

      <section className="intro" aria-labelledby="page-title">
        <div className="eyebrow">
          <span className="status-dot" />
          OMA RUOKAKAUPAN LISTA
        </div>
        <h1 id="page-title">
          Mitä kaupasta
          <br />
          <span>tarvitaan?</span>
        </h1>
        <p>Kirjaa ostokset talteen, niin ne pysyvät tallessa seuraavaakin kertaa varten.</p>
      </section>

      <section className="content-card" aria-label="Ruokaostokset">
        <form className="add-form" onSubmit={addGrocery}>
          <div className="form-heading">
            <div>
              <span className="section-kicker">UUSI OSTOS</span>
              <h2>Lisää ostos listalle</h2>
            </div>            
          </div>

          <div className="form-fields">
            <label className="field name-field">
              <span>Tuotteen nimi</span>
              <input
                autoComplete="off"
                maxLength={120}
                onChange={(event) => setName(event.target.value)}
                placeholder="esim. kaurajuoma"
                required
                value={name}
              />
            </label>
            <div className="field quantity-field">
              <span>Määrä</span>
              <div className="quantity-control">
                <button
                  aria-label="Vähennä määrää"
                  className="quantity-button"
                  disabled={Number(quantity) <= 1}
                  onClick={() => adjustQuantity(-1)}
                  type="button"
                >
                  −
                </button>
                <input
                  aria-label="Määrä"
                  max="99"
                  min="1"
                  onChange={(event) => setQuantity(event.target.value)}
                  required
                  step="1"
                  type="number"
                  value={quantity}
                />
                <button
                  aria-label="Lisää määrää"
                  className="quantity-button"
                  disabled={Number(quantity) >= 99}
                  onClick={() => adjustQuantity(1)}
                  type="button"
                >
                  +
                </button>
              </div>
            </div>
            <button className="add-button" disabled={isSaving} type="submit">
              <span aria-hidden="true">+</span>
              {isSaving ? "Tallennetaan..." : "Lisää listalle"}
            </button>
          </div>
        </form>

        <div className="list-section">
          <div className="list-heading">
            <div>
              <span className="section-kicker">TÄNÄÄN JA SEURAAVAKSI</span>
              <h2>Ostoslista</h2>
            </div>
            <span className="item-count">
              {totalItems} {totalItems === 1 ? "ostos" : "ostosta"}
            </span>
          </div>

          {error && (
            <div className="error-message" role="alert">
              <span>{error}</span>
              {isLoading && (
                <button className="retry-button" onClick={loadGroceries} type="button">
                  Yritä uudelleen
                </button>
              )}
            </div>
          )}

          {isLoading ? (
            <p className="empty-state">Ladataan ostoksia...</p>
          ) : groceries.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon" aria-hidden="true">
                ✳
              </span>
              <strong>Lista odottaa ensimmäistä ostosta</strong>
              <span>Lisää tuote yllä olevalla lomakkeella.</span>
            </div>
          ) : (
            <ul className="grocery-list">
              {orderedGroceries.map((grocery) => {
                const isPurchased = Boolean(grocery.is_purchased);
                return (
                  <li
                    className={`grocery-item${isPurchased ? " is-purchased" : ""}`}
                    key={grocery.id}
                  >
                    <button
                      aria-label={
                        isPurchased
                          ? `Merkitse ${grocery.name} ostamattomaksi`
                          : `Merkitse ${grocery.name} ostetuksi`
                      }
                      aria-pressed={isPurchased}
                      className={`item-check${isPurchased ? " is-checked" : ""}`}
                      disabled={updatingIds.has(grocery.id)}
                      onClick={() => togglePurchased(grocery)}
                      type="button"
                    >
                      {isPurchased ? "✓" : ""}
                    </button>
                    <span className="item-name">{grocery.name}</span>
                    <span className="item-quantity">{grocery.quantity}</span>
                    <button
                      aria-label={`Poista ${grocery.name}`}
                      className="remove-button"
                      onClick={() => removeGrocery(grocery.id)}
                      type="button"
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="card-footer">
          <span className="footer-check" aria-hidden="true">
            ✓
          </span>
          Ostoksesi tallentuvat automaattisesti.
        </footer>
      </section>

      <p className="page-note">Yksi hyvä ostoslista tekee arjesta vähän helpompaa.</p>
    </main>
  );
}

export default App;
