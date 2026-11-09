import { Suspense } from "react";
import { CrossProjectTasks } from "@/components/tasks/cross-project-tasks";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CrossProjectTasks role="team_leader" view="kanban" />
    </Suspense>
  );
}
