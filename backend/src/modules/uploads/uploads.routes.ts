import { Router } from "express";
import multer from "multer";
import { z } from "zod";

import { asyncHandler } from "../../lib/async-handler.js";
import { badRequest } from "../../lib/errors.js";
import { authenticate, requireAdmin } from "../../middleware/auth.js";
import { uploadLimiter } from "../../middleware/rate-limit.js";
import { validate } from "../../middleware/validate.js";
import { assertValidImage, getStorageStatus, storeImage } from "./storage.js";

export const uploadsRouter = Router();

// Guardamos em memória: os ficheiros são pequenos e passam logo pelo Sharp,
// evitando ficheiros temporários por limpar.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 8 },
});

uploadsRouter.use(authenticate, requireAdmin);

uploadsRouter.get("/status", (_req, res) => {
  res.json(getStorageStatus());
});

const folderSchema = z.object({
  folder: z.enum(["produtos", "coleccoes"]).default("produtos"),
});

uploadsRouter.post(
  "/images",
  uploadLimiter,
  upload.array("files", 8),
  validate({ query: folderSchema }),
  asyncHandler(async (req, res) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) throw badRequest("Nenhum ficheiro recebido.");

    const folder = (req.query as unknown as { folder: "produtos" | "coleccoes" }).folder;

    for (const file of files) assertValidImage(file);

    const images = await Promise.all(files.map((file) => storeImage(file.buffer, folder)));

    res.status(201).json({ images });
  }),
);
