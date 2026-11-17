// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.jsx";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Ostoslistan tyhjä näkymä", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [],
      }),
    );
  });

  it("näyttää tyhjän listan ohjetekstin, kun ostoksia ei ole", async () => {
    render(<App />);

    expect(await screen.findByText("Lista odottaa ensimmäistä ostosta"))
      .toBeInTheDocument();
    expect(screen.getByText("Lisää tuote yllä olevalla lomakkeella."))
      .toBeInTheDocument();
    expect(screen.getByText("0 ostosta")).toBeInTheDocument();
  });
});

describe("Ostoksen lisääminen", () => {
  it("lisää tuotteen listalle lomakkeen kautta", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => ({
            id: 1,
            name: "Kaurajuoma",
            quantity: 2,
            is_purchased: 0,
          }),
        }),
    );

    render(<App />);
    await screen.findByText("Lista odottaa ensimmäistä ostosta");

    fireEvent.change(screen.getByLabelText("Tuotteen nimi"), {
      target: { value: "Kaurajuoma" },
    });
    fireEvent.change(screen.getByLabelText("Määrä"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lisää listalle" }));

    expect(await screen.findByText("Kaurajuoma")).toBeInTheDocument();
    expect(screen.getByText("2", { selector: ".item-quantity" }))
      .toBeInTheDocument();
    expect(screen.getByText("1 ostos")).toBeInTheDocument();
  });
});
