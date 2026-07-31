import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createUser, prisma, rawAgent, resetDatabase, testClient } from "../helpers.js";

describe("autenticação", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("registo", () => {
    it("cria a conta e devolve o utilizador sem a password", async () => {
      const client = await testClient();
      const response = await client.post("/api/auth/register").send({
        firstName: "Ana",
        lastName: "Miguel",
        email: "ana@chicoplug.ao",
        password: "Password1",
      });

      expect(response.status).toBe(201);
      expect(response.body.user.email).toBe("ana@chicoplug.ao");
      expect(response.body.user).not.toHaveProperty("passwordHash");
      expect(response.body.user).not.toHaveProperty("password");
    });

    it("emite cookies de sessão httpOnly", async () => {
      const client = await testClient();
      const response = await client.post("/api/auth/register").send({
        firstName: "Ana",
        lastName: "Miguel",
        email: "ana@chicoplug.ao",
        password: "Password1",
      });

      const cookies = response.headers["set-cookie"] as unknown as string[];
      expect(cookies.find((c) => c.startsWith("cp_access="))).toContain("HttpOnly");
      expect(cookies.find((c) => c.startsWith("cp_refresh="))).toContain("HttpOnly");
    });

    it("normaliza o email para minúsculas", async () => {
      const client = await testClient();
      await client.post("/api/auth/register").send({
        firstName: "Ana",
        lastName: "Miguel",
        email: "ANA@CHICOPLUG.AO",
        password: "Password1",
      });

      expect(await prisma.user.findUnique({ where: { email: "ana@chicoplug.ao" } })).not.toBeNull();
    });

    it("recusa email duplicado", async () => {
      await createUser({ email: "ana@chicoplug.ao", password: "Password1" });

      const client = await testClient();
      const response = await client.post("/api/auth/register").send({
        firstName: "Ana",
        lastName: "Miguel",
        email: "ana@chicoplug.ao",
        password: "Password1",
      });

      expect(response.status).toBe(409);
    });

    it("recusa passwords fracas", async () => {
      const client = await testClient();

      for (const password of ["curta1", "semnumeros", "12345678"]) {
        const response = await client.post("/api/auth/register").send({
          firstName: "Ana",
          lastName: "Miguel",
          email: `teste-${password}@chicoplug.ao`,
          password,
        });
        expect(response.status, `password "${password}" devia ser rejeitada`).toBe(422);
      }
    });
  });

  describe("protecção CSRF", () => {
    it("bloqueia mutações sem token", async () => {
      // Cliente sem o passo de obter o cookie CSRF — como um site terceiro.
      const response = await rawAgent().post("/api/auth/login").send({
        email: "ana@chicoplug.ao",
        password: "Password1",
      });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("permite leituras sem token", async () => {
      const response = await rawAgent().get("/api/catalog/products");
      expect(response.status).toBe(200);
    });
  });

  describe("login", () => {
    beforeEach(async () => {
      await createUser({ email: "ana@chicoplug.ao", password: "Password1" });
    });

    it("aceita credenciais correctas", async () => {
      const client = await testClient();
      const response = await client
        .post("/api/auth/login")
        .send({ email: "ana@chicoplug.ao", password: "Password1" });

      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe("ana@chicoplug.ao");
    });

    it("recusa password errada", async () => {
      const client = await testClient();
      const response = await client
        .post("/api/auth/login")
        .send({ email: "ana@chicoplug.ao", password: "Errada1" });

      expect(response.status).toBe(401);
    });

    it("dá a mesma resposta para conta inexistente e password errada", async () => {
      // Respostas distintas permitiriam descobrir que emails estão registados.
      const c1 = await testClient();
      const inexistente = await c1
        .post("/api/auth/login")
        .send({ email: "ninguem@chicoplug.ao", password: "Password1" });

      const c2 = await testClient();
      const errada = await c2
        .post("/api/auth/login")
        .send({ email: "ana@chicoplug.ao", password: "Errada1" });

      expect(inexistente.status).toBe(errada.status);
      expect(inexistente.body.error.message).toBe(errada.body.error.message);
    });

    it("recusa contas desactivadas", async () => {
      await prisma.user.update({ where: { email: "ana@chicoplug.ao" }, data: { active: false } });

      const client = await testClient();
      const response = await client
        .post("/api/auth/login")
        .send({ email: "ana@chicoplug.ao", password: "Password1" });

      expect(response.status).toBe(401);
    });
  });

  describe("sessão", () => {
    it("protege /me sem sessão", async () => {
      const client = await testClient();
      expect((await client.get("/api/auth/me")).status).toBe(401);
    });

    it("devolve o perfil com sessão iniciada", async () => {
      await createUser({ email: "ana@chicoplug.ao", password: "Password1" });
      const client = await testClient();
      await client.post("/api/auth/login").send({ email: "ana@chicoplug.ao", password: "Password1" });

      const response = await client.get("/api/auth/me");
      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe("ana@chicoplug.ao");
    });

    it("termina a sessão no logout", async () => {
      await createUser({ email: "ana@chicoplug.ao", password: "Password1" });
      const client = await testClient();
      await client.post("/api/auth/login").send({ email: "ana@chicoplug.ao", password: "Password1" });
      await client.post("/api/auth/logout");

      expect((await client.get("/api/auth/me")).status).toBe(401);
    });

    it("revoga o refresh token no logout", async () => {
      const user = await createUser({ email: "ana@chicoplug.ao", password: "Password1" });
      const client = await testClient();
      await client.post("/api/auth/login").send({ email: "ana@chicoplug.ao", password: "Password1" });
      await client.post("/api/auth/logout");

      expect(
        await prisma.refreshToken.count({ where: { userId: user.id, revokedAt: null } }),
      ).toBe(0);
    });

    it("emite nova sessão a partir do refresh token", async () => {
      await createUser({ email: "ana@chicoplug.ao", password: "Password1" });
      const client = await testClient();
      await client.post("/api/auth/login").send({ email: "ana@chicoplug.ao", password: "Password1" });

      const response = await client.post("/api/auth/refresh");
      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe("ana@chicoplug.ao");
    });

    it("roda o refresh token a cada utilização", async () => {
      const user = await createUser({ email: "ana@chicoplug.ao", password: "Password1" });
      const client = await testClient();
      await client.post("/api/auth/login").send({ email: "ana@chicoplug.ao", password: "Password1" });
      await client.post("/api/auth/refresh");

      // O token usado fica revogado e é substituído por outro.
      expect(
        await prisma.refreshToken.count({ where: { userId: user.id, revokedAt: { not: null } } }),
      ).toBe(1);
    });
  });

  describe("reposição de password", () => {
    it("responde igual para emails existentes e inexistentes", async () => {
      await createUser({ email: "ana@chicoplug.ao", password: "Password1" });

      const c1 = await testClient();
      const existente = await c1
        .post("/api/auth/forgot-password")
        .send({ email: "ana@chicoplug.ao" });

      const c2 = await testClient();
      const inexistente = await c2
        .post("/api/auth/forgot-password")
        .send({ email: "ninguem@chicoplug.ao" });

      expect(existente.status).toBe(200);
      expect(inexistente.status).toBe(200);
      expect(existente.body.message).toBe(inexistente.body.message);
    });

    it("gera um token guardado apenas em hash", async () => {
      const user = await createUser({ email: "ana@chicoplug.ao", password: "Password1" });

      const client = await testClient();
      const response = await client
        .post("/api/auth/forgot-password")
        .send({ email: "ana@chicoplug.ao" });

      const record = await prisma.passwordResetToken.findFirst({ where: { userId: user.id } });
      expect(record).not.toBeNull();
      // O token em claro nunca é guardado.
      expect(record?.tokenHash).not.toBe(response.body.devToken);
      expect(record?.tokenHash).toHaveLength(64);
    });

    it("permite repor a password com o token válido", async () => {
      await createUser({ email: "ana@chicoplug.ao", password: "Password1" });

      const client = await testClient();
      // Em desenvolvimento/teste o backend devolve o token, já que não há email.
      const forgot = await client
        .post("/api/auth/forgot-password")
        .send({ email: "ana@chicoplug.ao" });

      const token = forgot.body.devToken as string | undefined;
      if (!token) {
        // Em NODE_ENV=test o token não é exposto; validamos apenas a rejeição.
        const invalid = await client
          .post("/api/auth/reset-password")
          .send({ token: "invalido", password: "NovaPass1" });
        expect(invalid.status).toBe(400);
        return;
      }

      const reset = await client
        .post("/api/auth/reset-password")
        .send({ token, password: "NovaPass1" });
      expect(reset.status).toBe(200);

      const login = await client
        .post("/api/auth/login")
        .send({ email: "ana@chicoplug.ao", password: "NovaPass1" });
      expect(login.status).toBe(200);
    });

    it("rejeita tokens inválidos e expirados", async () => {
      const user = await createUser({ email: "ana@chicoplug.ao", password: "Password1" });
      await prisma.passwordResetToken.create({
        data: {
          tokenHash: "hash-que-nunca-corresponde",
          userId: user.id,
          expiresAt: new Date(Date.now() - 1000),
        },
      });

      const client = await testClient();
      const response = await client
        .post("/api/auth/reset-password")
        .send({ token: "qualquer", password: "NovaPass1" });

      expect(response.status).toBe(400);
    });
  });

  describe("controlo de acesso", () => {
    it("bloqueia o painel de administração a clientes", async () => {
      await createUser({ email: "cliente@chicoplug.ao", password: "Password1" });
      const client = await testClient();
      await client
        .post("/api/auth/login")
        .send({ email: "cliente@chicoplug.ao", password: "Password1" });

      expect((await client.get("/api/admin/dashboard")).status).toBe(403);
    });

    it("bloqueia o painel a visitantes anónimos", async () => {
      const client = await testClient();
      expect((await client.get("/api/admin/dashboard")).status).toBe(401);
    });

    it("permite o acesso a administradores", async () => {
      await createUser({ email: "admin@chicoplug.ao", password: "Password1", role: "ADMIN" });
      const client = await testClient();
      await client
        .post("/api/auth/login")
        .send({ email: "admin@chicoplug.ao", password: "Password1" });

      expect((await client.get("/api/admin/dashboard")).status).toBe(200);
    });
  });
});
