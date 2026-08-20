import React, { useState, useEffect } from 'react';
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
  INITIAL_CONVERSION_CENTERS,
} from './data/mockData';
import { ConversionCenter } from './types';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { MapScreen } from './components/MapScreen';
import { StationDetailScreen } from './components/StationDetailScreen';
import { CommunityScreen } from './components/CommunityScreen';
import { ConversionCentersScreen } from './components/ConversionCentersScreen';
import { BookConversionModal } from './components/BookConversionModal';
import { DiscussionScreen } from './components/DiscussionScreen';
import { ChatScreen } from './components/ChatScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { ReportStatusModal } from './components/ReportStatusModal';
import { OnboardingModal } from './components/OnboardingModal';
import { ProximityAlertBanner } from './components/ProximityAlertBanner';
import { CreatePostModal } from './components/CreatePostModal';
import { AiAssistantModal } from './components/AiAssistantModal';
import { SignUpScreen } from './components/SignUpScreen';
import { LiveNavigationModal } from './components/LiveNavigationModal';
import { SplashScreen } from './components/SplashScreen';

export const App: React.FC = () => {
  // Animated Splash Screen State
  const [showSplash, setShowSplash] = useState(true);

  // Navigation State
  const [activeTab, setActiveTab] = useState<'map' | 'conversions' | 'community' | 'profile'>('map');
  const [selectedBookingCenter, setSelectedBookingCenter] = useState<ConversionCenter | null>(null);

  // Sub-screens state
  const [activeDetailStation, setActiveDetailStation] = useState<GasStation | null>(null);
  const [activeDiscussionPost, setActiveDiscussionPost] = useState<CommunityPost | null>(null);
  const [activeChatPost, setActiveChatPost] = useState<CommunityPost | null>(null);
  const [navigatingStation, setNavigatingStation] = useState<GasStation | null>(null);

  // Modals & Overlays
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportingStation, setReportingStation] = useState<GasStation | null>(null);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [proximityAlertStation, setProximityAlertStation] = useState<GasStation | null>(null);
  const [globalToast, setGlobalToast] = useState<string | null>(null);

  // Data Store with LocalStorage Persistence
  const [stations, setStations] = useState<GasStation[]>(() => {
    try {
      const saved = localStorage.getItem('gasfinder_stations');
      return saved ? JSON.parse(saved) : INITIAL_STATIONS;
    } catch {
      return INITIAL_STATIONS;
    }
  });

  const [selectedStation, setSelectedStation] = useState<GasStation>(() => stations[0] || INITIAL_STATIONS[0]);

  const [posts, setPosts] = useState<CommunityPost[]>(() => {
    try {
      const saved = localStorage.getItem('gasfinder_posts');
      return saved ? JSON.parse(saved) : INITIAL_POSTS;
    } catch {
      return INITIAL_POSTS;
    }
  });

  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem('gasfinder_user');
      return saved ? JSON.parse(saved) : INITIAL_USER;
    } catch {
      return INITIAL_USER;
    }
  });

  // Auto-sync state changes to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('gasfinder_stations', JSON.stringify(stations));
    } catch (e) {
      console.error('Failed to save stations to localStorage', e);
    }
  }, [stations]);

  useEffect(() => {
    try {
      localStorage.setItem('gasfinder_posts', JSON.stringify(posts));
    } catch (e) {
      console.error('Failed to save posts to localStorage', e);
    }
  }, [posts]);

  useEffect(() => {
    try {
      localStorage.setItem('gasfinder_user', JSON.stringify(userProfile));
    } catch (e) {
      console.error('Failed to save user profile to localStorage', e);
    }
  }, [userProfile]);

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

  const handleToggleJoinGroup = (stationId: string) => {
    setStations((prev) =>
      prev.map((st) => {
        if (st.id === stationId) {
          const isJoined = !st.isJoined;
          const memberCount = (st.memberCount || 100) + (isJoined ? 1 : -1);
          const updated = { ...st, isJoined, memberCount };
          if (activeDetailStation?.id === stationId) {
            setActiveDetailStation(updated);
          }
          return updated;
        }
        return st;
      })
    );
  };

  const handleAddStationComment = (stationId: string, commentText: string) => {
    setStations((prev) =>
      prev.map((st) => {
        if (st.id === stationId) {
          const newComment = {
            id: `st-c-${Date.now()}`,
            author: userProfile.name,
            authorAvatar: userProfile.avatar,
            timeAgo: 'Just now',
            content: commentText,
          };
          const updated = {
            ...st,
            stationComments: [newComment, ...(st.stationComments || [])],
          };
          if (activeDetailStation?.id === stationId) {
            setActiveDetailStation(updated);
          }
          return updated;
        }
        return st;
      })
    );
    showToast('Comment posted to Station Group!');
  };

  const handleNavigate = (station: GasStation) => {
    setNavigatingStation(station);
    showToast(`Starting live navigation to ${station.name} (${station.distance})`);
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
    headerTitle = `${activeDetailStation.name} Group`;
    showHeaderBack = true;
    onHeaderBack = () => setActiveDetailStation(null);
  }

  return (
    <div className="min-h-screen bg-[#f2fcf5] text-[#141d19] font-['Plus_Jakarta_Sans',sans-serif] flex flex-col selection:bg-[#006c50]/20 selection:text-[#004D40]">
      {/* Animated Splash Screen */}
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}

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
          onQuickSubmitReport={(st, report, status) => {
            setReportingStation(st);
            handleSubmitReport(report, status);
          }}
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
          onOpenAiAssistant={() => setIsAiModalOpen(true)}
          onAvatarClick={() => {
            setActiveDetailStation(null);
            setActiveDiscussionPost(null);
            setActiveTab('profile');
          }}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 w-full pt-16 pb-20">
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
            onToggleJoinGroup={handleToggleJoinGroup}
            onAddStationComment={handleAddStationComment}
          />
        ) : activeTab === 'map' ? (
          <MapScreen
            stations={stations}
            selectedStation={selectedStation}
            onSelectStation={(st) => setSelectedStation(st)}
            onOpenStationDetails={handleOpenStationDetail}
            onNavigate={handleNavigate}
          />
        ) : activeTab === 'conversions' ? (
          <ConversionCentersScreen
            centers={INITIAL_CONVERSION_CENTERS as ConversionCenter[]}
            onBookAppointment={(center) => setSelectedBookingCenter(center)}
          />
        ) : activeTab === 'community' ? (
          <CommunityScreen
            posts={posts}
            stations={stations}
            onOpenDiscussion={(p) => setActiveDiscussionPost(p)}
            onOpenChat={(p) => setActiveChatPost(p)}
            onOpenCreatePost={() => setIsCreatePostOpen(true)}
            onOpenStationGroup={(st) => setActiveDetailStation(st)}
            onOpenNotifications={() => {
              setProximityAlertStation(stations[1]); // Trigger Total CNG Wuse 2 proximity alert
              showToast('Received alert: Total CNG Wuse 2 is nearby!');
            }}
          />
        ) : (
          <ProfileScreen
            user={userProfile}
            onOpenOnboarding={() => setIsOnboardingOpen(true)}
            onOpenSignUp={() => setIsSignUpOpen(true)}
            onTriggerProximityAlert={() => {
              setProximityAlertStation(stations[1]);
              setActiveTab('map');
              showToast('Simulating alert for Total CNG - Wuse 2');
            }}
          />
        )}
      </main>

      {/* Book Conversion Kit Modal */}
      {selectedBookingCenter && (
        <BookConversionModal
          center={selectedBookingCenter}
          onClose={() => setSelectedBookingCenter(null)}
          onSuccess={(ref) => {
            showToast(`Conversion Slot Confirmed! Ref: ${ref}`);
            setUserProfile((prev) => ({
              ...prev,
              reputationScore: Number((prev.reputationScore + 0.1).toFixed(1)),
            }));
          }}
        />
      )}

      {/* Full-Screen Sign Up Overlay */}
      {isSignUpOpen && (
        <div className="fixed inset-0 z-50 bg-[#f2fcf5] overflow-y-auto">
          <SignUpScreen
            onSignUpComplete={(newUser) => {
              setUserProfile(newUser);
              setIsSignUpOpen(false);
              showToast(`Welcome to GasFinder, ${newUser.name}! +100 Welcome Points awarded 🏆`);
            }}
            onSwitchToLogin={() => {
              setIsSignUpOpen(false);
              setIsOnboardingOpen(true);
            }}
            onCancel={() => setIsSignUpOpen(false)}
          />
        </div>
      )}

      {/* Bottom Navigation Bar (Shown when not in sub-screens) */}
      {!activeDetailStation && !activeDiscussionPost && !activeChatPost && !isSignUpOpen && (
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

      <AiAssistantModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        stations={stations}
        onSelectStation={(st) => {
          setSelectedStation(st);
          setActiveDetailStation(st);
          setIsAiModalOpen(false);
        }}
      />

      {navigatingStation && (
        <LiveNavigationModal
          station={navigatingStation}
          onClose={() => setNavigatingStation(null)}
        />
      )}
    </div>
  );
};

export default App;

