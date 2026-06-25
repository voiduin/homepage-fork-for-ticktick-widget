// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";
import { expectBlockValue } from "test-utils/widget-assertions";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn() }));
vi.mock("utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));

import Component from "./component";

const OPEN_TASKS = [
  { id: "t1", title: "Task overdue", priority: 0, dueDate: "2020-01-01T00:00:00Z", isCompleted: false },
  { id: "t2", title: "Task today", priority: 5, dueDate: "2020-01-15T12:00:00Z", isCompleted: false },
  { id: "t3", title: "Task future", priority: 0, dueDate: "2020-02-01T00:00:00Z", isCompleted: false },
];

const CLOSED_TASKS = [
  { id: "t4", title: "Task done", priority: 1, dueDate: "2020-01-10T00:00:00Z", isCompleted: true },
];

function mockAPIs({ open = OPEN_TASKS, closed = undefined, openError = undefined, closedError = undefined } = {}) {
  useWidgetAPI.mockImplementation((_widget, endpoint) => {
    if (endpoint === "tasks") return { data: open, error: openError };
    if (endpoint === "closedTasks") return { data: closed, error: closedError };
    return { data: undefined, error: undefined };
  });
}

describe("widgets/ticktick/component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2020-01-15T06:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders placeholders while loading", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: undefined });

    const { container } = renderWithProviders(
      <Component service={{ widget: { type: "ticktick", projectId: "proj1" } }} />,
      { settings: { hideErrors: false } },
    );

    expect(container.querySelectorAll(".service-block")).toHaveLength(4);
    expect(screen.getByText("ticktick.openTasks")).toBeInTheDocument();
    expect(screen.getByText("ticktick.overdueTasks")).toBeInTheDocument();
    expect(screen.getByText("ticktick.dueTodayTasks")).toBeInTheDocument();
    expect(screen.getByText("ticktick.highPriorityTasks")).toBeInTheDocument();
  });

  it("computes task stats when loaded", () => {
    mockAPIs();

    const { container } = renderWithProviders(
      <Component service={{ widget: { type: "ticktick", projectId: "proj1" } }} />,
      { settings: { hideErrors: false } },
    );

    expectBlockValue(container, "ticktick.openTasks", 3);
    expectBlockValue(container, "ticktick.overdueTasks", 1);
    expectBlockValue(container, "ticktick.dueTodayTasks", 1);
    expectBlockValue(container, "ticktick.highPriorityTasks", 1);
  });

  it("renders task list when taskListEnabled is true", () => {
    mockAPIs();

    renderWithProviders(
      <Component
        service={{ widget: { type: "ticktick", projectId: "proj1", taskListEnabled: true, taskFetchLimit: 10 } }}
      />,
      { settings: { hideErrors: false } },
    );

    expect(screen.getByText("Task overdue")).toBeInTheDocument();
    expect(screen.getByText("Task today")).toBeInTheDocument();
    expect(screen.getByText("Task future")).toBeInTheDocument();
  });

  it("limits task list to taskFetchLimit", () => {
    const manyTasks = Array.from({ length: 10 }, (_, i) => ({
      id: `t${i}`,
      title: `Task ${i}`,
      priority: 0,
      dueDate: null,
      isCompleted: false,
    }));

    useWidgetAPI.mockImplementation((_widget, endpoint) => {
      if (endpoint === "tasks") return { data: manyTasks, error: undefined };
      return { data: undefined, error: undefined };
    });

    renderWithProviders(
      <Component
        service={{ widget: { type: "ticktick", projectId: "proj1", taskListEnabled: true, taskFetchLimit: 3 } }}
      />,
      { settings: { hideErrors: false } },
    );

    expect(screen.getByText("Task 0")).toBeInTheDocument();
    expect(screen.getByText("Task 2")).toBeInTheDocument();
    expect(screen.queryByText("Task 3")).not.toBeInTheDocument();
  });

  it("shows error when open tasks fetch fails", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: new Error("API error") });

    const { container } = renderWithProviders(
      <Component service={{ widget: { type: "ticktick", projectId: "proj1" } }} />,
      { settings: { hideErrors: false } },
    );

    expect(container.querySelector(".service-block")).toBeNull();
  });

  it("shows closed tasks when taskFilter is closed", () => {
    mockAPIs({ closed: CLOSED_TASKS });

    renderWithProviders(
      <Component
        service={{
          widget: { type: "ticktick", projectId: "proj1", taskListEnabled: true, taskFilter: "closed", taskFetchLimit: 10 },
        }}
      />,
      { settings: { hideErrors: false } },
    );

    expect(screen.getByText("Task done")).toBeInTheDocument();
    expect(screen.queryByText("Task overdue")).not.toBeInTheDocument();
  });

  it("shows all tasks when taskFilter is all", () => {
    mockAPIs({ closed: CLOSED_TASKS });

    renderWithProviders(
      <Component
        service={{
          widget: { type: "ticktick", projectId: "proj1", taskListEnabled: true, taskFilter: "all", taskFetchLimit: 10 },
        }}
      />,
      { settings: { hideErrors: false } },
    );

    expect(screen.getByText("Task overdue")).toBeInTheDocument();
    expect(screen.getByText("Task done")).toBeInTheDocument();
  });

  it("shows totalTasks and completedTasks stats when requested", () => {
    mockAPIs({ closed: CLOSED_TASKS });

    const { container } = renderWithProviders(
      <Component
        service={{
          widget: {
            type: "ticktick",
            projectId: "proj1",
            fields: ["totalTasks", "completedTasks"],
          },
        }}
      />,
      { settings: { hideErrors: false } },
    );

    expectBlockValue(container, "ticktick.totalTasks", 4); // 3 open + 1 closed
    expectBlockValue(container, "ticktick.completedTasks", 1);
  });

  it("renders tasks as links when taskLink is web", () => {
    mockAPIs();

    renderWithProviders(
      <Component
        service={{
          widget: {
            type: "ticktick",
            projectId: "proj1",
            taskListEnabled: true,
            taskLink: "web",
            taskFetchLimit: 10,
          },
        }}
      />,
      { settings: { hideErrors: false } },
    );

    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
    expect(links[0].href).toContain("ticktick.com/webapp");
  });

  it("renders tasks as app links when taskLink is app", () => {
    mockAPIs();

    renderWithProviders(
      <Component
        service={{
          widget: {
            type: "ticktick",
            projectId: "proj1",
            taskListEnabled: true,
            taskLink: "app",
            taskFetchLimit: 10,
          },
        }}
      />,
      { settings: { hideErrors: false } },
    );

    const links = screen.getAllByRole("link");
    expect(links[0].href).toContain("ticktick://");
  });

  it("renders custom fields when fields option is set", () => {
    mockAPIs();

    const { container } = renderWithProviders(
      <Component
        service={{
          widget: { type: "ticktick", projectId: "proj1", fields: ["openTasks", "overdueTasks"] },
        }}
      />,
      { settings: { hideErrors: false } },
    );

    expect(container.querySelectorAll(".service-block")).toHaveLength(2);
    expect(screen.getByText("ticktick.openTasks")).toBeInTheDocument();
    expect(screen.getByText("ticktick.overdueTasks")).toBeInTheDocument();
    expect(screen.queryByText("ticktick.dueTodayTasks")).not.toBeInTheDocument();
  });
});
