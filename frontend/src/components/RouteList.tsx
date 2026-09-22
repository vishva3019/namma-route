import React from 'react';
import { RouteListItem } from '../types/route';
import RouteCard from './RouteCard';
import EmptyState from './EmptyState';

interface RouteListProps {
  routes: RouteListItem[];
  selectedRouteNumber?: string | null;
  onSelectRoute: (routeNumber: string) => void;
}

export const RouteList: React.FC<RouteListProps> = ({
  routes,
  selectedRouteNumber,
  onSelectRoute,
}) => {
  if (routes.length === 0) {
    return (
      <EmptyState
        title="No routes found"
        description="Try searching for another BMTC route code like 500D, 335E, or 356."
      />
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {routes.map((route) => (
        <RouteCard
          key={route.id}
          route={route}
          isSelected={selectedRouteNumber === route.routeNumber}
          onSelect={onSelectRoute}
        />
      ))}
    </div>
  );
};

export default RouteList;
