import prisma from '../db/prisma';

export class GtfsService {
  async getStats() {
    const [stopsCount, routesCount, tripsCount, stopTimesCount] = await Promise.all([
      prisma.stop.count(),
      prisma.route.count(),
      prisma.trip.count(),
      prisma.stopTime.count(),
    ]);

    return {
      stops: stopsCount,
      routes: routesCount,
      trips: tripsCount,
      stopTimes: stopTimesCount,
    };
  }
}

export const gtfsService = new GtfsService();
export default gtfsService;
