import { NovairCommandSchema, DesktopRiskLevel } from '../commands/types';

export interface PermissionRequest {
  requestId: string;
  command: NovairCommandSchema;
  timestamp: string;
  riskLevel: DesktopRiskLevel;
  promptMessage: string;
}

export interface PermissionAuditLog {
  requestId: string;
  commandId: string;
  action: string;
  target?: string;
  granted: boolean;
  timestamp: string;
}

export interface IPermissionGuard {
  checkPermission(command: NovairCommandSchema): Promise<boolean>;
  requestPermission(command: NovairCommandSchema): Promise<boolean>;
  logAudit(entry: PermissionAuditLog): void;
}

/**
 * NOVAIR Permission Guard Stub
 * Manages user authorization for sensitive desktop commands.
 * Control pipeline guard (Phase 15 Stub).
 */
export class NovairPermissionGuard implements IPermissionGuard {
  private auditLogs: PermissionAuditLog[] = [];

  public async checkPermission(command: NovairCommandSchema): Promise<boolean> {
    if (!command.requiresPermission && command.riskLevel === 'LOW') {
      return true;
    }
    return false;
  }

  public async requestPermission(command: NovairCommandSchema): Promise<boolean> {
    const granted = false; // Stub: Desktop control is disabled in Phase 15
    this.logAudit({
      requestId: `perm-req-${Date.now()}`,
      commandId: command.id,
      action: command.action,
      target: command.target,
      granted,
      timestamp: new Date().toISOString(),
    });
    return granted;
  }

  public logAudit(entry: PermissionAuditLog): void {
    this.auditLogs.push(entry);
  }

  public getAuditLogs(): PermissionAuditLog[] {
    return [...this.auditLogs];
  }
}
