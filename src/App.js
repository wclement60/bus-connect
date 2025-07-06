import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import NetworkList from './components/NetworkList';
import LineList from './components/LineList';
import DirectionList from './components/DirectionList';
import Timetable from './components/Timetable';
import Admin from './pages/Admin';
import TestRealtimeData from './pages/TestRealtimeData';
import BottomNavBar from './components/BottomNavBar';
import Footer from './components/Footer';
import Login from './pages/Login';
import Register from './pages/Register';
import Account from './pages/Account';
import ResetPassword from './pages/ResetPassword';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { ForumNotificationProvider } from './context/ForumNotificationContext';
import { AnimationProvider } from './context/AnimationContext';
import DebugProfile from './pages/DebugProfile';
import Favorites from './pages/Favorites';
import Horaires from './pages/Horaires';
import Contact from './pages/Contact';
import Itineraries from './pages/Itineraries';
import PrivacyPolicy from './pages/PrivacyPolicy';
import LegalNotice from './pages/LegalNotice';
import Forum from './pages/Forum';
import ForumCategory from './pages/ForumCategory';
import ForumPost from './pages/ForumPost';
import TestForumNotifications from './pages/TestForumNotifications';
import WelcomeModal from './components/WelcomeModal';
import ReferralPromotionModal from './components/ReferralPromotionModal';
import ProtectedAdminRoute from './components/ProtectedAdminRoute';
import ReferralLeaderboard from './pages/ReferralLeaderboard';
import TrafficInfo from './pages/TrafficInfo';
import UserAlerts from './pages/UserAlerts';
import { shouldShowWelcomeModal, markWelcomeModalAsShown } from './services/welcomeService';
import ScrollToTop from './components/ScrollToTop';
import ForumNavbar from './components/ForumNavbar';
import PriorityAlertBanner from './components/PriorityAlertBanner';
import './App.css';
import GoogleAnalytics from './components/GoogleAnalytics';
import usePageTracking from './hooks/usePageTracking';
import './services/imageUploadService'; // Initialiser le bucket d'images
import './utils/modalUtils'; // Initialiser les utilitaires de modal

function AppContent() {
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const location = useLocation();
  usePageTracking();







  useEffect(() => {
    // Vérifier si la modal de bienvenue doit être affichée
    const shouldShow = shouldShowWelcomeModal();
    setShowWelcomeModal(shouldShow);
  }, []);

  const handleCloseWelcomeModal = () => {
    // Marquer la modal comme affichée pour cette version
    markWelcomeModalAsShown();
    setShowWelcomeModal(false);
  };

  const showForumNavbar = !location.pathname.startsWith('/forum');

  return (
    <>
      <ScrollToTop />
      <PriorityAlertBanner />
      {showForumNavbar && <ForumNavbar />}
      <div className="min-h-screen bg-gray-50 dark:bg-dark-900 flex flex-col pb-16 transition-colors duration-200">
        <div className="flex-grow">
          <Routes>
            <Route path="/" element={<NetworkList />} />
            <Route path="/network/:networkId/lines" element={<LineList />} />
            <Route path="/network/:networkId/line/:lineId/directions" element={<DirectionList />} />
            <Route path="/network/:networkId/line/:lineId/direction/:directionId/timetable" element={<Timetable />} />
            <Route path="/admin/*" element={<ProtectedAdminRoute><Admin /></ProtectedAdminRoute>} />
            <Route path="/test-realtime/:networkId/:lineId" element={<TestRealtimeData />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/account" element={<Account />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/debug-profile" element={<DebugProfile />} />
            <Route path="/favorites" element={<Favorites />} />
            <Route path="/horaires" element={<Horaires />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/itineraries" element={<Itineraries />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/legal-notice" element={<LegalNotice />} />
            <Route path="/forum" element={<Forum />} />
            <Route path="/forum/category/:categoryId" element={<ForumCategory />} />
            <Route path="/forum/post/:postId" element={<ForumPost />} />
            <Route path="/test-forum-notifications" element={<TestForumNotifications />} />
            <Route path="/referral-leaderboard" element={<ReferralLeaderboard />} />
            <Route path="/traffic-info" element={<TrafficInfo />} />
            <Route path="/my-alerts" element={<UserAlerts />} />
          </Routes>
        </div>
        <Footer />
        <BottomNavBar />
      </div>
      
      {/* Modal de bienvenue */}
      {showWelcomeModal && <WelcomeModal onClose={handleCloseWelcomeModal} />}
      
      {/* Modal de promotion du parrainage */}
      <ReferralPromotionModal />
    </>
  );
}

function App() {
  const GA_MEASUREMENT_ID = 'G-3XW783VZ82';

  return (
    <ThemeProvider>
      <ToastProvider>
        <Router basename="/">
          <AuthProvider>
            <AnimationProvider>
              <ForumNotificationProvider>
                <GoogleAnalytics measurementId={GA_MEASUREMENT_ID} />
                <AppContent />
              </ForumNotificationProvider>
            </AnimationProvider>
          </AuthProvider>
        </Router>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
