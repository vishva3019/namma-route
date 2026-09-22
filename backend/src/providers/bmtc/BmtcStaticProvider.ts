import { bmtcApiClient } from './BmtcApiClient';
import Logger from '../../utils/logger';

export class BmtcStaticProvider {
  async getAllRoutes() {
    try {
      const response = await bmtcApiClient.getAllRoutes();
      return response?.data || [];
    } catch (e: any) {
      Logger.warn('[BmtcStaticProvider] Failed to get all routes from external API', e);
      return [];
    }
  }

  async getRoutePoints(routeParentId: number) {
    try {
      const response = await bmtcApiClient.post('RoutePoints', { routeid: routeParentId });
      return response?.data || [];
    } catch (e: any) {
      Logger.warn(`[BmtcStaticProvider] Failed to get route points for ${routeParentId}`, e);
      return [];
    }
  }
}

export const bmtcStaticProvider = new BmtcStaticProvider();
export default bmtcStaticProvider;
