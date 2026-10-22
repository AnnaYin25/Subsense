
import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Onboarding from './pages/Onboarding.tsx';
import Setup from './pages/Setup.tsx';
import Hub from './pages/Hub.tsx';
import Report from './pages/Report.tsx';
import Assessment from './pages/Assessment.tsx';
import CheckIn from './pages/CheckIn.tsx';
import AddSubscription from './pages/AddSubscription.tsx';
import SubscriptionDetail from './pages/SubscriptionDetail.tsx';
import { BottomNav } from './components/BottomNav.tsx';
import { SubscriptionProvider } from './context/SubscriptionContext.tsx';

const App: React.FC = () => {
  return (
    <SubscriptionProvider>
      <Router>
        <div className="bg-gray-100 dark:bg-black min-h-screen flex justify-center">
          {/* Container to restrict width on desktop, mimics mobile app */}
          <div className="w-full max-w-md bg-background-light dark:bg-background-dark min-h-screen relative shadow-2xl">
            <Routes>
              <Route path="/" element={<Navigate to="/onboarding" replace />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/setup" element={<Setup />} />
              <Route path="/hub" element={<Hub />} />
              <Route path="/report" element={<Report />} />
              <Route path="/assessment" element={<Assessment />} />
              <Route path="/checkin" element={<CheckIn />} />
              <Route path="/add" element={<AddSubscription />} />
              <Route path="/subscription/:id" element={<SubscriptionDetail />} />
            </Routes>
            <BottomNav />
          </div>
        </div>
      </Router>
    </SubscriptionProvider>
  );
};

export default App;
