import type { OrderStatus } from "@prisma/client";

/**
 * Transições permitidas no ciclo de vida da encomenda.
 *
 * Modelado como grafo explícito, e não como uma lista ordenada, porque o fluxo
 * real não é linear: uma encomenda pode ser cancelada em quase qualquer ponto,
 * mas nunca depois de entregue — uma devolução é outro processo, não um
 * retrocesso de estado.
 */
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  NOVA: ["CONFIRMADA", "CANCELADA"],
  CONFIRMADA: ["EM_PREPARACAO", "CANCELADA"],
  EM_PREPARACAO: ["ENVIADA", "CANCELADA"],
  ENVIADA: ["ENTREGUE", "CANCELADA"],
  ENTREGUE: [],
  CANCELADA: [],
};

/** Estados a partir dos quais o stock ainda não foi consumido definitivamente. */
const RESTOCK_ON_CANCEL: readonly OrderStatus[] = [
  "NOVA",
  "CONFIRMADA",
  "EM_PREPARACAO",
  "ENVIADA",
];

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function allowedTransitions(from: OrderStatus): readonly OrderStatus[] {
  return TRANSITIONS[from];
}

export function isTerminal(status: OrderStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/**
 * O stock só volta ao inventário quando a encomenda é cancelada a partir de um
 * estado em que estava reservado.
 */
export function shouldRestoreStock(from: OrderStatus, to: OrderStatus): boolean {
  return to === "CANCELADA" && RESTOCK_ON_CANCEL.includes(from);
}

/** Rótulos em português apresentados na UI. */
export const STATUS_LABEL: Record<OrderStatus, string> = {
  NOVA: "Nova",
  CONFIRMADA: "Confirmada",
  EM_PREPARACAO: "Em preparação",
  ENVIADA: "Enviada",
  ENTREGUE: "Entregue",
  CANCELADA: "Cancelada",
};

/** Mapeamento para o `tone` do componente Badge existente no frontend. */
export const STATUS_TONE: Record<OrderStatus, "dark" | "brand" | "muted"> = {
  NOVA: "muted",
  CONFIRMADA: "brand",
  EM_PREPARACAO: "brand",
  ENVIADA: "dark",
  ENTREGUE: "dark",
  CANCELADA: "muted",
};
