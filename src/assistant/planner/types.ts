import { ParsedCommand } from '../commands/types';

export type PlanStepType =
  | 'APP_COMMAND'
  | 'BROWSER_COMMAND'
  | 'FILE_COMMAND'
  | 'SYSTEM_COMMAND'
  | 'CALCULATION_STEP';

export interface PlannedStep {
  id: string;
  stepNumber: number;
  type: PlanStepType;
  description: string;
  command?: ParsedCommand;
  calculationExpression?: string;
}

export interface TaskPlan {
  id: string;
  originalGoal: string;
  steps: PlannedStep[];
  isMultiStep?: boolean;
}

export interface ITaskPlanner {
  isMultiStepIntent(input: string): boolean;
  plan(input: string): TaskPlan | null;
}
