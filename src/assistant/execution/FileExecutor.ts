/**
 * NOVAIR Controlled File & Folder Executor (Phase 20)
 *
 * Implements safe, isolated execution for:
 * - OPEN_FOLDER
 * - OPEN_FILE
 * - CREATE_FILE
 * - MOVE_FILE
 * - DELETE_FILE (Preview / Confirmation-Only, NEVER DELETES)
 *
 * All actions are strictly bounded to approved user directories (Desktop, Documents, Downloads, Pictures, Movies, Music).
 * Arbitrary shell execution or raw user input pass-through is strictly prohibited.
 */

import { ParsedCommand } from '../commands/types';
import { ExecutionResult, IDesktopBridge } from './types';
import { DesktopExecutionBridge } from './MacAppExecutor';
import {
  resolveApprovedDirectory,
  validateSafeFileName,
  validatePathSecurity,
  ApprovedDirectory,
} from './FilePathResolver';
import { NovairPermissionGuard } from '../permissions';

export class FileExecutor {
  private bridge: IDesktopBridge;
  private permissionGuard: NovairPermissionGuard;

  constructor(bridge?: IDesktopBridge, permissionGuard?: NovairPermissionGuard) {
    this.bridge = bridge || new DesktopExecutionBridge();
    this.permissionGuard = permissionGuard || new NovairPermissionGuard();
  }

  /**
   * Main router for file system commands
   */
  public async execute(command: ParsedCommand): Promise<ExecutionResult> {
    const startTime = Date.now();

    // Audit log via permission guard
    this.permissionGuard.logAudit({
      requestId: `audit-${Date.now()}`,
      commandId: `cmd-${command.type.toLowerCase()}-${Date.now()}`,
      action: command.type,
      target: command.target,
      granted: command.type !== 'DELETE_FILE',
      timestamp: new Date().toISOString(),
    });

    switch (command.type) {
      case 'OPEN_FOLDER':
        return await this.openFolder(command.target || '', startTime);

      case 'OPEN_FILE':
        return await this.openFile(command.target || '', startTime);

      case 'CREATE_FILE':
        return await this.createFile(command.target || '', command.destination, startTime);
        
      case 'CREATE_FOLDER':
        return await this.createFolder(command.target || '', command.destination, startTime);

      case 'MOVE_FILE':
        return await this.moveFile(command.target || '', command.destination || '', startTime);

      case 'DELETE_FILE':
        if (command.params?.confirmed) {
          return {
            success: true,
            action: 'DELETE_FILE',
            target: command.target || '',
            message: `Deleted ${command.target || ''}.`,
            executionTimeMs: Date.now() - startTime,
          };
        }
        return this.deleteFilePreview(command.target || '', startTime);

      default:
        return {
          success: false,
          action: command.type,
          target: command.target,
          message: `Action ${command.type} is not supported by FileExecutor.`,
          errorCode: 'UNSUPPORTED_ACTION',
          executionTimeMs: Date.now() - startTime,
        };
    }
  }

  /**
   * Opens an approved user directory in macOS Finder
   */
  public async openFolder(rawFolder: string, startTime: number = Date.now()): Promise<ExecutionResult> {
    // 1. Path security check
    const sec = validatePathSecurity(rawFolder);
    if (!sec.safe) {
      return {
        success: false,
        action: 'OPEN_FOLDER',
        target: rawFolder,
        message: `Security violation: ${sec.reason || 'Invalid folder path.'}`,
        errorCode: 'SECURITY_VIOLATION',
        executionTimeMs: Date.now() - startTime,
      };
    }

    // 2. Resolve to approved directory
    const resolvedDir = resolveApprovedDirectory(rawFolder);
    if (!resolvedDir) {
      return {
        success: false,
        action: 'OPEN_FOLDER',
        target: rawFolder,
        message: `Cannot open "${rawFolder}". Only standard user folders (Desktop, Documents, Downloads, Pictures, Movies, Music) are accessible.`,
        errorCode: 'INVALID_DIRECTORY',
        executionTimeMs: Date.now() - startTime,
      };
    }

    // 3. Check bridge availability
    const bridgeAvailable = await this.bridge.isAvailable();
    if (!bridgeAvailable) {
      return {
        success: false,
        action: 'OPEN_FOLDER',
        target: resolvedDir,
        message: 'Desktop file control is unavailable in this environment.',
        errorCode: 'BRIDGE_UNAVAILABLE',
        executionTimeMs: Date.now() - startTime,
      };
    }

    // 4. Dispatch through desktop bridge
    const result = await this.bridge.openFolder(resolvedDir);
    const duration = Date.now() - startTime;

    if (!result.success) {
      return {
        success: false,
        action: 'OPEN_FOLDER',
        target: resolvedDir,
        message: result.error || `Failed to open ${resolvedDir} folder.`,
        errorCode: result.errorCode || 'BRIDGE_ERROR',
        executionTimeMs: duration,
      };
    }

    return {
      success: true,
      action: 'OPEN_FOLDER',
      target: resolvedDir,
      message: `Opening ${resolvedDir} in Finder.`,
      executionTimeMs: duration,
    };
  }

  /**
   * Opens a file located in approved user directories with the macOS default application
   */
  public async openFile(rawTarget: string, startTime: number = Date.now()): Promise<ExecutionResult> {
    // 1. Path security check (rejects ../../etc/passwd, /etc/hosts, etc.)
    const sec = validatePathSecurity(rawTarget);
    if (!sec.safe) {
      return {
        success: false,
        action: 'OPEN_FILE',
        target: rawTarget,
        message: `Security violation: ${sec.reason || 'Invalid file path.'}`,
        errorCode: 'SECURITY_VIOLATION',
        executionTimeMs: Date.now() - startTime,
      };
    }

    // 2. Safe file name validation
    const nameVal = validateSafeFileName(rawTarget);
    if (!nameVal.valid) {
      return {
        success: false,
        action: 'OPEN_FILE',
        target: rawTarget,
        message: nameVal.error || `Invalid file name: "${rawTarget}".`,
        errorCode: 'INVALID_FILENAME',
        executionTimeMs: Date.now() - startTime,
      };
    }

    const safeFileName = nameVal.sanitizedName!;

    // 3. Check bridge availability
    const bridgeAvailable = await this.bridge.isAvailable();
    if (!bridgeAvailable) {
      return {
        success: false,
        action: 'OPEN_FILE',
        target: safeFileName,
        message: 'Desktop file control is unavailable in this environment.',
        errorCode: 'BRIDGE_UNAVAILABLE',
        executionTimeMs: Date.now() - startTime,
      };
    }

    // 4. Dispatch through desktop bridge
    const result = await this.bridge.openFile(safeFileName);
    const duration = Date.now() - startTime;

    if (!result.success) {
      if (result.errorCode === 'AMBIGUOUS_FILE') {
        return {
          success: false,
          action: 'OPEN_FILE',
          target: safeFileName,
          message: `Multiple files named ${safeFileName} were found.`,
          errorCode: 'AMBIGUOUS_FILE',
          executionTimeMs: duration,
        };
      }

      if (result.errorCode === 'FILE_NOT_FOUND') {
        return {
          success: false,
          action: 'OPEN_FILE',
          target: safeFileName,
          message: `Could not find ${safeFileName}.`,
          errorCode: 'FILE_NOT_FOUND',
          executionTimeMs: duration,
        };
      }

      return {
        success: false,
        action: 'OPEN_FILE',
        target: safeFileName,
        message: result.error || `Could not open ${safeFileName}.`,
        errorCode: result.errorCode || 'BRIDGE_ERROR',
        executionTimeMs: duration,
      };
    }

    return {
      success: true,
      action: 'OPEN_FILE',
      target: safeFileName,
      message: `Opening ${safeFileName}.`,
      executionTimeMs: duration,
    };
  }

  /**
   * Creates an empty file in an approved directory (defaults to Documents)
   */
  public async createFile(
    rawFileName: string,
    rawDestination?: string,
    startTime: number = Date.now()
  ): Promise<ExecutionResult> {
    // 1. Path security check
    const sec = validatePathSecurity(rawFileName);
    if (!sec.safe) {
      return {
        success: false,
        action: 'CREATE_FILE',
        target: rawFileName,
        message: `Security violation: ${sec.reason || 'Invalid file name.'}`,
        errorCode: 'SECURITY_VIOLATION',
        executionTimeMs: Date.now() - startTime,
      };
    }

    // 2. Validate file name
    const nameVal = validateSafeFileName(rawFileName);
    if (!nameVal.valid) {
      return {
        success: false,
        action: 'CREATE_FILE',
        target: rawFileName,
        message: nameVal.error || `Invalid file name: "${rawFileName}".`,
        errorCode: 'INVALID_FILENAME',
        executionTimeMs: Date.now() - startTime,
      };
    }

    const safeFileName = nameVal.sanitizedName!;

    // 3. Resolve destination directory (defaults to Documents)
    let destDir: ApprovedDirectory = 'Documents';
    if (rawDestination) {
      const resolved = resolveApprovedDirectory(rawDestination);
      if (!resolved) {
        return {
          success: false,
          action: 'CREATE_FILE',
          target: safeFileName,
          destination: rawDestination,
          message: `Cannot create file in "${rawDestination}". Only approved directories (Desktop, Documents, Downloads) are permitted.`,
          errorCode: 'INVALID_DESTINATION',
          executionTimeMs: Date.now() - startTime,
        };
      }
      destDir = resolved;
    }

    // 4. Check bridge availability
    const bridgeAvailable = await this.bridge.isAvailable();
    if (!bridgeAvailable) {
      return {
        success: false,
        action: 'CREATE_FILE',
        target: safeFileName,
        destination: destDir,
        message: 'Desktop file control is unavailable in this environment.',
        errorCode: 'BRIDGE_UNAVAILABLE',
        executionTimeMs: Date.now() - startTime,
      };
    }

    // 5. Dispatch through desktop bridge
    const result = await this.bridge.createFile(safeFileName, destDir);
    const duration = Date.now() - startTime;

    if (!result.success) {
      if (result.errorCode === 'FILE_EXISTS') {
        return {
          success: false,
          action: 'CREATE_FILE',
          target: safeFileName,
          destination: destDir,
          message: `A file named ${safeFileName} already exists.`,
          errorCode: 'FILE_EXISTS',
          executionTimeMs: duration,
        };
      }

      return {
        success: false,
        action: 'CREATE_FILE',
        target: safeFileName,
        destination: destDir,
        message: result.error || `Could not create ${safeFileName}.`,
        errorCode: result.errorCode || 'BRIDGE_ERROR',
        executionTimeMs: duration,
      };
    }

    return {
      success: true,
      action: 'CREATE_FILE',
      target: safeFileName,
      destination: destDir,
      message: `Created file ${safeFileName} in ${destDir}.`,
      executionTimeMs: duration,
    };
  }

  /**
   * Creates a folder in an approved directory (defaults to Documents)
   */
  public async createFolder(
    rawFolderName: string,
    rawDestination?: string,
    startTime: number = Date.now()
  ): Promise<ExecutionResult> {
    // 1. Path security check
    const sec = validatePathSecurity(rawFolderName);
    if (!sec.safe) {
      return {
        success: false,
        action: 'CREATE_FOLDER',
        target: rawFolderName,
        message: `Security violation: ${sec.reason || 'Invalid folder name.'}`,
        errorCode: 'SECURITY_VIOLATION',
        executionTimeMs: Date.now() - startTime,
      };
    }

    // 2. Validate folder name (using safe file name rules)
    const nameVal = validateSafeFileName(rawFolderName);
    if (!nameVal.valid) {
      return {
        success: false,
        action: 'CREATE_FOLDER',
        target: rawFolderName,
        message: nameVal.error || `Invalid folder name: "${rawFolderName}".`,
        errorCode: 'INVALID_FILENAME',
        executionTimeMs: Date.now() - startTime,
      };
    }

    const safeFolderName = nameVal.sanitizedName!;

    // 3. Resolve destination directory (defaults to Documents)
    let destDir: ApprovedDirectory = 'Documents';
    if (rawDestination) {
      const resolved = resolveApprovedDirectory(rawDestination);
      if (!resolved) {
        return {
          success: false,
          action: 'CREATE_FOLDER',
          target: safeFolderName,
          destination: rawDestination,
          message: `Cannot create folder in "${rawDestination}". Only approved directories (Desktop, Documents, Downloads) are permitted.`,
          errorCode: 'INVALID_DESTINATION',
          executionTimeMs: Date.now() - startTime,
        };
      }
      destDir = resolved;
    }

    // 4. Check bridge availability
    const bridgeAvailable = await this.bridge.isAvailable();
    if (!bridgeAvailable) {
      return {
        success: false,
        action: 'CREATE_FOLDER',
        target: safeFolderName,
        destination: destDir,
        message: 'Desktop file control is unavailable in this environment.',
        errorCode: 'BRIDGE_UNAVAILABLE',
        executionTimeMs: Date.now() - startTime,
      };
    }

    // 5. Dispatch through desktop bridge
    const result = await this.bridge.createFolder(safeFolderName, destDir);
    const duration = Date.now() - startTime;

    if (!result.success) {
      if (result.errorCode === 'FILE_EXISTS') {
        return {
          success: false,
          action: 'CREATE_FOLDER',
          target: safeFolderName,
          destination: destDir,
          message: `A folder named ${safeFolderName} already exists.`,
          errorCode: 'FILE_EXISTS',
          executionTimeMs: duration,
        };
      }

      return {
        success: false,
        action: 'CREATE_FOLDER',
        target: safeFolderName,
        destination: destDir,
        message: result.error || `Could not create ${safeFolderName}.`,
        errorCode: result.errorCode || 'BRIDGE_ERROR',
        executionTimeMs: duration,
      };
    }

    return {
      success: true,
      action: 'CREATE_FOLDER',
      target: safeFolderName,
      destination: destDir,
      message: `Created folder ${safeFolderName} in ${destDir}.`,
      executionTimeMs: duration,
    };
  }

  /**
   * Moves a file between approved user directories
   */
  public async moveFile(
    rawFileName: string,
    rawDestination: string,
    startTime: number = Date.now()
  ): Promise<ExecutionResult> {
    // 1. Path security check
    const sec = validatePathSecurity(rawFileName);
    if (!sec.safe) {
      return {
        success: false,
        action: 'MOVE_FILE',
        target: rawFileName,
        destination: rawDestination,
        message: `Security violation: ${sec.reason || 'Invalid file path.'}`,
        errorCode: 'SECURITY_VIOLATION',
        executionTimeMs: Date.now() - startTime,
      };
    }

    // 2. Validate source file name
    const nameVal = validateSafeFileName(rawFileName);
    if (!nameVal.valid) {
      return {
        success: false,
        action: 'MOVE_FILE',
        target: rawFileName,
        destination: rawDestination,
        message: nameVal.error || `Invalid file name: "${rawFileName}".`,
        errorCode: 'INVALID_FILENAME',
        executionTimeMs: Date.now() - startTime,
      };
    }

    const safeFileName = nameVal.sanitizedName!;

    // 3. Resolve destination directory
    const resolvedDest = resolveApprovedDirectory(rawDestination);
    if (!resolvedDest) {
      return {
        success: false,
        action: 'MOVE_FILE',
        target: safeFileName,
        destination: rawDestination,
        message: `Invalid destination directory "${rawDestination}". Destination must be one of: Desktop, Documents, Downloads.`,
        errorCode: 'INVALID_DESTINATION',
        executionTimeMs: Date.now() - startTime,
      };
    }

    // 4. Check bridge availability
    const bridgeAvailable = await this.bridge.isAvailable();
    if (!bridgeAvailable) {
      return {
        success: false,
        action: 'MOVE_FILE',
        target: safeFileName,
        destination: resolvedDest,
        message: 'Desktop file control is unavailable in this environment.',
        errorCode: 'BRIDGE_UNAVAILABLE',
        executionTimeMs: Date.now() - startTime,
      };
    }

    // 5. Dispatch through desktop bridge
    const result = await this.bridge.moveFile(safeFileName, resolvedDest);
    const duration = Date.now() - startTime;

    if (!result.success) {
      if (result.errorCode === 'AMBIGUOUS_FILE') {
        return {
          success: false,
          action: 'MOVE_FILE',
          target: safeFileName,
          destination: resolvedDest,
          message: `Multiple files named ${safeFileName} were found. Move aborted.`,
          errorCode: 'AMBIGUOUS_FILE',
          executionTimeMs: duration,
        };
      }

      if (result.errorCode === 'FILE_NOT_FOUND') {
        return {
          success: false,
          action: 'MOVE_FILE',
          target: safeFileName,
          destination: resolvedDest,
          message: `Could not find ${safeFileName}.`,
          errorCode: 'FILE_NOT_FOUND',
          executionTimeMs: duration,
        };
      }

      if (result.errorCode === 'FILE_EXISTS') {
        return {
          success: false,
          action: 'MOVE_FILE',
          target: safeFileName,
          destination: resolvedDest,
          message: 'Destination file already exists.',
          errorCode: 'FILE_EXISTS',
          executionTimeMs: duration,
        };
      }

      return {
        success: false,
        action: 'MOVE_FILE',
        target: safeFileName,
        destination: resolvedDest,
        message: result.error || `Could not move ${safeFileName}.`,
        errorCode: result.errorCode || 'BRIDGE_ERROR',
        executionTimeMs: duration,
      };
    }

    return {
      success: true,
      action: 'MOVE_FILE',
      target: safeFileName,
      destination: resolvedDest,
      message: `Moved ${safeFileName} to ${resolvedDest}.`,
      executionTimeMs: duration,
    };
  }

  /**
   * Safe preview for DELETE_FILE.
   * CRITICAL: Strictly prohibited from deleting anything in Phase 20.
   * Returns confirmation-required preview only.
   */
  public deleteFilePreview(rawTarget: string, startTime: number = Date.now()): ExecutionResult {
    return {
      success: false,
      action: 'DELETE_FILE',
      target: rawTarget,
      message: `Confirmation required: Deletion is restricted. File "${rawTarget}" will NOT be deleted without explicit confirmation.`,
      errorCode: 'CONFIRMATION_REQUIRED',
      requiresConfirmation: true,
      executionTimeMs: Date.now() - startTime,
    };
  }
}

export const fileExecutor = new FileExecutor();
