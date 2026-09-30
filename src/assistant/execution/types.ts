import { CommandActionType } from '../commands/types';
import { AllowedSystemSetting } from './systemActionRegistry';

export interface AppRegistryEntry {
  canonicalName: string;
  aliases: string[];
  bundleId: string;
  allowedActions: ('OPEN_APP' | 'CLOSE_APP')[];
  description?: string;
}

export interface ExecutionResult {
  success: boolean;
  action: CommandActionType;
  target?: string;
  destination?: string;
  query?: string;
  message: string;
  errorCode?: string;
  requiresConfirmation?: boolean;
  executionTimeMs?: number;
  data?: any; // For propagating structured results between steps
}

export interface FileBridgeResult {
  success: boolean;
  error?: string;
  errorCode?: string;
  path?: string;
  message?: string;
  matchedCount?: number;
}

export interface IDesktopBridge {
  isAvailable(): Promise<boolean>;
  openApp(bundleId: string): Promise<{ success: boolean; error?: string }>;
  closeApp(bundleId: string): Promise<{ success: boolean; error?: string }>;
  openUrl(url: string): Promise<{ success: boolean; error?: string }>;
  openFolder(folderName: string): Promise<FileBridgeResult>;
  openFile(fileName: string): Promise<FileBridgeResult>;
  createFile(fileName: string, destination?: string): Promise<FileBridgeResult>;
  createFolder(folderName: string, destination?: string): Promise<FileBridgeResult>;
  moveFile(fileName: string, destination: string): Promise<FileBridgeResult>;
  setSystemSetting(setting: AllowedSystemSetting): Promise<{ success: boolean; error?: string; message?: string }>;
  sleep(): Promise<{ success: boolean; error?: string }>;
  restart(): Promise<{ success: boolean; error?: string }>;
  shutdown(): Promise<{ success: boolean; error?: string }>;
}
