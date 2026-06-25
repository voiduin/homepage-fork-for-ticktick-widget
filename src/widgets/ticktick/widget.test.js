import { describe, expect, it } from "vitest";

import { expectWidgetConfigShape } from "test-utils/widget-config";

import widget from "./widget";

describe("ticktick widget config", () => {
  it("exports a valid widget config", () => {
    expectWidgetConfigShape(widget);
  });

  describe("tasks mapping", () => {
    const map = widget.mappings.tasks.map;

    it("maps open tasks from project data", () => {
      const input = Buffer.from(
        JSON.stringify({
          tasks: [
            { id: "t1", title: "Open task", priority: 5, dueDate: "2026-01-01T00:00:00Z", status: 0 },
            { id: "t2", title: "Done task", priority: 0, dueDate: null, status: 2 },
          ],
        }),
      );
      const result = map(input);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: "t1", title: "Open task", priority: 5, dueDate: "2026-01-01T00:00:00Z", isCompleted: false });
      expect(result[1]).toEqual({ id: "t2", title: "Done task", priority: 0, dueDate: null, isCompleted: true });
    });

    it("defaults priority to 0 when missing", () => {
      const input = Buffer.from(JSON.stringify({ tasks: [{ id: "t1", title: "T", status: 0 }] }));
      expect(map(input)[0].priority).toBe(0);
    });

    it("returns empty array when tasks field is missing", () => {
      const input = Buffer.from(JSON.stringify({ project: { id: "p1" } }));
      expect(map(input)).toEqual([]);
    });
  });

  describe("closedTasks mapping", () => {
    const map = widget.mappings.closedTasks.map;

    it("maps completed tasks array", () => {
      const input = Buffer.from(
        JSON.stringify([
          { id: "t1", title: "Done", priority: 3, completedTime: "2026-01-10T10:00:00Z", dueDate: "2026-01-09T00:00:00Z" },
        ]),
      );
      const result = map(input);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ id: "t1", title: "Done", priority: 3, dueDate: "2026-01-10T10:00:00Z", isCompleted: true });
    });

    it("falls back to dueDate when completedTime is missing", () => {
      const input = Buffer.from(JSON.stringify([{ id: "t1", title: "T", priority: 0, dueDate: "2026-01-05T00:00:00Z" }]));
      expect(map(input)[0].dueDate).toBe("2026-01-05T00:00:00Z");
    });

    it("returns empty array when response is not an array", () => {
      const input = Buffer.from(JSON.stringify({ error: "no tasks" }));
      expect(map(input)).toEqual([]);
    });
  });
});
