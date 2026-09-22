import React, { useState } from 'react';
import JourneyPlanner from '../components/JourneyPlanner';
import MapView from '../components/MapView';
import { JourneyPlan } from '../types/journey';

export const JourneyPlannerPage: React.FC = () => {
  const [selectedPlan, setSelectedPlan] = useState<JourneyPlan | null>(null);

  // Combine geometries from all legs of selected plan
  const planGeometry: [number, number][] = selectedPlan
    ? selectedPlan.legs.flatMap((l) => l.geometry)
    : [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Journey Planner Form & Route Cards */}
        <div className="lg:col-span-5">
          <JourneyPlanner
            onSelectPlan={(plan) => setSelectedPlan(plan)}
            defaultFrom="Majestic"
            defaultTo="Electronic City"
          />
        </div>

        {/* Right Column: Visual Journey Corridor on Map */}
        <div className="lg:col-span-7 h-[500px] lg:h-[650px] rounded-3xl overflow-hidden shadow-lg border border-slate-200">
          <MapView
            routeGeometry={planGeometry.length > 0 ? planGeometry : null}
            routeStops={
              selectedPlan
                ? selectedPlan.legs.flatMap((l) => [l.fromStop, ...l.intermediateStops, l.toStop]) as any
                : null
            }
          />
        </div>
      </div>
    </div>
  );
};

export default JourneyPlannerPage;
