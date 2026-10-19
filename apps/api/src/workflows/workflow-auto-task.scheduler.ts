import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { WorkflowRuntimeService } from './workflow-runtime.service';

const DEFAULT_SWEEP_MS = 60_000;

/**
 * Safety-net timer that completes workflow writes no user is waiting for:
 * ready auto-task items without a primary task. Event-driven paths (for
 * example a client approval) already create tasks immediately; this makes the
 * outcome independent of anyone opening a page, a restart or a failed run.
 *
 * Duplicate-safe across instances and overlapping runs: the DB function
 * workflow_create_primary_task locks the item and a partial unique index
 * allows one primary link per item. Disable with WORKFLOW_AUTOTASK_SWEEP_MS=0.
 */
@Injectable()
export class WorkflowAutoTaskScheduler
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(WorkflowAutoTaskScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly runtime: WorkflowRuntimeService) {}

  onModuleInit(): void {
    const interval = Number(
      process.env.WORKFLOW_AUTOTASK_SWEEP_MS ?? DEFAULT_SWEEP_MS,
    );
    if (
      process.env.APP_ENV === 'test' ||
      !Number.isFinite(interval) ||
      interval <= 0
    ) {
      return;
    }
    this.timer = setInterval(() => void this.tick(), interval);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const { workflows } = await this.runtime.sweepMissingAutoTasks();
      if (workflows > 0) {
        this.logger.log(`Auto-task sweep processed ${workflows} workflow(s)`);
      }
    } catch (error) {
      this.logger.error(
        `Auto-task sweep failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    } finally {
      this.running = false;
    }
  }
}
