import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import RoutesPage from './pages/Routes';
import RouteDetailsPage from './pages/RouteDetailsPage';
import StopsPage from './pages/Stops';
import StopDetailsPage from './pages/StopDetailsPage';
import TrackBus from './pages/TrackBus';
import JourneyPlannerPage from './pages/JourneyPlannerPage';
import Nearby from './pages/Nearby';
import Settings from './pages/Settings';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 10000,
      refetchOnWindowFocus: false,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
          <Navbar />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/routes" element={<RoutesPage />} />
              <Route path="/routes/:routeId" element={<RouteDetailsPage />} />
              <Route path="/stops" element={<StopsPage />} />
              <Route path="/stops/:stopId" element={<StopDetailsPage />} />
              <Route path="/track/:vehicleId" element={<TrackBus />} />
              <Route path="/journey" element={<JourneyPlannerPage />} />
              <Route path="/nearby" element={<Nearby />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
