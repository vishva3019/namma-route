import { GtfsNetworkImporter } from '../src/providers/gtfs/GtfsNetworkImporter';
import prisma from '../src/db/prisma';

async function main() {
  console.log('====================================================');
  console.log('   NammaRoute BMTC Network Refresh');
  console.log('====================================================');

  try {
    const stats = await GtfsNetworkImporter.importCompleteNetwork();
    console.log(`Successfully refreshed network in ${stats.durationSeconds.toFixed(2)}s.`);
  } catch (err) {
    console.error('Network refresh failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
