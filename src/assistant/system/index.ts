export interface DesktopSystemStatus {
  osPlatform: 'darwin' | 'win32' | 'linux';
  osRelease: string;
  cpuUsagePercent: number;
  memoryUsageMb: number;
  freeMemoryMb: number;
  uptimeSeconds: number;
  activeProcessName?: string;
}

export interface IDesktopPlatformBridge {
  getSystemStatus(): Promise<DesktopSystemStatus>;
  openApplication(appName: string): Promise<boolean>;
  closeApplication(appName: string): Promise<boolean>;
  openUrl(url: string): Promise<boolean>;
  openFile(filePath: string): Promise<boolean>;
  openFolder(folderPath: string): Promise<boolean>;
}

/**
 * NOVAIR Desktop Platform Telemetry Collector Stub
 */
export class NovairSystemCollector {
  public static getSystemStatus(): DesktopSystemStatus {
    return {
      osPlatform: 'darwin',
      osRelease: 'macOS Monterey/Sonoma/Sequoia',
      cpuUsagePercent: 3.8,
      memoryUsageMb: 128.0,
      freeMemoryMb: 8192.0,
      uptimeSeconds: Math.floor(performance.now() / 1000),
    };
  }
}
