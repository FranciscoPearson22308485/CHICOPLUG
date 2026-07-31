import type { PaymentStatus } from "@prisma/client";

/**
 * Porta de pagamentos.
 *
 * A loja fala sempre com esta interface, nunca com a EMIS directamente. É o que
 * permite ter hoje um simulador local totalmente funcional e ligar o Multicaixa
 * Express amanhã trocando uma variável de ambiente — sem tocar no checkout, nas
 * encomendas ou no frontend.
 */

export type InitiateInput = {
  /** Referência única da tentativa de pagamento (chave de idempotência). */
  reference: string;
  amount: number;
  currency: string;
  orderReference: string;
  customerPhone: string;
  customerEmail: string;
  description: string;
};

export type InitiateResult = {
  /** Identificador atribuído pelo provedor (token EMIS, id de transacção…). */
  providerRef: string | null;
  status: PaymentStatus;
  /** Para onde enviar o cliente, quando o provedor usa página alojada. */
  redirectUrl?: string | null;
  /** Momento a partir do qual a tentativa deixa de ser válida. */
  expiresAt?: Date | null;
  raw: unknown;
};

export type StatusResult = {
  status: PaymentStatus;
  providerRef?: string | null;
  failureReason?: string | null;
  raw: unknown;
};

export type CallbackResult = {
  /** Referência da nossa tentativa, extraída do payload do provedor. */
  reference: string;
  status: PaymentStatus;
  providerRef?: string | null;
  failureReason?: string | null;
  raw: unknown;
};

export interface PaymentProvider {
  readonly name: string;

  /** Falso quando faltam credenciais — a UI mostra o estado em vez de falhar. */
  isConfigured(): boolean;

  initiate(input: InitiateInput): Promise<InitiateResult>;

  /** Consulta activa do estado (polling), para quando o callback não chega. */
  getStatus(payment: { reference: string; providerRef: string | null }): Promise<StatusResult>;

  /**
   * Valida e interpreta um callback/webhook. Devolver `null` significa payload
   * não reconhecido ou assinatura inválida — nunca confiar sem verificar.
   */
  parseCallback(payload: unknown, headers: Record<string, string | string[] | undefined>): CallbackResult | null;

  /** Cancelamento explícito, quando o provedor o suporta. */
  cancel?(payment: { reference: string; providerRef: string | null }): Promise<StatusResult>;
}
