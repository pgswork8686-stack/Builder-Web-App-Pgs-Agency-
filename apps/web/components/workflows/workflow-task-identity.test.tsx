import type React from "react";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EmbeddedBoardView } from "@/components/phase4/project-board-view";
import { EmbeddedCalendarView } from "@/components/phase4/project-calendar-view";
import { request } from "@/lib/api/client";
import type { Project, ProjectService } from "@/lib/api/projects";
import { tasksApi, type ProjectTask } from "@/lib/api/tasks";
import type { ProjectBoard, CalendarTask } from "@/lib/api/workspace";
import type { ProjectWorkflow } from "@/lib/api/workflows";
import { ProjectWorkflowPanel } from "./project-workflow-panel";

vi.mock("@/lib/api/client", () => ({ request: vi.fn() }));

vi.mock("@/components/phase4/project-workspace-realtime-provider", () => ({
  ProjectWorkspaceRealtimeProvider: ({
    children,
  }: {
    children: React.ReactNode;
  }) => children,
  useProjectWorkspaceRealtime: () => ({
    connectionState: "offline",
    revision: 0,
    lastEvent: null,
  }),
}));

vi.mock("@/components/phase4/project-task-create-dialog", () => ({
  ProjectTaskCreateDialog: () => null,
}));

const PROJECT_ID = "project-identity";
const PROJECT_SERVICE_ID = "project-service-identity";
const TASK_ID = "task-exact-shared-8686";
const TASK_TITLE = "Exact shared Workflow task";
const TASK_DETAIL_HREF = `/app/projects/${PROJECT_ID}/tasks/${TASK_ID}`;

const taskApiRecord: ProjectTask = {
  id: TASK_ID,
  project_id: PROJECT_ID,
  project_service_item_id: "project-service-item-identity",
  title: TASK_TITLE,
  status: "todo",
  priority: "medium",
  start_date: "2026-08-20",
  due_date: "2026-08-20",
  sort_order: 0,
  created_at: "2026-08-20T00:00:00.000Z",
  updated_at: "2026-08-20T00:00:00.000Z",
  canUpdateStatus: false,
};

const project: Project = {
  id: PROJECT_ID,
  projectCode: "DA_8686",
  clientCompanyId: "client-company-identity",
  name: "Task identity project",
  status: "active",
  priority: "medium",
  createdAt: "2026-08-20T00:00:00.000Z",
  updatedAt: "2026-08-20T00:00:00.000Z",
  currentProjectRole: "member",
};

const projectService: ProjectService = {
  id: PROJECT_SERVICE_ID,
  project_id: PROJECT_ID,
  service_id: "service-identity",
  status: "active",
  service: {
    id: "service-identity",
    code: "DV_86",
    name: "Identity service",
    active: true,
  },
  created_at: "2026-08-20T00:00:00.000Z",
  updated_at: "2026-08-20T00:00:00.000Z",
};

function boardFromTask(task: ProjectTask): ProjectBoard {
  return {
    todo: [{ ...task, canReorder: false }],
    inProgress: [],
    review: [],
    done: [],
    canReorder: false,
    total: 1,
    truncated: false,
    limit: 200,
  };
}

function calendarFromTask(task: ProjectTask): CalendarTask[] {
  return [
    {
      taskId: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      startDate: task.start_date,
      dueDate: task.due_date,
    },
  ];
}

function workflowFromTask(task: ProjectTask): ProjectWorkflow {
  return {
    id: "workflow-identity",
    project_id: PROJECT_ID,
    project_service_id: PROJECT_SERVICE_ID,
    project_workflow_code: "QTDA_86",
    source_workflow_version: 1,
    name_snapshot: "Identity Workflow",
    status: "in_progress",
    progress: { completedItems: 0, requiredItems: 1, percent: 0 },
    approvals: [],
    stages: [
      {
        id: "stage-identity",
        project_workflow_id: "workflow-identity",
        project_workflow_stage_code: "GDDA_86",
        name_snapshot: "Delivery",
        sort_order: 1,
        is_required: true,
        status: "in_progress",
        items: [
          {
            id: "workflow-item-identity",
            project_workflow_stage_id: "stage-identity",
            project_workflow_id: "workflow-identity",
            project_service_item_id: "project-service-item-identity",
            project_service_item_code: "HMDA_86",
            project_service_item: {
              name: "Identity deliverable",
              is_required: true,
            },
            approval_required: false,
            approval_scope: null,
            completion_mode: "tasks_done",
            auto_create_task: true,
            status: "locked",
            task_links: [
              {
                id: "workflow-task-link-identity",
                task_id: task.id,
                link_type: "primary",
                created_by_workflow: true,
                task: {
                  id: task.id,
                  title: task.title,
                  status: task.status,
                  due_date: task.due_date,
                },
              },
            ],
          },
        ],
      },
    ],
  };
}

const requestMock = vi.mocked(request);

describe("Workflow Task identity across existing Task surfaces", () => {
  beforeEach(() => {
    requestMock.mockReset();
    requestMock.mockImplementation(async (path: string) => {
      if (path === `/projects/${PROJECT_ID}/tasks/${TASK_ID}`) {
        return taskApiRecord;
      }
      if (path === `/projects/${PROJECT_ID}`) return project;
      if (path === `/projects/${PROJECT_ID}/board?`) {
        return boardFromTask(taskApiRecord);
      }
      if (path.startsWith(`/projects/${PROJECT_ID}/calendar?`)) {
        return calendarFromTask(taskApiRecord);
      }
      if (path === `/projects/${PROJECT_ID}/workflows`) {
        return [workflowFromTask(taskApiRecord)];
      }
      if (path.startsWith("/work-calendar?")) {
        return {
          from: "2026-07-27",
          to: "2026-09-06",
          timezone: "Asia/Ho_Chi_Minh",
          days: [],
        };
      }
      throw new Error(`Unexpected API request: ${path}`);
    });
  });

  it("uses the exact Task API ID in Kanban, Calendar, and Workflow Task Link", async () => {
    const taskFromApi = await tasksApi.get(PROJECT_ID, TASK_ID);
    expect(taskFromApi.id).toBe(TASK_ID);

    render(
      <>
        <section data-testid="identity-kanban">
          <EmbeddedBoardView mode="internal" projectId={PROJECT_ID} />
        </section>
        <section data-testid="identity-calendar">
          <EmbeddedCalendarView
            mode="internal"
            projectId={PROJECT_ID}
            initialMonth="2026-08"
          />
        </section>
        <section data-testid="identity-workflow">
          <ProjectWorkflowPanel
            projectId={PROJECT_ID}
            projectServices={[projectService]}
            canMutate={false}
            mode="internal"
          />
        </section>
      </>,
    );

    const kanbanLink = await within(
      screen.getByTestId("identity-kanban"),
    ).findByRole("link", { name: TASK_TITLE });
    const calendarLink = await within(
      screen.getByTestId("identity-calendar"),
    ).findByRole("link", { name: TASK_TITLE });
    const workflowLink = await within(
      screen.getByTestId("identity-workflow"),
    ).findByRole("link", { name: new RegExp(TASK_TITLE) });

    const hrefs = [kanbanLink, calendarLink, workflowLink].map((link) =>
      link.getAttribute("href"),
    );
    expect(hrefs).toEqual([
      TASK_DETAIL_HREF,
      TASK_DETAIL_HREF,
      TASK_DETAIL_HREF,
    ]);
    expect(
      hrefs.every((href) => href?.split("/").at(-1) === taskFromApi.id),
    ).toBe(true);
    expect(workflowLink.getAttribute("data-task-id")).toBe(taskFromApi.id);

    expect(requestMock).toHaveBeenCalledWith(
      `/projects/${PROJECT_ID}/tasks/${TASK_ID}`,
    );
    expect(requestMock).toHaveBeenCalledWith(`/projects/${PROJECT_ID}/board?`);
    expect(
      requestMock.mock.calls.some(([path]) =>
        String(path).startsWith(`/projects/${PROJECT_ID}/calendar?`),
      ),
    ).toBe(true);
    expect(requestMock).toHaveBeenCalledWith(
      `/projects/${PROJECT_ID}/workflows`,
    );
  });
});
