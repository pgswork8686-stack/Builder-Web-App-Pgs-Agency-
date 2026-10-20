# ADR 0001 — Task completion goes through a review gate

- **Status:** Implemented in code and covered by tests. **PENDING PRODUCT OWNER APPROVAL** (the owner has not signed this rule off; see "Decision owner").
- **Date:** 2026-10-20
- **Introduced in:** commit `f529b00` ("feat(flows 01-04): review gate + default notifications + sweep pagination").

## Context

Before `f529b00` an assigned employee could move their own task straight to `done`. That makes "done" a self-declaration: nobody checks the deliverable, workflow items that depend on the task unlock without review, and the client-facing progress can show completed work that was never reviewed.

## Decision (current behaviour)

"Manager" below means **Admin, or the user whose role on that project is `project_manager`** (`tasks.service.ts`, `updateTask`: `access.isAdmin || access.projectRole === 'project_manager'`). A Team Leader who is only a member of a project is treated like any other member on that project.

| Actor                         | Allowed on a task                                                                                                                                                                                                                                               |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Assigned member (non-manager) | May change **only `status`**, and only on the task assigned to them. Any status change is allowed **except moving a task to `done` or moving a task out of `done`** (`TASK_REVIEW_REQUIRED`). In practice: `todo → in_progress → review` ("Gửi duyệt").         |
| Manager                       | Approve `review → done`; reopen a `done` task; send a task back from `review` to `todo`/`in_progress` **with a reason of at least 5 characters** (`REVIEW_NOTE_REQUIRED`), which is stored as a task comment ("Yêu cầu chỉnh sửa: …") and sent to the assignee. |
| Viewer                        | Read only (`TASK_ACCESS_DENIED`).                                                                                                                                                                                                                               |

Implementation: `TasksService.updateTask` (`apps/api/src/tasks/tasks.service.ts`). Simultaneous approvals are serialised per task so there is one transition and one notification. Approving the task completes its workflow item and unlocks the next one (`blocked → ready`), covered by Flow 04.

## Compatibility switch

`TASK_ALLOW_ASSIGNEE_DONE=true` restores the previous behaviour (an assigned member may set `done`). It is read on every call (`tasks.service.ts`, `assigneeMayApproveOwnWork`). **The default is the review gate** (variable unset, or any value other than the exact string `true`).

Use of the switch is a deliberate business decision, not a deployment convenience: it removes the control described above.

## Tests

`apps/api/src/tasks/tasks-review-gate.service.spec.ts`:

- gate on (default): assignee cannot mark `done` (`TASK_REVIEW_REQUIRED`), cannot reopen an approved task;
- switch on: assignee can set `done` (rollback switch test);
- employee submit notifies project managers; manager approve notifies the assignee once.

End-to-end: Flow 03 (employee submits, cannot self-approve) and Flow 04 (reject with reason, resubmit, approve, concurrent approvals, workflow unlock) in `scripts/uat-flow03-*.mjs` and `scripts/uat-flow04-*.mjs`.

## Consequences

- Employees are not offered "Hoàn thành"; managers get a review queue and notifications. A project with no `project_manager` can only have tasks closed by Admin until one is assigned.
- **Deployment ordering:** an old web build talking to a new API shows an error when an employee tries to set `done`. Deploy API and web close together (see `PRODUCTION_DEPLOYMENT_RUNBOOK.md`).
- Existing `done` tasks are unaffected; no data migration is involved.

## Decision owner

Product owner (PGS Agency). Until the owner records approval here, the release documents list this rule as **PENDING PRODUCT OWNER APPROVAL**. To approve, replace the status line above with the approver's name and date. To reject, the switch can be set without a code change, and a follow-up ADR must record the alternative policy.
