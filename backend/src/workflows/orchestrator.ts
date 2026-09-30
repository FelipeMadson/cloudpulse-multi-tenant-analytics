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

  public async executeWorkflow(name: string, steps: WorkflowStep[]): Promise<WorkflowExecution> {
    const executionId = "exec_" + Math.random().toString(36).substring(2, 10);
    const execution: WorkflowExecution = {
      executionId,
      workflowName: name,
      status: "running",
      steps: {},
      startedAt: new Date().toISOString()
    };

    for (const step of steps) {
      execution.steps[step.id] = {
        stepId: step.id,
        status: "pending",
        durationMs: 0
      };
    }

    this.executions.set(executionId, execution);

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
    return execution;
  }

  public getExecution(id: string): WorkflowExecution | undefined {
    return this.executions.get(id);
  }
}
