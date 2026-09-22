import { GtfsImporter } from '../src/providers/gtfs/GtfsImporter';

async function main() {
  try {
    const stats = await GtfsImporter.importFromDirectory();
    console.log('GTFS ingestion completed successfully!', stats);
    process.exit(0);
  } catch (error) {
    console.error('GTFS ingestion failed:', error);
    process.exit(1);
  }
}

main();
