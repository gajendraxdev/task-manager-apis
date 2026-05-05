import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
	createTask,
	deleteTask,
	getAllTasks,
	getOneTasks,
	updateTask,
} from "./controller.ts";

import { catchHandler } from "../utils/catchHandler.ts";
import { verifyToken } from "../../middleware/auth.ts";
import {
	TaskCreateSchema,
	TaskFailedResponseSchema,
	TaskListResponseSchema,
	TaskParamsSchema,
	TaskQuerySchema,
	TaskSingleResponseSchema,
} from "./schema.ts";
import type {
	TaskCreateT,
	TaskParamsT,
	TaskQueryT,
	TaskUpdateT,
} from "./schema.ts";

export const taskRouter = (
	fastify: FastifyInstance,
	_opts: FastifyPluginOptions,
) => {
	fastify.post<{ Body: TaskCreateT }>(
		"/task",
		{
			preHandler: [verifyToken],
			schema: {
				body: TaskCreateSchema,
				response: {
					201: TaskSingleResponseSchema,
					400: TaskFailedResponseSchema,
					500: TaskFailedResponseSchema,
				},
			},
		},
		catchHandler(createTask),
	);

	fastify.get<{ Querystring: TaskQueryT }>(
		"/task",
		{
			preHandler: [verifyToken],
			schema: {
				querystring: TaskQuerySchema,
				response: {
					200: TaskListResponseSchema,
					400: TaskFailedResponseSchema,
					500: TaskFailedResponseSchema,
				},
			},
		},
		catchHandler(getAllTasks),
	);

	fastify.get<{ Params: TaskParamsT }>(
		"/task/:id",
		{
			preHandler: [verifyToken],
			schema: {
				params: TaskParamsSchema,
				response: {
					200: TaskSingleResponseSchema,
					400: TaskFailedResponseSchema,
					404: TaskFailedResponseSchema,
					500: TaskFailedResponseSchema,
				},
			},
		},
		catchHandler(getOneTasks),
	);

	fastify.patch<{ Params: TaskParamsT; Body: TaskUpdateT }>(
		"/task/:id",
		{
			preHandler: [verifyToken],
			schema: {
				params: TaskParamsSchema,
				response: {
					200: TaskSingleResponseSchema,
					404: TaskFailedResponseSchema,
					400: TaskFailedResponseSchema,
					500: TaskFailedResponseSchema,
				},
			},
		},
		catchHandler(updateTask),
	);

	fastify.delete<{ Params: TaskParamsT }>(
		"/task/:id",
		{
			preHandler: [verifyToken],
			schema: {
				params: TaskParamsSchema,
				response: {
					200: TaskSingleResponseSchema,
					404: TaskFailedResponseSchema,
					400: TaskFailedResponseSchema,
					500: TaskFailedResponseSchema,
				},
			},
		},
		catchHandler(deleteTask),
	);
};
