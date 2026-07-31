import { describe, expect, it } from "vitest";

import {
  allowedTransitions,
  canTransition,
  isTerminal,
  shouldRestoreStock,
  STATUS_LABEL,
} from "../../src/modules/orders/order-status.js";

describe("máquina de estados de encomendas", () => {
  it("permite o percurso feliz completo", () => {
    expect(canTransition("NOVA", "CONFIRMADA")).toBe(true);
    expect(canTransition("CONFIRMADA", "EM_PREPARACAO")).toBe(true);
    expect(canTransition("EM_PREPARACAO", "ENVIADA")).toBe(true);
    expect(canTransition("ENVIADA", "ENTREGUE")).toBe(true);
  });

  it("recusa saltar etapas", () => {
    expect(canTransition("NOVA", "ENVIADA")).toBe(false);
    expect(canTransition("NOVA", "ENTREGUE")).toBe(false);
    expect(canTransition("CONFIRMADA", "ENTREGUE")).toBe(false);
  });

  it("recusa retroceder", () => {
    expect(canTransition("ENVIADA", "EM_PREPARACAO")).toBe(false);
    expect(canTransition("ENTREGUE", "ENVIADA")).toBe(false);
    expect(canTransition("CONFIRMADA", "NOVA")).toBe(false);
  });

  it("permite cancelar em qualquer ponto antes da entrega", () => {
    for (const from of ["NOVA", "CONFIRMADA", "EM_PREPARACAO", "ENVIADA"] as const) {
      expect(canTransition(from, "CANCELADA")).toBe(true);
    }
  });

  it("trata entregue e cancelada como estados finais", () => {
    expect(isTerminal("ENTREGUE")).toBe(true);
    expect(isTerminal("CANCELADA")).toBe(true);
    expect(allowedTransitions("ENTREGUE")).toHaveLength(0);
    expect(allowedTransitions("CANCELADA")).toHaveLength(0);
  });

  it("nunca reabre uma encomenda entregue — uma devolução é outro processo", () => {
    expect(canTransition("ENTREGUE", "CANCELADA")).toBe(false);
  });

  it("nunca ressuscita uma encomenda cancelada", () => {
    for (const to of ["NOVA", "CONFIRMADA", "EM_PREPARACAO", "ENVIADA", "ENTREGUE"] as const) {
      expect(canTransition("CANCELADA", to)).toBe(false);
    }
  });

  describe("reposição de stock", () => {
    it("repõe ao cancelar a partir de estados com stock reservado", () => {
      for (const from of ["NOVA", "CONFIRMADA", "EM_PREPARACAO", "ENVIADA"] as const) {
        expect(shouldRestoreStock(from, "CANCELADA")).toBe(true);
      }
    });

    it("não repõe em transições que não são cancelamento", () => {
      expect(shouldRestoreStock("NOVA", "CONFIRMADA")).toBe(false);
      expect(shouldRestoreStock("ENVIADA", "ENTREGUE")).toBe(false);
    });

    it("não repõe a partir de um estado já final", () => {
      expect(shouldRestoreStock("ENTREGUE", "CANCELADA")).toBe(false);
      expect(shouldRestoreStock("CANCELADA", "CANCELADA")).toBe(false);
    });
  });

  it("tem rótulo em português para todos os estados", () => {
    const states = ["NOVA", "CONFIRMADA", "EM_PREPARACAO", "ENVIADA", "ENTREGUE", "CANCELADA"] as const;
    for (const state of states) {
      expect(STATUS_LABEL[state]).toBeTruthy();
    }
    expect(STATUS_LABEL.EM_PREPARACAO).toBe("Em preparação");
  });
});
