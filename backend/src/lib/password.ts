import bcrypt from "bcryptjs";

import { env } from "../config/env.js";

// 12 rondas é o compromisso actual entre custo e segurança. Nos testes baixamos
// para 4: com 12 rondas uma suite com dezenas de registos leva minutos.
const ROUNDS = env.isTest ? 4 : 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Consome sempre tempo comparável a uma verificação real. Sem isto, um login
 * com email inexistente responde muito mais depressa do que um com password
 * errada — e isso permite enumerar contas registadas cronometrando respostas.
 */
export async function fakeVerifyPassword(): Promise<void> {
  await bcrypt.compare(
    "senha-inexistente",
    "$2a$12$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ012",
  );
}
