import { apiFetch } from './api';
import { JourneyPlan } from '../types/journey';

export const journeyApi = {
  async planJourney(from: string, to: string): Promise<JourneyPlan[]> {
    const params = new URLSearchParams({ from, to });
    const res = await apiFetch<{ status: string; count: number; data: JourneyPlan[] }>(
      `/journey?${params.toString()}`
    );
    return res.data;
  },
};
