import { type Static, type TSchema, Type } from "@sinclair/typebox";

export enum TaskPriority {
  high = "high",
  medium = "medium",
  low = "low",
}

export enum TaskStatus {
  done = "done",
  inprogress = "inprogress",
  todo = "todo",
  all = "all",
  overdue = "overdue",
}

export const TaskCreateSchema = Type.Object({
  title: Type.String(),
  description: Type.Optional(Type.String()),
  priority: Type.Enum(TaskPriority),
  status: Type.Enum(TaskStatus),
  deadLine: Type.String(),

  workspace: Type.Optional(Type.String()),
  dependsOn: Type.Optional(Type.Array(Type.String())),

  createdBy: Type.Optional(Type.String()),

  createdAt: Type.Optional(Type.String()),
  updatedAt: Type.Optional(Type.String()),
});

export const TaskUpdateSchema = Type.Object({
  title: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  priority: Type.Optional(Type.Enum(TaskPriority)),
  status: Type.Optional(Type.Enum(TaskStatus)),
  deadLine: Type.Optional(Type.String()),
  assignedTo: Type.Optional(Type.String()),
  attachments: Type.Optional(Type.Array(Type.String())),
  tag: Type.Optional(Type.String()),
  dependsOn: Type.Optional(Type.Array(Type.String())),

  updatedAt: Type.Optional(Type.String()),
});

export const TaskQuerySchema = Type.Object({
  title: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  priority: Type.Optional(Type.Enum(TaskPriority)),
  status: Type.Optional(Type.Enum(TaskStatus)),

  tag: Type.Optional(Type.String()),
  workspace: Type.Optional(Type.String()),

  assignedTo: Type.Optional(Type.String()),
  assignedBy: Type.Optional(Type.String()),

  createdBy: Type.Optional(Type.String()),
  updatedBy: Type.Optional(Type.String()),
  sort: Type.Optional(Type.String()),
  search: Type.Optional(Type.String()),

  $or: Type.Optional(Type.Any()),
  $nin: Type.Optional(Type.Any()),
  $in: Type.Optional(Type.Any()),
  _id: Type.Optional(Type.Any()),

  page: Type.Optional(Type.String()),
  limit: Type.Optional(Type.String()),

  deadLine: Type.Optional(Type.Any()),
  createdAt: Type.Optional(Type.Any()),

  slug: Type.Optional(Type.String()),
  ticket: Type.Optional(Type.String()),

  exclude: Type.Optional(Type.String()),

  deadLine_from: Type.Optional(Type.String()),
  deadLine_to: Type.Optional(Type.String()),
  created_from: Type.Optional(Type.String()),
  created_to: Type.Optional(Type.String()),
});

export const TaskParamsSchema = Type.Object({
  id: Type.String(),
});

export const TaskSchema = Type.Object({
  _id: Type.String(),
  title: Type.String(),
  slug: Type.Optional(Type.String()),
  ticket: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  priority: Type.Enum(TaskPriority),
  status: Type.Enum(TaskStatus),
  deadLine: Type.String(),

  tag: Type.Optional(Type.String()),
  workspace: Type.String(),

  dependsOn: Type.Optional(Type.Array(Type.String())),
  dependenciesList: Type.Optional(Type.Array(Type.Any())),
  attachedDocuments: Type.Optional(Type.Array(Type.Any())),

  createdBy: Type.Optional(Type.String()),
  updatedBy: Type.Optional(Type.String()),
  assignedTo: Type.Optional(Type.String()),
  assignedBy: Type.Optional(Type.String()),
  comments: Type.Optional(Type.Array(Type.String())),
  attachments: Type.Optional(Type.Array(Type.String())),
    
  createdAt: Type.Optional(Type.String()),
  updatedAt: Type.Optional(Type.String()),
});

export const buildResponseSchema = <T extends TSchema>(dataSchema: T) =>
  Type.Object({
    status: Type.Boolean(),
    statusCode: Type.Number(),
    data: dataSchema,
    error: Type.Null(),
  });

export const TaskListResponseSchema = buildResponseSchema(
  Type.Array(TaskSchema)
);
export const TaskSingleResponseSchema = buildResponseSchema(TaskSchema);

export const TaskFailedResponseSchema = Type.Object({
  status: Type.Boolean(),
  statusCode: Type.Number(),
  error: Type.String(),
  data: Type.Null(),
});

export type TaskT = Static<typeof TaskSchema>;
export type TaskCreateT = Static<typeof TaskCreateSchema>;
export type TaskUpdateT = Static<typeof TaskUpdateSchema>;
export type TaskQueryT = Static<typeof TaskQuerySchema>;
export type TaskParamsT = Static<typeof TaskParamsSchema>;
