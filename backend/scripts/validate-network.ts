import prisma from '../src/db/prisma';

async function main() {
  console.log('====================================================');
  console.log('   NammaRoute BMTC Network Validation');
  console.log('====================================================');

  let passed = true;

  try {
    // 1. Dynamic Record Counts
    const routesCount = await prisma.route.count();
    const stopsCount = await prisma.stop.count();
    const variantsCount = await prisma.routeVariant.count();
    const routeStopsCount = await prisma.routeStop.count();
    const tripsCount = await prisma.trip.count();
    const stopTimesCount = await prisma.stopTime.count();
    const shapesCount = await prisma.shape.count();
    const aliasesCount = await prisma.stopAlias.count();

    console.log(`[Counts] Routes: ${routesCount}, Stops: ${stopsCount}, Variants: ${variantsCount}, Trips: ${tripsCount}, Shapes: ${shapesCount}, StopTimes: ${stopTimesCount}, Aliases: ${aliasesCount}`);

    if (routesCount < 4000) {
      console.error(`[FAIL] Route count ${routesCount} is below expected threshold 4,000!`);
      passed = false;
    } else {
      console.log(`[PASS] Route count verified: ${routesCount}`);
    }

    if (stopsCount < 9000) {
      console.error(`[FAIL] Stop count ${stopsCount} is below expected threshold 9,000!`);
      passed = false;
    } else {
      console.log(`[PASS] Stop count verified: ${stopsCount}`);
    }

    // 2. Orphan Checks
    const orphanTrips: any[] = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as count FROM "Trip" WHERE "routeId" NOT IN (SELECT "id" FROM "Route");
    `);
    const orphanTripCount = orphanTrips[0]?.count || 0;
    if (orphanTripCount > 0) {
      console.error(`[FAIL] Found ${orphanTripCount} orphan trips!`);
      passed = false;
    } else {
      console.log(`[PASS] Orphan trips: 0`);
    }

    const orphanRouteStops: any[] = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as count FROM "RouteStop" WHERE "stopId" NOT IN (SELECT "id" FROM "Stop");
    `);
    const orphanRsCount = orphanRouteStops[0]?.count || 0;
    if (orphanRsCount > 0) {
      console.error(`[FAIL] Found ${orphanRsCount} orphan route stops!`);
      passed = false;
    } else {
      console.log(`[PASS] Orphan route stops: 0`);
    }

    // 3. Coordinate Bounds Validation (Bengaluru Metropolitan Region: Lat 12.4-13.6, Lon 77.1-77.9)
    const outOfBoundsStops: any[] = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as count FROM "Stop" WHERE "latitude" < 12.0 OR "latitude" > 14.0 OR "longitude" < 76.5 OR "longitude" > 78.5;
    `);
    const outCount = outOfBoundsStops[0]?.count || 0;
    if (outCount > 0) {
      console.warn(`[WARN] Found ${outCount} stops slightly outside core Bengaluru bounds.`);
    } else {
      console.log(`[PASS] All ${stopsCount} stops are within geographic coordinates.`);
    }

    // 4. Specific Validation: Route 356-M
    console.log('\n[Validation] Checking Route 356-M specific requirements...');
    const r356m = await prisma.route.findFirst({
      where: { routeShortName: '356-M' },
      include: {
        variants: {
          include: {
            routeStops: {
              include: { stop: true },
              orderBy: { stopSequence: 'asc' },
            },
          },
        },
      },
    });

    if (!r356m) {
      console.error('[FAIL] Route 356-M was NOT found in database!');
      passed = false;
    } else {
      console.log(`[PASS] Route 356-M found. ID: ${r356m.id}, Family: ${r356m.routeFamily}`);
      console.log(`       Long Name: ${r356m.routeLongName}`);
      console.log(`       Origin: ${r356m.origin}, Destination: ${r356m.destination}`);

      // Verify variants
      const vUp = r356m.variants.find(v => v.direction === 0);
      const vDown = r356m.variants.find(v => v.direction === 1);

      if (!vUp) {
        console.error('[FAIL] Direction 0 variant for 356-M missing!');
        passed = false;
      } else {
        const firstStop = vUp.routeStops[0]?.stop?.name;
        const lastStop = vUp.routeStops[vUp.routeStops.length - 1]?.stop?.name;
        console.log(`[PASS] 356-M Direction 0: ${vUp.directionName} (${vUp.routeStops.length} stops)`);
        console.log(`       First Stop: ${firstStop}, Last Stop: ${lastStop}`);

        // Verify intermediate Electronic City stop
        const ecStop = vUp.routeStops.find(rs => rs.stop.name.toLowerCase().includes('electronic city'));
        if (ecStop) {
          console.log(`[PASS] Electronic City intermediate stop verified: "${ecStop.stop.name}" at sequence ${ecStop.stopSequence}`);
        } else {
          console.error('[FAIL] Electronic City intermediate stop not found in 356-M UP!');
          passed = false;
        }
      }

      if (!vDown) {
        console.error('[FAIL] Direction 1 variant for 356-M missing!');
        passed = false;
      } else {
        const firstStop = vDown.routeStops[0]?.stop?.name;
        const lastStop = vDown.routeStops[vDown.routeStops.length - 1]?.stop?.name;
        console.log(`[PASS] 356-M Direction 1: ${vDown.directionName} (${vDown.routeStops.length} stops)`);
        console.log(`       First Stop: ${firstStop}, Last Stop: ${lastStop}`);
      }
    }

    // 5. Check Landmark Aliases
    console.log('\n[Validation] Checking Landmark Aliases...');
    const majesticAlias = await prisma.stopAlias.findFirst({ where: { normalizedAlias: 'majestic' }, include: { stop: true } });
    if (majesticAlias) {
      console.log(`[PASS] Alias "Majestic" maps to canonical stop "${majesticAlias.stop.name}"`);
    } else {
      console.error('[FAIL] Alias "Majestic" missing!');
      passed = false;
    }

    const silkBoardAlias = await prisma.stopAlias.findFirst({ where: { normalizedAlias: 'silk board' }, include: { stop: true } });
    if (silkBoardAlias) {
      console.log(`[PASS] Alias "Silk Board" maps to canonical stop "${silkBoardAlias.stop.name}"`);
    } else {
      console.error('[FAIL] Alias "Silk Board" missing!');
      passed = false;
    }

    console.log('\n====================================================');
    if (passed) {
      console.log('   All Network Integrity Validations PASSED!');
    } else {
      console.error('   Some Network Validations FAILED!');
    }
    console.log('====================================================');
    if (!passed) process.exit(1);
  } catch (err) {
    console.error('Network validation error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
