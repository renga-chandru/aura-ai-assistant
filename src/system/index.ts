import { SystemTelemetry, AuraState } from '@/types';

/**
 * System Platform Bridge & Telemetry Collector Stub
 */
export class SystemTelemetryCollector {
  public static getTelemetry(activeState: AuraState): SystemTelemetry {
    return {
      fps: 60,
      cpuUsagePercent: 4.5,
      memoryUsageMb: 124.0,
      gpuRenderer: 'Apple Metal / WebGL 2.0',
      activeState,
      uptimeSeconds: Math.floor(performance.now() / 1000),
    };
  }
}

/**
 * Desktop Application Awareness
 * Provides safe, restricted visibility into running applications.
 */
export class DesktopAwarenessService {
  private static runningApps: string[] = ['Finder'];
  private static activeApp: string | null = 'Finder';
  private static mockedFiles: Record<string, string[]> = {
    'Downloads': ['report.pdf', 'invoice.pdf', 'image.png'],
    'Documents': ['resume.pdf']
  };

  public static getRunningApps(): string[] {
    return [...this.runningApps];
  }

  public static getActiveApp(): string | null {
    return this.activeApp;
  }

  public static isAppRunning(canonicalName: string): boolean {
    return this.runningApps.includes(canonicalName);
  }

  public static getFilesInFolder(folder: string): string[] {
    return this.mockedFiles[folder] || [];
  }

  // Only for testing/mocking
  public static setMockState(running: string[], active: string | null, files?: Record<string, string[]>) {
    this.runningApps = running;
    this.activeApp = active;
    if (files) this.mockedFiles = files;
  }
}
