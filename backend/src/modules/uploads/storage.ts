import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";

import { env } from "../../config/env.js";
import { badRequest } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";

export type StoredImage = {
  url: string;
  publicId: string | null;
  width: number;
  height: number;
  bytes: number;
  format: string;
};

if (env.cloudinaryEnabled) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

const MAX_DIMENSION = 2000;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

/**
 * Optimização antes do upload.
 *
 * Convertemos tudo para WebP: nas fotografias de produto da loja poupa
 * tipicamente 25–35% face a JPEG com qualidade visualmente equivalente, e todos
 * os browsers que o frontend suporta o entendem. O redimensionamento para 2000px
 * evita guardar originais de 6000px que nenhum ecrã vai mostrar.
 */
async function optimize(buffer: Buffer): Promise<{ data: Buffer; width: number; height: number }> {
  const image = sharp(buffer, { failOn: "error" });
  const meta = await image.metadata();

  if (!meta.width || !meta.height) throw badRequest("Ficheiro de imagem inválido.");

  const pipeline = image
    .rotate() // Aplica a orientação EXIF — senão fotos de telemóvel aparecem deitadas.
    .resize({
      width: Math.min(meta.width, MAX_DIMENSION),
      height: Math.min(meta.height, MAX_DIMENSION),
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82, effort: 4 });

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

export function assertValidImage(file: { mimetype: string; size: number }): void {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    throw badRequest("Formato não suportado. Usa JPEG, PNG, WebP ou AVIF.");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw badRequest("A imagem não pode exceder 10 MB.");
  }
}

async function uploadToCloudinary(data: Buffer, folder: string): Promise<StoredImage> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `${env.CLOUDINARY_FOLDER}/${folder}`,
        resource_type: "image",
        format: "webp",
        // Deixa o Cloudinary aplicar a sua própria optimização por dispositivo.
        quality: "auto:good",
        fetch_format: "auto",
        overwrite: false,
        unique_filename: true,
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Upload para o Cloudinary falhou."));
          return;
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          bytes: result.bytes,
          format: result.format,
        });
      },
    );
    stream.end(data);
  });
}

async function uploadToLocalDisk(
  data: Buffer,
  folder: string,
  dimensions: { width: number; height: number },
): Promise<StoredImage> {
  const dir = path.resolve(process.cwd(), "uploads", folder);
  await fs.mkdir(dir, { recursive: true });

  const filename = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.webp`;
  await fs.writeFile(path.join(dir, filename), data);

  return {
    // Servido por `express.static` em /static/uploads (ver app.ts).
    url: `/static/uploads/${folder}/${filename}`,
    publicId: null,
    width: dimensions.width,
    height: dimensions.height,
    bytes: data.byteLength,
    format: "webp",
  };
}

/**
 * Guarda uma imagem, usando o Cloudinary quando configurado e o disco local
 * caso contrário. O chamador não precisa de saber qual dos dois — é o que
 * permite desenvolver hoje e ligar o Cloudinary sem alterar código.
 */
export async function storeImage(
  buffer: Buffer,
  folder: "produtos" | "marcas",
): Promise<StoredImage> {
  const optimized = await optimize(buffer);

  if (env.cloudinaryEnabled) {
    try {
      return await uploadToCloudinary(optimized.data, folder);
    } catch (error) {
      logger.error("Cloudinary indisponível — a gravar localmente", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return uploadToLocalDisk(optimized.data, folder, optimized);
}

/** Remove o ficheiro remoto. Ficheiros locais ficam — são baratos e recuperáveis. */
export async function deleteImage(publicId: string | null): Promise<void> {
  if (!publicId || !env.cloudinaryEnabled) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    // Não bloqueamos a remoção do produto por causa de um ficheiro órfão.
    logger.warn("Falha ao remover imagem do Cloudinary", {
      publicId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export function getStorageStatus(): { provider: string; configured: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!env.CLOUDINARY_CLOUD_NAME) missing.push("CLOUDINARY_CLOUD_NAME");
  if (!env.CLOUDINARY_API_KEY) missing.push("CLOUDINARY_API_KEY");
  if (!env.CLOUDINARY_API_SECRET) missing.push("CLOUDINARY_API_SECRET");

  return {
    provider: env.cloudinaryEnabled ? "cloudinary" : "local",
    configured: env.cloudinaryEnabled,
    missing,
  };
}
