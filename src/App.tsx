import React, { useState } from 'react';
import {
  GasStation,
  CommunityPost,
  DriverReport,
  StationStatus,
  UserProfile,
} from './types';
import {
  INITIAL_STATIONS,
  INITIAL_POSTS,
  INITIAL_USER,
} from './data/mockData';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { MapScreen } from './components/MapScreen';
import { StationDetailScreen } from './components/StationDetailScreen';
import { CommunityScreen } from './components/CommunityScreen';
import { DiscussionScreen } from './components/DiscussionScreen';
import { ChatScreen } from './components/ChatScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { ReportStatusModal } from './components/ReportStatusModal';
import { OnboardingModal } from './components/OnboardingModal';
import { ProximityAlertBanner } from './components/ProximityAlertBanner';
import { CreatePostModal } from './components/CreatePostModal';

export const App: React.FC = () => {
  // Navigation State
  const [activeTab, setActiveTab] = useState<'map' | 'community' | 'profile'>('map');

  // Sub-screens state
  const [activeDetailStation, setActiveDetailStation] = useState<GasStation | null>(null);
  const [activeDiscussionPost, setActiveDiscussionPost] = useState<CommunityPost | null>(null);
  const [activeChatPost, setActiveChatPost] = useState<CommunityPost | null>(null);

  // Modals & Overlays
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportingStation, setReportingStation] = useState<GasStation | null>(null);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [proximityAlertStation, setProximityAlertStation] = useState<GasStation | null>(null);
  const [globalToast, setGlobalToast] = useState<string | null>(null);

  // Data Store
  const [stations, setStations] = useState<GasStation[]>(INITIAL_STATIONS);
  const [selectedStation, setSelectedStation] = useState<GasStation>(INITIAL_STATIONS[0]);
  const [posts, setPosts] = useState<CommunityPost[]>(INITIAL_POSTS);
  const [userProfile, setUserProfile] = useState<UserProfile>(INITIAL_USER);

  const showToast = (msg: string) => {
    setGlobalToast(msg);
    setTimeout(() => setGlobalToast(null), 3500);
  };

  // Handlers
  const handleOpenStationDetail = (station: GasStation) => {
    setActiveDetailStation(station);
  };

  const handleOpenReportModal = (station: GasStation) => {
    setReportingStation(station);
    setIsReportModalOpen(true);
  };

  const handleSubmitReport = (newReport: DriverReport, newStatus: StationStatus) => {
    if (!reportingStation) return;

    const statusLabels: Record<StationStatus, string> = {
      full: 'Full Stock',
      low: 'Low Pressure',
      queue: 'Queuing',
      out: 'Out of Gas',
    };

    const updatedStations = stations.map((st) => {
      if (st.id === reportingStation.id) {
        const updated = {
          ...st,
          status: newStatus,
          statusLabel: statusLabels[newStatus],
          lastUpdated: 'Just now',
          reports: [newReport, ...st.reports],
        };
        if (activeDetailStation?.id === st.id) {
          setActiveDetailStation(updated);
        }
        if (selectedStation?.id === st.id) {
          setSelectedStation(updated);
        }
        return updated;
      }
      return st;
    });

    setStations(updatedStations);
    setUserProfile((prev) => ({
      ...prev,
      reportsCount: prev.reportsCount + 1,
    }));
    showToast(`Status updated for ${reportingStation.name}! +50 Community Points`);
  };

  const handleNavigate = (station: GasStation) => {
    showToast(`Starting navigation to ${station.name} (${station.distance})`);
  };

  const handleCreatePost = (newPost: CommunityPost) => {
    setPosts([newPost, ...posts]);
    showToast('Post published to GasFinder Community!');
  };

  const handleLoginSuccess = (identifier: string) => {
    setUserProfile((prev) => ({
      ...prev,
      phone: identifier.includes('@') ? prev.phone : identifier,
      email: identifier.includes('@') ? identifier : prev.email,
    }));
    showToast(`Welcome to GasFinder, ${userProfile.name}!`);
  };

  // Determine current view title and back button
  let headerTitle: string | undefined;
  let showHeaderBack = false;
  let onHeaderBack: (() => void) | undefined;

  if (activeChatPost) {
    headerTitle = undefined; // handled inside ChatScreen
    showHeaderBack = false;
  } else if (activeDiscussionPost) {
    headerTitle = 'Discussion';
    showHeaderBack = true;
    onHeaderBack = () => setActiveDiscussionPost(null);
  } else if (activeDetailStation) {
    headerTitle = activeDetailStation.name;
    showHeaderBack = true;
    onHeaderBack = () => setActiveDetailStation(null);
  }

  return (
    <div className="min-h-screen bg-[#f2fcf5] text-[#141d19] font-['Plus_Jakarta_Sans',sans-serif] flex flex-col selection:bg-[#006c50]/20 selection:text-[#004D40]">
      {/* Global Toast Notification */}
      {globalToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#141d19]/95 text-white text-[13.5px] font-bold px-5 py-2.5 rounded-full shadow-2xl backdrop-blur-md animate-fade-in border border-white/10 text-center max-w-sm pointer-events-none">
          {globalToast}
        </div>
      )}

      {/* Proximity Alert Banner (Simulated Push Notification) */}
      {proximityAlertStation && (
        <ProximityAlertBanner
          station={proximityAlertStation}
          onShareStatus={(st) => {
            setProximityAlertStation(null);
            handleOpenReportModal(st);
          }}
          onDismiss={() => setProximityAlertStation(null)}
        />
      )}

      {/* Main Top Header (hidden in chat mode as chat has its own custom bar) */}
      {!activeChatPost && (
        <Header
          title={headerTitle || 'GasFinder'}
          showBack={showHeaderBack}
          onBack={onHeaderBack}
          onAvatarClick={() => {
            setActiveDetailStation(null);
            setActiveDiscussionPost(null);
            setActiveTab('profile');
          }}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 w-full">
        {activeChatPost ? (
          <ChatScreen
            post={activeChatPost}
            onBack={() => setActiveChatPost(null)}
          />
        ) : activeDiscussionPost ? (
          <DiscussionScreen
            post={activeDiscussionPost}
            onBack={() => setActiveDiscussionPost(null)}
          />
        ) : activeDetailStation ? (
          <StationDetailScreen
            station={activeDetailStation}
            onBack={() => setActiveDetailStation(null)}
            onOpenReportModal={handleOpenReportModal}
            onNavigate={handleNavigate}
          />
        ) : activeTab === 'map' ? (
          <MapScreen
            stations={stations}
            selectedStation={selectedStation}
            onSelectStation={(st) => setSelectedStation(st)}
            onOpenStationDetails={handleOpenStationDetail}
            onNavigate={handleNavigate}
          />
        ) : activeTab === 'community' ? (
          <CommunityScreen
            posts={posts}
            onOpenDiscussion={(p) => setActiveDiscussionPost(p)}
            onOpenChat={(p) => setActiveChatPost(p)}
            onOpenCreatePost={() => setIsCreatePostOpen(true)}
            onOpenNotifications={() => {
              setProximityAlertStation(stations[1]); // Trigger Total CNG Wuse 2 proximity alert
              showToast('Received alert: Total CNG Wuse 2 is nearby!');
            }}
          />
        ) : (
          <ProfileScreen
            user={userProfile}
            onOpenOnboarding={() => setIsOnboardingOpen(true)}
            onTriggerProximityAlert={() => {
              setProximityAlertStation(stations[1]);
              setActiveTab('map');
              showToast('Simulating alert for Total CNG - Wuse 2');
            }}
          />
        )}
      </main>

      {/* Bottom Navigation Bar (Shown when not in sub-screens) */}
      {!activeDetailStation && !activeDiscussionPost && !activeChatPost && (
        <BottomNav
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveDetailStation(null);
            setActiveDiscussionPost(null);
            setActiveChatPost(null);
            setActiveTab(tab);
          }}
        />
      )}

      {/* Modals */}
      {isReportModalOpen && reportingStation && (
        <ReportStatusModal
          station={reportingStation}
          onClose={() => {
            setIsReportModalOpen(false);
            setReportingStation(null);
          }}
          onSubmitReport={handleSubmitReport}
        />
      )}

      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      <CreatePostModal
        isOpen={isCreatePostOpen}
        onClose={() => setIsCreatePostOpen(false)}
        onSubmitPost={handleCreatePost}
      />
    </div>
  );
};
export default App;
