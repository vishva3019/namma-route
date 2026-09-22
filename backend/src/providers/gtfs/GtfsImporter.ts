import { GtfsNetworkImporter, NetworkImportStats } from './GtfsNetworkImporter';

export interface ImportStats {
  stopsCount: number;
  routesCount: number;
  tripsCount: number;
  stopTimesCount: number;
  errors: string[];
}

export class GtfsImporter {
  /**
   * Import all GTFS files delegating to high-performance GtfsNetworkImporter
   */
  static async importFromDirectory(dirPath?: string): Promise<ImportStats> {
    const stats: NetworkImportStats = await GtfsNetworkImporter.importCompleteNetwork(dirPath);
    return {
      stopsCount: stats.stopsCount,
      routesCount: stats.routesCount,
      tripsCount: stats.tripsCount,
      stopTimesCount: stats.stopTimesCount,
      errors: stats.errors,
    };
  }
}

export default GtfsImporter;
