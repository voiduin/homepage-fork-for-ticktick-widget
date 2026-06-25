import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

const { credentialedProxyHandler, getServiceWidget, logger } = vi.hoisted(() => ({
  credentialedProxyHandler: vi.fn(),
  getServiceWidget: vi.fn(),
  logger: { debug: vi.fn(), error: vi.fn() },
}));

vi.mock("utils/logger", () => ({ default: () => logger }));
vi.mock("utils/config/service-helpers", () => ({ default: getServiceWidget }));
vi.mock("utils/proxy/handlers/credentialed", () => ({ default: credentialedProxyHandler }));

import ticktickProxyHandler from "./proxy";

const WIDGET = { key: "tok", projectId: "proj1" };

function makeReq(endpoint) {
  return { query: { group: "g", service: "svc", endpoint, index: "0" } };
}

describe("widgets/ticktick/proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("delegates non-completed endpoints to credentialedProxyHandler", async () => {
    const req = makeReq("project/proj1/data");
    const res = createMockRes();
    await ticktickProxyHandler(req, res);
    expect(credentialedProxyHandler).toHaveBeenCalledWith(req, res, undefined);
  });

  it("returns 400 when widget is not found", async () => {
    getServiceWidget.mockResolvedValue(null);
    const req = makeReq("task/completed");
    const res = createMockRes();
    await ticktickProxyHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid widget" });
  });

  it("fetches completed tasks and returns mapped result", async () => {
    getServiceWidget.mockResolvedValue(WIDGET);
    const tasks = [{ id: "t1", title: "Done", status: 2 }];
    const map = vi.fn((buf) => JSON.parse(buf.toString()));

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => tasks,
    });

    const req = makeReq("task/completed");
    const res = createMockRes();
    await ticktickProxyHandler(req, res, map);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.ticktick.com/open/v1/task/completed",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer tok" }),
      }),
    );
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.projectIds).toEqual(["proj1"]);
    expect(body.startDate).toMatch(/2025-10-17/); // 90 days before 2026-01-15
    expect(body.endDate).toMatch(/2026-01-15/);
    expect(res.statusCode).toBe(200);
  });

  it("uses completedLookbackDays when set", async () => {
    getServiceWidget.mockResolvedValue({ ...WIDGET, completedLookbackDays: 7 });
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });

    const req = makeReq("task/completed");
    const res = createMockRes();
    await ticktickProxyHandler(req, res);

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.startDate).toMatch(/2026-01-08/); // 7 days before 2026-01-15
  });

  it("returns HTTP error status when TickTick API responds with error", async () => {
    getServiceWidget.mockResolvedValue(WIDGET);
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "Unauthorized" }),
    });

    const req = makeReq("task/completed");
    const res = createMockRes();
    await ticktickProxyHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(logger.error).toHaveBeenCalled();
  });

  it("returns 500 when fetch throws", async () => {
    getServiceWidget.mockResolvedValue(WIDGET);
    global.fetch = vi.fn().mockRejectedValue(new Error("network failure"));

    const req = makeReq("task/completed");
    const res = createMockRes();
    await ticktickProxyHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.objectContaining({ message: "network failure" }) }));
  });
});
