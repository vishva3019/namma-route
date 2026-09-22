import { GtfsNetworkImporter } from '../src/providers/gtfs/GtfsNetworkImporter';
import prisma from '../src/db/prisma';

async function main() {
  console.log('====================================================');
  console.log('   NammaRoute BMTC Complete Network Ingestion');
  console.log('====================================================');

  try {
    const stats = await GtfsNetworkImporter.importCompleteNetwork();
    console.log('\n====================================================');
    console.log('   Ingestion Completed Successfully!');
    console.log('====================================================');
    console.log(`Routes:       ${stats.routesCount}`);
    console.log(`Stops:        ${stats.stopsCount}`);
    console.log(`Variants:     ${stats.variantsCount}`);
    console.log(`Route Stops:  ${stats.routeStopsCount}`);
    console.log(`Trips:        ${stats.tripsCount}`);
    console.log(`Stop Times:   ${stats.stopTimesCount}`);
    console.log(`Shapes:       ${stats.shapesCount}`);
    console.log(`Aliases:      ${stats.aliasesCount}`);
    console.log(`Time Taken:   ${stats.durationSeconds.toFixed(2)}s`);
    console.log('====================================================\n');
  } catch (err) {
    console.error('Network ingestion failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
