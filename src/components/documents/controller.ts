import type { FastifyReply, FastifyRequest } from "fastify";
import {
  genSignedDownloadUrl,
  removeFile,
  uploadFile,
} from "../../lib/storageProvider.ts";
import { HTTP_STATUS } from "../../constants/HTTP_STATUS.ts";
import { AppError } from "../utils/AppError.ts";
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
    throw new AppError("Please specify task", HTTP_STATUS.BAD_REQUEST);
  }

  // Verify task exists
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    throw new AppError("The task does not exist", HTTP_STATUS.BAD_REQUEST);
  }

  const filebuffer = await fileData?.toBuffer();
  const file = {
    originalname: fileData?.filename,
    buffer: filebuffer,
  };

  const uploadResp = await uploadFile(file);
  if (uploadResp.error) throw new AppError(uploadResp.error);
  if (!uploadResp.data) throw new AppError("Upload failed: No data returned.");

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

  return reply.status(HTTP_STATUS.OK).send({
    status: true,
    data: serializeDocument(document),
    error: null,
    statusCode: HTTP_STATUS.OK,
  });
};

// ─── Get Document ─────────────────────────────────────────────────────────────
export const getDocument = async (
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) => {
  const { id } = req.params;

  // Try by id first, then by name
  const document = await prisma.document.findFirst({
    where: { OR: [{ id }, { name: id }] },
  });

  if (!document) throw new AppError("Document not found", 404);

  return reply.status(HTTP_STATUS.OK).send({
    status: true,
    data: serializeDocument(document),
    error: null,
    statusCode: HTTP_STATUS.OK,
  });
};

// ─── Get Signed URL ───────────────────────────────────────────────────────────
export const getSignedUrl = async (
  req: FastifyRequest<{ Body: { filename: string } }>,
  reply: FastifyReply,
) => {
  const { filename } = req.body;

  if (!filename) throw new AppError("Please provide the file name", 400);

  const data = await genSignedDownloadUrl(filename);
  if (data.error) throw new AppError(data.error);

  return reply.status(HTTP_STATUS.OK).send({
    status: true,
    statusCode: HTTP_STATUS.OK,
    data: { url: data.url },
    error: null,
  });
};

// ─── Delete Document ──────────────────────────────────────────────────────────
export const deleteDocument = async (
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) => {
  const { id } = req.params;

  const document = await prisma.document.findUnique({ where: { id } });
  if (!document) {
    throw new AppError("File does not exist", HTTP_STATUS.NOT_FOUND);
  }

  const deleteInfo = await removeFile(document.name);
  if (deleteInfo.error) throw new AppError(deleteInfo.error);

  await prisma.document.delete({ where: { id } });

  return reply.status(HTTP_STATUS.OK).send({
    status: true,
    data: { deleted: true, id },
    statusCode: HTTP_STATUS.OK,
    error: null,
  });
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function serializeDocument(doc: any) {
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
