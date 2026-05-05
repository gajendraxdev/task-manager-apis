import type { FastifyReply, FastifyRequest } from "fastify";
import {
  genSignedDownloadUrl,
  removeFile,
  uploadFile,
} from "../../lib/storageProvider.ts";
import { HTTP_STATUS } from "../../constants/HTTP_STATUS.ts";
import { ERROR_CODES } from "../../constants/constants.ts";
import { AppError } from "../utils/AppError.ts";
import { sendSuccess } from "../utils/response.ts";
import type { AnyType } from "../../types/types.ts";
import prisma from "../../lib/prisma.ts";

// ─── Add Document ─────────────────────────────────────────────────────────────
export const addDocument = async (
  req: FastifyRequest<{ Body: { for: AnyType; document: AnyType } }>,
  reply: FastifyReply,
) => {
  const { body } = req;
  const fileData = await body.document;
  const taskId = body?.for?.value;

  if (!taskId) {
    throw new AppError("Please specify a task", HTTP_STATUS.BAD_REQUEST);
  }

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    throw new AppError("Task does not exist", HTTP_STATUS.BAD_REQUEST, ERROR_CODES.TASK_NOT_FOUND);
  }

  const filebuffer = await fileData?.toBuffer();
  const file = { originalname: fileData?.filename, buffer: filebuffer };

  const uploadResp = await uploadFile(file);
  if (uploadResp.error) throw new AppError(uploadResp.error);
  if (!uploadResp.data) throw new AppError("Upload failed: no data returned.");

  const document = await prisma.document.create({
    data: {
      originalname: file.originalname,
      name: uploadResp.data.filename,
      path: uploadResp.data.filename,
      type: fileData?.mimetype,
      url: "",
      taskId,
    },
  });

  return sendSuccess(reply, serializeDocument(document), HTTP_STATUS.CREATED);
};

// ─── Get Document ─────────────────────────────────────────────────────────────
export const getDocument = async (
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) => {
  const { id } = req.params;

  const document = await prisma.document.findFirst({
    where: { OR: [{ id }, { name: id }] },
  });

  if (!document) {
    throw new AppError("Document not found", HTTP_STATUS.NOT_FOUND, ERROR_CODES.DOCUMENT_NOT_FOUND);
  }

  return sendSuccess(reply, serializeDocument(document));
};

// ─── Get Signed URL ───────────────────────────────────────────────────────────
export const getSignedUrl = async (
  req: FastifyRequest<{ Body: { filename: string } }>,
  reply: FastifyReply,
) => {
  const { filename } = req.body;

  if (!filename) throw new AppError("Please provide the file name", HTTP_STATUS.BAD_REQUEST);

  const data = await genSignedDownloadUrl(filename);
  if (data.error) throw new AppError(data.error);

  return sendSuccess(reply, { url: data.url });
};

// ─── Delete Document ──────────────────────────────────────────────────────────
export const deleteDocument = async (
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) => {
  const { id } = req.params;

  const document = await prisma.document.findUnique({ where: { id } });
  if (!document) {
    throw new AppError("File does not exist", HTTP_STATUS.NOT_FOUND, ERROR_CODES.DOCUMENT_NOT_FOUND);
  }

  const deleteInfo = await removeFile(document.name);
  if (deleteInfo.error) throw new AppError(deleteInfo.error);

  await prisma.document.delete({ where: { id } });

  return sendSuccess(reply, { deleted: true, id });
};

// ─── Serializer ───────────────────────────────────────────────────────────────

// biome-ignore lint/suspicious/noExplicitAny: Prisma return type
export function serializeDocument(doc: any) {
  return {
    _id: doc.id,
    id: doc.id,
    originalname: doc.originalname,
    name: doc.name,
    path: doc.path,
    type: doc.type,
    url: doc.url,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
