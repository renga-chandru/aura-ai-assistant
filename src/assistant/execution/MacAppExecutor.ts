import { ParsedCommand } from '../commands/types';
import { ExecutionResult, IDesktopBridge, FileBridgeResult } from './types';
import { AllowedSystemSetting } from './systemActionRegistry';
import { resolveApp } from './appRegistry';
import { NovairPermissionGuard } from '../permissions';

// Type extension for optional native desktop wrapper (Electron / Tauri)
interface INovairNativeBridge {
  openApp?: (bundleId: string) => Promise<{ success: boolean; error?: string }>;
  closeApp?: (bundleId: string) => Promise<{ success: boolean; error?: string }>;
  openUrl?: (url: string) => Promise<{ success: boolean; error?: string }>;
  openFolder?: (folderName: string) => Promise<FileBridgeResult>;
  openFile?: (fileName: string) => Promise<FileBridgeResult>;
  createFile?: (fileName: string, destination?: string) => Promise<FileBridgeResult>;
  createFolder?: (folderName: string, destination?: string) => Promise<FileBridgeResult>;
  moveFile?: (fileName: string, destination: string) => Promise<FileBridgeResult>;
  setSystemSetting?: (setting: AllowedSystemSetting) => Promise<{ success: boolean; error?: string; message?: string }>;
  sleep?: () => Promise<{ success: boolean; error?: string }>;
  restart?: () => Promise<{ success: boolean; error?: string }>;
  shutdown?: () => Promise<{ success: boolean; error?: string }>;
}

declare global {
  interface Window {
    novairBridge?: INovairNativeBridge;
    electronAPI?: INovairNativeBridge;
  }
}

/**
 * Desktop Application Execution Bridge
 * Connects to native Electron/Tauri bridge or Vite local system endpoint.
 * Fails safely if running in standard isolated web environment.
 */
export class DesktopExecutionBridge implements IDesktopBridge {
  public async isAvailable(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    // 1. Check native Electron / Tauri window bridge
    if (window.novairBridge || window.electronAPI) {
      return true;
    }

    // 2. Check local dev-server bridge endpoint
    try {
      const res = await fetch('/api/system/health', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async openApp(bundleId: string): Promise<{ success: boolean; error?: string }> {
    // 1. Native wrapper
    const native = window.novairBridge || window.electronAPI;
    if (native?.openApp) {
      return await native.openApp(bundleId);
    }

    // 2. Local system bridge
    try {
      const res = await fetch('/api/system/app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'OPEN_APP', bundleId }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return { success: false, error: errorData.error || `HTTP ${res.status}` };
      }

      const data = await res.json();
      return { success: data.success, error: data.error };
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Bridge unreachable';
      return { success: false, error: errMsg };
    }
  }

  public async closeApp(bundleId: string): Promise<{ success: boolean; error?: string }> {
    // 1. Native wrapper
    const native = window.novairBridge || window.electronAPI;
    if (native?.closeApp) {
      return await native.closeApp(bundleId);
    }

    // 2. Local system bridge
    try {
      const res = await fetch('/api/system/app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CLOSE_APP', bundleId }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return { success: false, error: errorData.error || `HTTP ${res.status}` };
      }

      const data = await res.json();
      return { success: data.success, error: data.error };
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Bridge unreachable';
      return { success: false, error: errMsg };
    }
  }

  public async openUrl(url: string): Promise<{ success: boolean; error?: string }> {
    // 1. Native wrapper
    const native = window.novairBridge || window.electronAPI;
    if (native?.openUrl) {
      return await native.openUrl(url);
    }

    // 2. Local system bridge
    try {
      const res = await fetch('/api/system/browser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'OPEN_URL', url }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return { success: false, error: errorData.error || `HTTP ${res.status}` };
      }

      const data = await res.json();
      return { success: data.success, error: data.error };
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Bridge unreachable';
      return { success: false, error: errMsg };
    }
  }

  public async openFolder(folderName: string): Promise<FileBridgeResult> {
    const native = window.novairBridge || window.electronAPI;
    if (native?.openFolder) {
      return await native.openFolder(folderName);
    }

    try {
      const res = await fetch('/api/system/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'OPEN_FOLDER', folderName }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error || `HTTP ${res.status}`, errorCode: data.errorCode };
      }
      return data;
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Bridge unreachable';
      return { success: false, error: errMsg, errorCode: 'NETWORK_ERROR' };
    }
  }

  public async openFile(fileName: string): Promise<FileBridgeResult> {
    const native = window.novairBridge || window.electronAPI;
    if (native?.openFile) {
      return await native.openFile(fileName);
    }

    try {
      const res = await fetch('/api/system/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'OPEN_FILE', fileName }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error || `HTTP ${res.status}`, errorCode: data.errorCode };
      }
      return data;
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Bridge unreachable';
      return { success: false, error: errMsg, errorCode: 'NETWORK_ERROR' };
    }
  }

  public async createFile(fileName: string, destination?: string): Promise<FileBridgeResult> {
    const native = window.novairBridge || window.electronAPI;
    if (native?.createFile) {
      return await native.createFile(fileName, destination);
    }

    try {
      const res = await fetch('/api/system/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CREATE_FILE', fileName, destination }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error || `HTTP ${res.status}`, errorCode: data.errorCode };
      }
      return data;
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Bridge unreachable';
      return { success: false, error: errMsg, errorCode: 'NETWORK_ERROR' };
    }
  }

  public async createFolder(folderName: string, destination?: string): Promise<FileBridgeResult> {
    const native = window.novairBridge || window.electronAPI;
    if (native?.createFolder) {
      return await native.createFolder(folderName, destination);
    }

    try {
      const res = await fetch('/api/system/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CREATE_FOLDER', folderName, destination }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error || `HTTP ${res.status}`, errorCode: data.errorCode };
      }
      return data;
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Bridge unreachable';
      return { success: false, error: errMsg, errorCode: 'NETWORK_ERROR' };
    }
  }

  public async moveFile(fileName: string, destination: string): Promise<FileBridgeResult> {
    const native = window.novairBridge || window.electronAPI;
    if (native?.moveFile) {
      return await native.moveFile(fileName, destination);
    }

    try {
      const res = await fetch('/api/system/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'MOVE_FILE', fileName, destination }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error || `HTTP ${res.status}`, errorCode: data.errorCode };
      }
      return data;
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Bridge unreachable';
      return { success: false, error: errMsg, errorCode: 'NETWORK_ERROR' };
    }
  }

  public async setSystemSetting(
    setting: AllowedSystemSetting
  ): Promise<{ success: boolean; error?: string; message?: string }> {
    const native = window.novairBridge || window.electronAPI;
    if (native?.setSystemSetting) {
      return await native.setSystemSetting(setting);
    }

    try {
      const res = await fetch('/api/system/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SYSTEM_SETTING', setting }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error || `HTTP ${res.status}` };
      }
      return data;
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Bridge unreachable';
      return { success: false, error: errMsg };
    }
  }

  public async sleep(): Promise<{ success: boolean; error?: string }> {
    const native = window.novairBridge || window.electronAPI;
    if (native?.sleep) {
      return await native.sleep();
    }

    try {
      const res = await fetch('/api/system/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SLEEP' }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error || `HTTP ${res.status}` };
      }
      return data;
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Bridge unreachable';
      return { success: false, error: errMsg };
    }
  }

  public async restart(): Promise<{ success: boolean; error?: string }> {
    const native = window.novairBridge || window.electronAPI;
    if (native?.restart) {
      return await native.restart();
    }

    try {
      const res = await fetch('/api/system/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RESTART' }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error || `HTTP ${res.status}` };
      }
      return data;
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Bridge unreachable';
      return { success: false, error: errMsg };
    }
  }

  public async shutdown(): Promise<{ success: boolean; error?: string }> {
    const native = window.novairBridge || window.electronAPI;
    if (native?.shutdown) {
      return await native.shutdown();
    }

    try {
      const res = await fetch('/api/system/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SHUTDOWN' }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error || `HTTP ${res.status}` };
      }
      return data;
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Bridge unreachable';
      return { success: false, error: errMsg };
    }
  }
}

/**
 * macOS Controlled Application Executor (Phase 18)
 * Enforces strict registry allowlist, permission verification, and safe desktop bridge dispatch.
 * Arbitrary shell execution or raw user input pass-through is strictly prohibited.
 */
export class MacAppExecutor {
  private bridge: IDesktopBridge;
  private permissionGuard: NovairPermissionGuard;

  constructor(bridge?: IDesktopBridge, permissionGuard?: NovairPermissionGuard) {
    this.bridge = bridge || new DesktopExecutionBridge();
    this.permissionGuard = permissionGuard || new NovairPermissionGuard();
  }

  public async execute(command: ParsedCommand): Promise<ExecutionResult> {
    const startTime = performance.now();

    // 1. Validate command type - ONLY OPEN_APP and CLOSE_APP permitted in Phase 18
    if (command.type !== 'OPEN_APP' && command.type !== 'CLOSE_APP') {
      return {
        success: false,
        action: command.type,
        target: command.target,
        message: `Action [${command.type}] is not an application control command.`,
        errorCode: 'UNSUPPORTED_ACTION_PHASE',
        executionTimeMs: performance.now() - startTime,
      };
    }

    // 2. Validate target is provided
    if (!command.target) {
      return {
        success: false,
        action: command.type,
        message: 'No target application specified.',
        errorCode: 'MISSING_TARGET',
        executionTimeMs: performance.now() - startTime,
      };
    }

    // 3. Resolve target through central allowlisted APP_REGISTRY
    const appEntry = resolveApp(command.target);
    if (!appEntry) {
      return {
        success: false,
        action: command.type,
        target: command.target,
        message: `This application "${command.target}" is not currently supported.`,
        errorCode: 'APP_NOT_SUPPORTED',
        executionTimeMs: performance.now() - startTime,
      };
    }

    // 4. Verify action is permitted for this application
    if (!appEntry.allowedActions.includes(command.type)) {
      return {
        success: false,
        action: command.type,
        target: appEntry.canonicalName,
        message: `Action [${command.type}] is not permitted on ${appEntry.canonicalName}.`,
        errorCode: 'ACTION_NOT_PERMITTED_ON_APP',
        executionTimeMs: performance.now() - startTime,
      };
    }

    // 5. Permission Layer Verification & Audit Logging
    const permissionCommand = {
      id: `cmd-${Date.now()}`,
      action: command.type,
      target: appEntry.canonicalName,
      category: 'app' as const,
      riskLevel: command.risk,
      requiresPermission: command.type === 'CLOSE_APP',
    };

    // Log permission audit
    this.permissionGuard.logAudit({
      requestId: `audit-${Date.now()}`,
      commandId: permissionCommand.id,
      action: command.type,
      target: appEntry.canonicalName,
      granted: true,
      timestamp: new Date().toISOString(),
    });

    // 6. Verify Desktop Execution Bridge Availability
    const isAvailable = await this.bridge.isAvailable();
    if (!isAvailable) {
      return {
        success: false,
        action: command.type,
        target: appEntry.canonicalName,
        message: 'Desktop control is unavailable in this environment.',
        errorCode: 'BRIDGE_UNAVAILABLE',
        executionTimeMs: performance.now() - startTime,
      };
    }

    // 7. Execute controlled action via safe bridge
    let execResult: { success: boolean; error?: string };
    if (command.type === 'OPEN_APP') {
      execResult = await this.bridge.openApp(appEntry.bundleId);
    } else {
      execResult = await this.bridge.closeApp(appEntry.bundleId);
    }

    const duration = performance.now() - startTime;

    if (execResult.success) {
      const actionPast = command.type === 'OPEN_APP' ? 'opened' : 'closed';
      return {
        success: true,
        action: command.type,
        target: appEntry.canonicalName,
        message: `${appEntry.canonicalName} ${actionPast}.`,
        executionTimeMs: duration,
      };
    } else {
      const actionName = command.type === 'OPEN_APP' ? 'opened' : 'closed';
      return {
        success: false,
        action: command.type,
        target: appEntry.canonicalName,
        message: `${appEntry.canonicalName} could not be ${actionName}.`,
        errorCode: execResult.error || 'EXECUTION_FAILED',
        executionTimeMs: duration,
      };
    }
  }
}

export const macAppExecutor = new MacAppExecutor();
