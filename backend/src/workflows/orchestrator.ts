import { randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

export interface WorkflowStep {
  id: string;
  name: string;
  dependencies?: string[];
  action: () => Promise<{ success: boolean; data?: any; error?: string }> | { success: boolean; data?: any; error?: string };
}

export interface StepResult {
  stepId: string;
  status: "pending" | "running" | "completed" | "failed";
  durationMs: number;
  data?: any;
  error?: string;
}

export interface WorkflowExecution {
  executionId: string;
  workflowName: string;
  status: "running" | "completed" | "failed";
  steps: Record<string, StepResult>;
  startedAt: string;
  finishedAt?: string;
}

export class WorkflowOrchestrator {
  private executions: Map<string, WorkflowExecution> = new Map();
  private db?: DatabaseSync;

  constructor(db?: DatabaseSync) {
    this.db = db;

    if (this.db) {
      try {
        const rows = this.db.prepare(
          "SELECT execution_id, workflow_name, status, started_at, finished_at, steps_json FROM workflow_executions ORDER BY started_at DESC LIMIT 50"
        ).all() as any[];
        for (const row of rows) {
          let steps: Record<string, StepResult> = {};
          try { steps = JSON.parse(row.steps_json); } catch {}
          this.executions.set(row.execution_id, {
            executionId: row.execution_id,
            workflowName: row.workflow_name,
            status: row.status as any,
            steps,
            startedAt: row.started_at,
            finishedAt: row.finished_at || undefined
          });
        }
      } catch {}
    }
  }

  public async executeWorkflow(name: string, steps: WorkflowStep[]): Promise<WorkflowExecution> {
    const executionId = "exec_" + randomBytes(8).toString("hex");
    const startedAt = new Date().toISOString();
    const execution: WorkflowExecution = {
      executionId,
      workflowName: name,
      status: "running",
      steps: {},
      startedAt
    };

    for (const step of steps) {
      execution.steps[step.id] = {
        stepId: step.id,
        status: "pending",
        durationMs: 0
      };
    }

    this.executions.set(executionId, execution);
    this.persistExecution(execution);

    for (const step of steps) {
      if (step.dependencies && step.dependencies.length > 0) {
        const unfulfilled = step.dependencies.some(depId => execution.steps[depId]?.status !== "completed");
        if (unfulfilled) {
          execution.steps[step.id].status = "failed";
          execution.steps[step.id].error = "Dependência de step não satisfeita.";
          execution.status = "failed";
          break;
        }
      }

      execution.steps[step.id].status = "running";
      const start = Date.now();
      try {
        const res = await step.action();
        execution.steps[step.id].durationMs = Date.now() - start;
        if (res.success) {
          execution.steps[step.id].status = "completed";
          execution.steps[step.id].data = res.data;
        } else {
          execution.steps[step.id].status = "failed";
          execution.steps[step.id].error = res.error || "Ação do step falhou.";
          execution.status = "failed";
          break;
        }
      } catch (err: any) {
        execution.steps[step.id].durationMs = Date.now() - start;
        execution.steps[step.id].status = "failed";
        execution.steps[step.id].error = err.message;
        execution.status = "failed";
        break;
      }
    }

    if (execution.status === "running") {
      execution.status = "completed";
    }
    execution.finishedAt = new Date().toISOString();
    this.persistExecution(execution);

    return execution;
  }

  public getExecution(id: string): WorkflowExecution | undefined {
    return this.executions.get(id);
  }

  private persistExecution(execution: WorkflowExecution): void {
    if (!this.db) return;
    try {
      this.db.prepare(
        "INSERT OR REPLACE INTO workflow_executions (execution_id, workflow_name, status, started_at, finished_at, steps_json) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(
        execution.executionId,
        execution.workflowName,
        execution.status,
        execution.startedAt,
        execution.finishedAt || null,
        JSON.stringify(execution.steps)
      );
    } catch {}
  }
}
