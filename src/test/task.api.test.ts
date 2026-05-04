import Fastify from "fastify";
import supertest from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { registerRoutes } from "../components/registerRoutes.ts";
import type { AnyType } from "../types/types.ts";
import prisma from "../lib/prisma.ts";

let app: AnyType;
let request: AnyType;

const mockData = {
  success: [
    {
      title: "Test Task",
      description: "this is the test task",
      priority: "medium",
      status: "todo",
      deadLine: new Date().toISOString(),
      workspace: "dummy-workspace",
      createdBy: undefined,
    },
    {
      title: "Task 1",
      priority: "medium",
      status: "todo",
      deadLine: new Date().toISOString(),
      workspace: "TestSpace",
      createdBy: undefined,
    },
    {
      title: "Task 2",
      priority: "high",
      status: "inprogress",
      deadLine: new Date().toISOString(),
      workspace: "TestSpace",
      createdBy: undefined,
    },
  ],

  failed: [
    {
      title: "This is test title",
      priority: "medium",
      status: "todo",
      deadLine: new Date().toISOString(),
      // missing workspace — should fail validation
    },
  ],
};

beforeAll(async () => {
  app = Fastify({ logger: false });
  registerRoutes(app);
  await app.ready();
  request = supertest(app.server);
});

afterAll(async () => {
  await prisma.$disconnect();
  await app.close();
});

afterEach(async () => {
  // Clean up tasks after each test
  await prisma.taskDependency.deleteMany({});
  await prisma.document.deleteMany({});
  await prisma.task.deleteMany({});
});

describe("Task Api", () => {
  test("Should create new task", async () => {
    const response = await request.post("/api/task").send(mockData.success[0]);

    expect(response.status).toBe(201);
    expect(response.body.status).toBe(true);
    expect(response.body.data.title).toBe("Test Task");
    expect(response.body.data._id).toBeDefined();
  });

  test("Should failed to create a task (missing workspace)", async () => {
    const response = await request.post("/api/task").send(mockData.failed[0]);

    expect(response.status).toBe(400);
    expect(response.body.status).toBe(false);
    expect(response.body.data).toBe(null);
  });

  test("Should get all tasks", async () => {
    // Insert tasks directly via Prisma
    for (const task of mockData.success) {
      await prisma.task.create({
        data: {
          title: task.title,
          priority: task.priority as any,
          status: task.status as any,
          deadLine: task.deadLine,
          workspace: task.workspace,
        },
      });
    }

    const response = await request.get("/api/task");
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBe(3);
  });

  test("Should get all tasks for query", async () => {
    for (const task of mockData.success) {
      await prisma.task.create({
        data: {
          title: task.title,
          priority: task.priority as any,
          status: task.status as any,
          deadLine: task.deadLine,
          workspace: task.workspace,
        },
      });
    }

    const response = await request.get("/api/task").query({ status: "inprogress" });

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBe(1);
  });

  test("Should get one task", async () => {
    const created = await prisma.task.create({
      data: {
        title: "Test Task",
        priority: "medium",
        status: "todo",
        deadLine: new Date().toISOString(),
        workspace: "dummy-workspace",
      },
    });

    const resp = await request.get(`/api/task/${created.id}`);

    expect(resp.status).toBe(200);
    expect(resp.body.status).toBe(true);
    expect(resp.body.data._id).toBe(created.id);
  });

  test("Should return 404 for nonexistent task", async () => {
    const resp = await request.get("/api/task/nonexistent-id-xyz");

    expect(resp.status).toBe(404);
    expect(resp.body.status).toBe(false);
  });

  test("Should update a task", async () => {
    const created = await prisma.task.create({
      data: {
        title: "Task To Update",
        priority: "medium",
        status: "todo",
        deadLine: new Date().toISOString(),
        workspace: "UpdateSpace",
      },
    });

    const response = await request
      .patch(`/api/task/${created.id}`)
      .send({ status: "done" });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe(true);
    expect(response.body.data._id).toBe(created.id);
    expect(response.body.data.status).toBe("done");
  });

  test("Should return 404 for update on nonexistent task", async () => {
    const response = await request
      .patch("/api/task/nonexistent-id-xyz")
      .send({ status: "done" });
    expect(response.status).toBe(404);
    expect(response.body.status).toBe(false);
  });

  test("Should delete a task", async () => {
    const created = await prisma.task.create({
      data: {
        title: "Task To Delete",
        priority: "high",
        status: "inprogress",
        deadLine: new Date().toISOString(),
        workspace: "DeleteSpace",
      },
    });

    const response = await request.delete(`/api/task/${created.id}`);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe(true);

    const check = await prisma.task.findUnique({ where: { id: created.id } });
    expect(check).toBeNull();
  });

  test("Should return 404 for delete on nonexistent task", async () => {
    const response = await request.delete("/api/task/nonexistent-id-xyz");
    expect(response.status).toBe(404);
    expect(response.body.status).toBe(false);
  });
});
