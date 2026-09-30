/**
 * NOVAIR Controlled System Executor (Phase 21)
 *
 * Implements safe, isolated execution for:
 * - SYSTEM_SETTING (Volume Up, Volume Down, Mute, Unmute only)
 * - SLEEP (High Risk — Explicit Confirmation Required)
 * - RESTART (High Risk — Explicit Confirmation Required)
 * - SHUTDOWN (High Risk — Explicit Confirmation Required)
 *
 * Arbitrary shell commands, sudo, defaults, launchctl, and arbitrary AppleScript are strictly prohibited.
 */

import { ParsedCommand } from '../commands/types';
import { ExecutionResult, IDesktopBridge } from './types';
import { DesktopExecutionBridge } from './MacAppExecutor';
import {
  resolveSystemSetting,
  SYSTEM_SETTINGS_REGISTRY,
  SYSTEM_CONFIRMATION_PROMPTS,
} from './systemActionRegistry';
import { NovairPermissionGuard } from '../permissions';

export class SystemExecutor {
  private bridge: IDesktopBridge;
  private permissionGuard: NovairPermissionGuard;

  constructor(bridge?: IDesktopBridge, permissionGuard?: NovairPermissionGuard) {
    this.bridge = bridge || new DesktopExecutionBridge();
    this.permissionGuard = permissionGuard || new NovairPermissionGuard();
  }

  /**
   * Main router for system commands
   */
  public async execute(command: ParsedCommand, isConfirmed: boolean = false): Promise<ExecutionResult> {
    const startTime = Date.now();

    // 1. Audit log via permission guard
    this.permissionGuard.logAudit({
      requestId: `audit-${Date.now()}`,
      commandId: `cmd-${command.type.toLowerCase()}-${Date.now()}`,
      action: command.type,
      target: command.target,
      granted: isConfirmed || command.type === 'SYSTEM_SETTING',
      timestamp: new Date().toISOString(),
    });

    switch (command.type) {
      case 'SYSTEM_SETTING':
        return await this.executeSetting(command, startTime);

      case 'SLEEP':
        return await this.executeSleep(command, isConfirmed, startTime);

      case 'RESTART':
        return await this.executeRestart(command, isConfirmed, startTime);

      case 'SHUTDOWN':
        return await this.executeShutdown(command, isConfirmed, startTime);

      default:
        return {
          success: false,
          action: command.type,
          target: command.target,
          message: `Action ${command.type} is not a supported system control action.`,
          errorCode: 'UNSUPPORTED_ACTION',
          executionTimeMs: Date.now() - startTime,
        };
    }
  }

  /**
   * Executes allowlisted system settings (volume_up, volume_down, mute, unmute)
   */
  public async executeSetting(command: ParsedCommand, startTime: number = Date.now()): Promise<ExecutionResult> {
    // 1. Resolve setting against allowlist
    const rawTarget = command.target || command.normalizedInput || '';
    const resolvedSetting = resolveSystemSetting(rawTarget);

    if (!resolvedSetting) {
      return {
        success: false,
        action: 'SYSTEM_SETTING',
        target: rawTarget,
        message: `Setting "${rawTarget}" is not supported. Only audio settings (volume up, volume down, mute, unmute) are supported in this phase.`,
        errorCode: 'UNSUPPORTED_SETTING',
        executionTimeMs: Date.now() - startTime,
      };
    }

    const settingDef = SYSTEM_SETTINGS_REGISTRY[resolvedSetting];

    // 2. Check bridge availability
    const bridgeAvailable = await this.bridge.isAvailable();
    if (!bridgeAvailable) {
      return {
        success: false,
        action: 'SYSTEM_SETTING',
        target: settingDef.name,
        message: 'Desktop system control is unavailable in this environment.',
        errorCode: 'BRIDGE_UNAVAILABLE',
        executionTimeMs: Date.now() - startTime,
      };
    }

    // 3. Dispatch through desktop bridge
    const result = await this.bridge.setSystemSetting(resolvedSetting);
    const duration = Date.now() - startTime;

    if (!result.success) {
      return {
        success: false,
        action: 'SYSTEM_SETTING',
        target: settingDef.name,
        message: result.error || `Failed to apply ${settingDef.name}.`,
        errorCode: 'BRIDGE_ERROR',
        executionTimeMs: duration,
      };
    }

    return {
      success: true,
      action: 'SYSTEM_SETTING',
      target: settingDef.name,
      message: result.message || `${settingDef.name} applied successfully.`,
      executionTimeMs: duration,
    };
  }

  /**
   * Puts macOS to sleep (High Risk — requires explicit confirmation)
   */
  public async executeSleep(
    _command: ParsedCommand,
    isConfirmed: boolean,
    startTime: number = Date.now()
  ): Promise<ExecutionResult> {
    if (!isConfirmed) {
      return {
        success: false,
        action: 'SLEEP',
        target: 'System',
        requiresConfirmation: true,
        message: SYSTEM_CONFIRMATION_PROMPTS.SLEEP,
        errorCode: 'CONFIRMATION_REQUIRED',
        executionTimeMs: Date.now() - startTime,
      };
    }

    const bridgeAvailable = await this.bridge.isAvailable();
    if (!bridgeAvailable) {
      return {
        success: false,
        action: 'SLEEP',
        target: 'System',
        message: 'Desktop system control is unavailable in this environment.',
        errorCode: 'BRIDGE_UNAVAILABLE',
        executionTimeMs: Date.now() - startTime,
      };
    }

    const result = await this.bridge.sleep();
    const duration = Date.now() - startTime;

    if (!result.success) {
      return {
        success: false,
        action: 'SLEEP',
        target: 'System',
        message: result.error || 'Failed to put Mac to sleep.',
        errorCode: 'BRIDGE_ERROR',
        executionTimeMs: duration,
      };
    }

    return {
      success: true,
      action: 'SLEEP',
      target: 'System',
      message: 'Putting macOS to sleep...',
      executionTimeMs: duration,
    };
  }

  /**
   * Restarts macOS (High Risk — requires explicit confirmation)
   */
  public async executeRestart(
    _command: ParsedCommand,
    isConfirmed: boolean,
    startTime: number = Date.now()
  ): Promise<ExecutionResult> {
    if (!isConfirmed) {
      return {
        success: false,
        action: 'RESTART',
        target: 'System',
        requiresConfirmation: true,
        message: SYSTEM_CONFIRMATION_PROMPTS.RESTART,
        errorCode: 'CONFIRMATION_REQUIRED',
        executionTimeMs: Date.now() - startTime,
      };
    }

    const bridgeAvailable = await this.bridge.isAvailable();
    if (!bridgeAvailable) {
      return {
        success: false,
        action: 'RESTART',
        target: 'System',
        message: 'Desktop system control is unavailable in this environment.',
        errorCode: 'BRIDGE_UNAVAILABLE',
        executionTimeMs: Date.now() - startTime,
      };
    }

    const result = await this.bridge.restart();
    const duration = Date.now() - startTime;

    if (!result.success) {
      return {
        success: false,
        action: 'RESTART',
        target: 'System',
        message: result.error || 'Failed to restart macOS.',
        errorCode: 'BRIDGE_ERROR',
        executionTimeMs: duration,
      };
    }

    return {
      success: true,
      action: 'RESTART',
      target: 'System',
      message: 'Restarting macOS...',
      executionTimeMs: duration,
    };
  }

  /**
   * Shuts down macOS (High Risk — requires explicit confirmation)
   */
  public async executeShutdown(
    _command: ParsedCommand,
    isConfirmed: boolean,
    startTime: number = Date.now()
  ): Promise<ExecutionResult> {
    if (!isConfirmed) {
      return {
        success: false,
        action: 'SHUTDOWN',
        target: 'System',
        requiresConfirmation: true,
        message: SYSTEM_CONFIRMATION_PROMPTS.SHUTDOWN,
        errorCode: 'CONFIRMATION_REQUIRED',
        executionTimeMs: Date.now() - startTime,
      };
    }

    const bridgeAvailable = await this.bridge.isAvailable();
    if (!bridgeAvailable) {
      return {
        success: false,
        action: 'SHUTDOWN',
        target: 'System',
        message: 'Desktop system control is unavailable in this environment.',
        errorCode: 'BRIDGE_UNAVAILABLE',
        executionTimeMs: Date.now() - startTime,
      };
    }

    const result = await this.bridge.shutdown();
    const duration = Date.now() - startTime;

    if (!result.success) {
      return {
        success: false,
        action: 'SHUTDOWN',
        target: 'System',
        message: result.error || 'Failed to shut down macOS.',
        errorCode: 'BRIDGE_ERROR',
        executionTimeMs: duration,
      };
    }

    return {
      success: true,
      action: 'SHUTDOWN',
      target: 'System',
      message: 'Shutting down macOS...',
      executionTimeMs: duration,
    };
  }
}

export const systemExecutor = new SystemExecutor();
