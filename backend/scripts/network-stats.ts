import prisma from '../src/db/prisma';

async function main() {
  console.log('====================================================');
  console.log('   NammaRoute BMTC Dynamic Network Statistics');
  console.log('====================================================');

  try {
    const [
      routesCount,
      stopsCount,
      variantsCount,
      routeStopsCount,
      tripsCount,
      shapesCount,
      shapePointsAgg,
      stopTimesCount,
      aliasesCount,
      lastImport,
      dataSources,
    ] = await Promise.all([
      prisma.route.count(),
      prisma.stop.count(),
      prisma.routeVariant.count(),
      prisma.routeStop.count(),
      prisma.trip.count(),
      prisma.shape.count(),
      prisma.shape.aggregate({ _sum: { pointsCount: true } }),
      prisma.stopTime.count(),
      prisma.stopAlias.count(),
      prisma.dataImport.findFirst({ orderBy: { processedAt: 'desc' } }),
      prisma.dataSource.findMany(),
    ]);

    const shapePointsCount = shapePointsAgg._sum.pointsCount || 0;

    console.log(`Routes:                ${routesCount.toLocaleString()}`);
    console.log(`Route Variants:        ${variantsCount.toLocaleString()}`);
    console.log(`Stops:                 ${stopsCount.toLocaleString()}`);
    console.log(`Route Stops:           ${routeStopsCount.toLocaleString()}`);
    console.log(`Trips:                 ${tripsCount.toLocaleString()}`);
    console.log(`Stop Times:            ${stopTimesCount.toLocaleString()}`);
    console.log(`Shapes:                ${shapesCount.toLocaleString()}`);
    console.log(`Shape Points:          ${shapePointsCount.toLocaleString()}`);
    console.log(`Aliases:               ${aliasesCount.toLocaleString()}`);
    console.log(`Network Coverage:      PARTIAL NETWORK (All live-trackable BMTC routes from Namma BMTC)`);
    console.log(`Data Source:           ${dataSources.map((d: any) => `${d.name} (${d.version})`).join(', ') || 'BMTC GTFS'}`);
    console.log(`Last Ingested At:      ${lastImport?.processedAt ? new Date(lastImport.processedAt).toLocaleString() : 'N/A'}`);
    console.log(`Import Status:         ${lastImport?.status || 'N/A'}`);
    console.log('====================================================\n');
  } catch (err) {
    console.error('Failed to fetch network stats:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
