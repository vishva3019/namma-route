import { dataStatsService } from '../src/services/dataStatsService';
import prisma from '../src/db/prisma';

async function main() {
  console.log('====================================================');
  console.log('   NammaRoute BMTC Network Completeness Audit');
  console.log('====================================================');

  try {
    const res = await dataStatsService.getNetworkCompleteness();
    const d = res.data;

    console.log(`Coverage Status:       ${d.coverageStatus}`);
    console.log(`Classification:        ${d.classification}`);
    console.log('\n--- STATIC NETWORK COVERAGE ---');
    console.log(`Static Routes:         ${d.staticNetworkCoverage.routes.toLocaleString()}`);
    console.log(`Route Variants:        ${d.staticNetworkCoverage.routeVariants.toLocaleString()}`);
    console.log(`Static Stops:          ${d.staticNetworkCoverage.stops.toLocaleString()}`);
    console.log(`Scheduled Trips:       ${d.staticNetworkCoverage.scheduledTrips.toLocaleString()}`);
    console.log(`Stop Times:            ${d.staticNetworkCoverage.stopTimes.toLocaleString()}`);
    console.log(`Shapes:                ${d.staticNetworkCoverage.shapes.toLocaleString()}`);
    console.log(`Landmark Aliases:      ${d.staticNetworkCoverage.landmarkAliases.toLocaleString()}`);

    console.log('\n--- REALTIME GPS COVERAGE ---');
    console.log(`Provider:              ${d.realtimeGpsCoverage.provider}`);
    console.log(`Realtime Status:       ${d.realtimeGpsCoverage.realtimeStatus}`);
    console.log(`Live Vehicles:         ${d.realtimeGpsCoverage.liveVehiclesTransmitting}`);
    console.log(`Routes in Realtime:    ${d.realtimeGpsCoverage.routesCurrentlyRepresentedInRealtime}`);
    console.log(`Routes w/o Realtime:   ${d.realtimeGpsCoverage.routesWithoutRealtimeVehicles}`);
    console.log(`Data Age:              ${d.realtimeGpsCoverage.dataAgeSeconds}s`);

    console.log('\n--- CATEGORIES THAT CANNOT BE VERIFIED ---');
    for (const c of d.categoriesCannotBeVerified) {
      console.log(`* ${c}`);
    }

    console.log('\n--- MISSING DATA ---');
    for (const m of d.missingData) {
      console.log(`* ${m}`);
    }

    console.log('\n--- WARNINGS ---');
    for (const w of d.warnings) {
      console.log(`! ${w}`);
    }
    console.log('====================================================\n');
  } catch (err) {
    console.error('Network completeness audit failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
