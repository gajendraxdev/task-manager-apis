import type { FastifyReply, FastifyRequest } from "fastify";
import { HTTP_STATUS } from "../../constants/HTTP_STATUS.ts";
import { ERROR_CODES } from "../../constants/constants.ts";
import { AppError } from "../utils/AppError.ts";
import { sendSuccess } from "../utils/response.ts";
import {
  TaskPriority,
  TaskStatus,
  type TaskCreateT,
  type TaskParamsT,
  type TaskQueryT,
  type TaskUpdateT,
} from "./schema.ts";
import prisma from "../../lib/prisma.ts";
import type { Prisma } from "../../generated/prisma/client.js";

// ─── Create Task ──────────────────────────────────────────────────────────────
export const createTask = async (
  req: FastifyRequest<{ Body: TaskCreateT }>,
  reply: FastifyReply,
): Promise<FastifyReply> => {
  const { body } = req;

  const task = await prisma.task.create({
    data: {
      title: body.title,
      description: body.description,
      priority: (body.priority || TaskPriority.low) as any,
      status: (body.status || TaskStatus.todo) as any,
      deadLine: body.deadLine,
      workspace: body.workspace || "",
      createdById: body.createdBy,
    },
  });

  if (body.dependsOn?.length) {
    await prisma.taskDependency.createMany({
      data: body.dependsOn.map((depId) => ({
        dependentTaskId: task.id,
        dependencyTaskId: depId,
      })),
      skipDuplicates: true,
    });
  }

  const fullTask = await getTaskWithRelations(task.id);

  return sendSuccess(reply, serializeTask(fullTask), HTTP_STATUS.CREATED);
};

// ─── Get All Tasks ────────────────────────────────────────────────────────────
export const getAllTasks = async (
  req: FastifyRequest<{ Querystring: TaskQueryT }>,
  reply: FastifyReply,
) => {
  const { query } = req;

  const where = buildTaskWhereClause(query);

  const orderBy: Prisma.TaskOrderByWithRelationInput = {
    createdAt: query.sort === "1" ? "asc" : "desc",
  };

  const tasks = await prisma.task.findMany({
    where,
    orderBy,
    include: {
      dependsOn: { include: { dependencyTask: true } },
      attachments: true,
    },
  });

  return sendSuccess(reply, tasks.map(serializeTask));
};

// ─── Get One Task ─────────────────────────────────────────────────────────────
export const getOneTasks = async (
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) => {
  const { id } = req.params;

  const task = await getTaskWithRelations(id);

  if (!task) {
    throw new AppError("Task not found", HTTP_STATUS.NOT_FOUND, ERROR_CODES.TASK_NOT_FOUND);
  }

  return sendSuccess(reply, serializeTask(task));
};

// ─── Update Task ──────────────────────────────────────────────────────────────
export const updateTask = async (
  req: FastifyRequest<{ Params: TaskParamsT; Body: TaskUpdateT }>,
  reply: FastifyReply,
) => {
  const { params, body } = req;

  const existing = await prisma.task.findUnique({ where: { id: params.id } });
  if (!existing) {
    throw new AppError("Task not found", HTTP_STATUS.NOT_FOUND, ERROR_CODES.TASK_NOT_FOUND);
  }

  const updateData: Prisma.TaskUpdateInput = {};

  if (body.title !== undefined) updateData.title = body.title;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.priority !== undefined) updateData.priority = body.priority as any;
  if (body.status !== undefined) updateData.status = body.status as any;
  if (body.deadLine !== undefined) updateData.deadLine = body.deadLine;
  if (body.tag !== undefined) updateData.tag = body.tag;
  if (body.assignedTo !== undefined) {
    updateData.assignedTo = body.assignedTo
      ? { connect: { id: body.assignedTo } }
      : { disconnect: true };
  }

  const task = await prisma.task.update({
    where: { id: params.id },
    data: updateData,
  });

  if (body.dependsOn !== undefined) {
    await prisma.taskDependency.deleteMany({ where: { dependentTaskId: params.id } });

    if (body.dependsOn.length > 0) {
      const uniqueDeps = [...new Set(body.dependsOn.map(String))];
      await prisma.taskDependency.createMany({
        data: uniqueDeps.map((depId) => ({
          dependentTaskId: params.id,
          dependencyTaskId: depId,
        })),
        skipDuplicates: true,
      });
    }
  }

  const fullTask = await getTaskWithRelations(task.id);

  return sendSuccess(reply, serializeTask(fullTask));
};

// ─── Delete Task ──────────────────────────────────────────────────────────────
export const deleteTask = async (
  req: FastifyRequest<{ Params: TaskParamsT }>,
  reply: FastifyReply,
) => {
  const { params } = req;

  const task = await prisma.task.findUnique({ where: { id: params.id } });
  if (!task) {
    throw new AppError("Task not found", HTTP_STATUS.NOT_FOUND, ERROR_CODES.TASK_NOT_FOUND);
  }

  await prisma.task.delete({ where: { id: params.id } });

  return sendSuccess(reply, task);
};

// ─── Query Builder ────────────────────────────────────────────────────────────

function buildTaskWhereClause(query: TaskQueryT): Prisma.TaskWhereInput {
  const where: Prisma.TaskWhereInput = {};

  if (query.title) where.title = { contains: query.title, mode: "insensitive" };
  if (query.description) where.description = { contains: query.description, mode: "insensitive" };
  if (query.priority) where.priority = query.priority as any;
  if (query.status && query.status !== "all") where.status = query.status as any;
  if (query.tag) where.tag = query.tag;
  if (query.workspace) where.workspace = query.workspace;
  if (query.createdBy) where.createdById = query.createdBy;
  if (query.assignedTo) where.assignedToId = query.assignedTo;
  if (query.assignedBy) where.assignedById = query.assignedBy;

  if (query.deadLine_from || query.deadLine_to) {
    where.deadLine = {
      ...(query.deadLine_from && { gte: new Date(query.deadLine_from).toISOString() }),
      ...(query.deadLine_to && { lte: new Date(query.deadLine_to).toISOString() }),
    } as any;
  }

  if (query.created_from || query.created_to) {
    where.createdAt = {
      ...(query.created_from && { gte: new Date(query.created_from) }),
      ...(query.created_to && { lte: new Date(query.created_to) }),
    } as any;
  }

  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: "insensitive" } },
      { ticket: { contains: query.search, mode: "insensitive" } },
    ];
  }

  if (query.exclude) {
    where.id = { notIn: query.exclude.split(",") };
  }

  return where;
}

// ─── Repository Helper ────────────────────────────────────────────────────────

function getTaskWithRelations(id: string) {
  return prisma.task.findUnique({
    where: { id },
    include: {
      dependsOn: { include: { dependencyTask: true } },
      attachments: true,
    },
  });
}

// ─── Serializer ───────────────────────────────────────────────────────────────

// biome-ignore lint/suspicious/noExplicitAny: Prisma return type is complex
export function serializeTask(task: any) {
  if (!task) return null;

  return {
    _id: task.id,
    id: task.id,
    title: task.title,
    slug: task.slug,
    ticket: task.ticket,
    description: task.description,
    priority: task.priority,
    status: task.status,
    deadLine: task.deadLine,
    tag: task.tag,
    workspace: task.workspace,
    createdBy: task.createdById,
    updatedBy: task.updatedById,
    assignedTo: task.assignedToId,
    assignedBy: task.assignedById,
    dependenciesList: task.dependsOn?.map((d: any) => serializeTask(d.dependencyTask)) ?? [],
    dependsOn: task.dependsOn?.map((d: any) => d.dependencyTaskId) ?? [],
    attachedDocuments: task.attachments ?? [],
    attachments: task.attachments?.map((a: any) => a.id) ?? [],
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}
