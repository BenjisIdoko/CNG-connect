import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { MapScreen, GpsStatus } from './components/MapScreen';
import { StationDetailScreen } from './components/StationDetailScreen';
import { CommunityScreen } from './components/CommunityScreen';
import { ConversionCentersScreen } from './components/ConversionCentersScreen';
import { BookConversionModal } from './components/BookConversionModal';
import { DiscussionScreen } from './components/DiscussionScreen';
import { ChatScreen } from './components/ChatScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { ReportStatusModal } from './components/ReportStatusModal';
import { OnboardingModal } from './components/OnboardingModal';
import { OnboardingScreen } from './components/OnboardingScreen';
import { ProximityAlertBanner } from './components/ProximityAlertBanner';
import { CreatePostModal } from './components/CreatePostModal';
import { AiAssistantModal } from './components/AiAssistantModal';
import { SignUpScreen } from './components/SignUpScreen';
import { LiveNavigationModal } from './components/LiveNavigationModal';
import { SplashScreen } from './components/SplashScreen';
import {
  isStationStale,
  isStationOnCooldown,
  setStationCooldown,
  getDistanceInKm,
  isSameState,
} from './utils/proximityAlertEngine';
import { apiService } from './services/apiService';

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
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [proximityAlertStation, setProximityAlertStation] = useState<GasStation | null>(null);
  const [globalToast, setGlobalToast] = useState<string | null>(null);
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('unavailable');

  // Auth-Gated Onboarding & Registration State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('cng_user_authenticated') === 'true';
  });
  const [authMode, setAuthMode] = useState<'onboarding' | 'signup' | 'login' | null>(() => {
    return localStorage.getItem('cng_user_authenticated') === 'true' ? null : 'onboarding';
  });

  // Offline / Network Online Status Detector
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setGlobalToast('Network connection restored. Syncing live stations...');
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Data Store connected to Supabase API Service (with offline fallback)
  const [stations, setStations] = useState<GasStation[]>(INITIAL_STATIONS);
  const [selectedStation, setSelectedStation] = useState<GasStation>(INITIAL_STATIONS[0]);
  const [posts, setPosts] = useState<CommunityPost[]>(INITIAL_POSTS);

  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem('gasfinder_user');
      return saved ? JSON.parse(saved) : INITIAL_USER;
    } catch {
      return INITIAL_USER;
    }
  });

  // State-Level Scoping: Driver sees stations in their current/registered state
  const scopedStations = useMemo(() => {
    if (!userProfile.state) return stations;
    const filtered = stations.filter((st) => isSameState(st.state, userProfile.state));
    return filtered.length > 0 ? filtered : stations;
  }, [stations, userProfile.state]);

  // Load backend data from API Service on mount
  useEffect(() => {
    let isMounted = true;
    apiService.fetchStations().then((data) => {
      if (isMounted && data.length > 0) {
        setStations(data);
        setSelectedStation(data[0]);
      }
    });

    apiService.fetchPosts().then((data) => {
      if (isMounted && data.length > 0) {
        setPosts(data);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('gasfinder_user', JSON.stringify(userProfile));
    } catch (e) {
      console.error('Failed to save user profile to localStorage', e);
    }
  }, [userProfile]);

  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(() => {
    try {
      const saved = localStorage.getItem('gasfinder_user_coords');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Real navigator.geolocation.watchPosition & getCurrentPosition + Haversine distance calculation
  useEffect(() => {
    if (!('geolocation' in navigator)) return;

    const handlePosSuccess = (pos: GeolocationPosition) => {
      const { latitude, longitude } = pos.coords;
      const coords = { lat: latitude, lng: longitude };
      setUserCoords(coords);
      setGpsStatus('active');
      try {
        localStorage.setItem('gasfinder_user_coords', JSON.stringify(coords));
      } catch {
        // storage error
      }

      // Dynamically compute exact distance & drive time for all stations relative to user's real GPS position
      setStations((prevStations) => {
        const updated = prevStations.map((st) => {
          if (st.lat != null && st.lng != null) {
            const distKm = getDistanceInKm(latitude, longitude, st.lat, st.lng);
            const driveMins = Math.round(distKm * 2.5 + 2);
            return {
              ...st,
              distance: `${distKm.toFixed(1)} km`,
              driveTime: `${driveMins} min drive`,
            };
          }
          return st;
        });

        // Sort by closest distance to driver's live location
        return updated.sort((a, b) => {
          const numA = parseFloat(a.distance) || 999;
          const numB = parseFloat(b.distance) || 999;
          return numA - numB;
        });
      });

      // Find nearby station in user's state requiring status update
      const userKey = userProfile.email || userProfile.phone || 'default_driver';
      const nearbyStaleStation = stations.find((st) => {
        if (!isSameState(st.state, userProfile.state)) return false;
        if (st.lat == null || st.lng == null) return false;

        const distKm = getDistanceInKm(latitude, longitude, st.lat, st.lng);
        // Radius threshold: within 0.8 km (800 meters)
        if (distKm > 0.8) return false;

        // (a) Check staleness (>30 min)
        if (!isStationStale(st.lastUpdated, 30)) return false;

        // (b) Check per-station per-user 2-hour cooldown
        if (isStationOnCooldown(userKey, st.id, 2)) return false;

        return true;
      });

      if (nearbyStaleStation && (!proximityAlertStation || proximityAlertStation.id !== nearbyStaleStation.id)) {
        setProximityAlertStation(nearbyStaleStation);
        setStationCooldown(userKey, nearbyStaleStation.id);
        showToast(`📍 Geofence Nudge: You arrived near ${nearbyStaleStation.name}`);
      }
    };

    // Immediate acquisition on mount
    navigator.geolocation.getCurrentPosition(
      handlePosSuccess,
      (err) => console.debug('Initial position error:', err.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 }
    );

    // Continuous watch for movement
    const watchId = navigator.geolocation.watchPosition(
      handlePosSuccess,
      (err) => {
        console.debug('Geolocation watch status:', err.message);
        setGpsStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 15000,
        timeout: 20000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [userProfile, proximityAlertStation]);

  const showToast = (msg: string) => {
    setGlobalToast(msg);
    setTimeout(() => setGlobalToast(null), 3500);
  };

  const handleSimulateProximityNudge = (requestedStation?: GasStation) => {
    const userKey = userProfile.email || userProfile.phone || 'default_driver';
    const userStateStations = stations.filter((st) => isSameState(st.state, userProfile.state));
    const candidate =
      requestedStation ||
      userStateStations.find((st) => isStationStale(st.lastUpdated, 30) && !isStationOnCooldown(userKey, st.id, 2)) ||
      userStateStations[0] ||
      stations[0];

    const stale = isStationStale(candidate.lastUpdated, 30);
    const onCooldown = isStationOnCooldown(userKey, candidate.id, 2);

    if (!stale) {
      showToast(`⚠️ Nudge skipped for ${candidate.name}: Status is fresh (${candidate.lastUpdated}). Nudges require >30m staleness.`);
      return;
    }

    if (onCooldown) {
      showToast(`⏳ Nudge skipped for ${candidate.name}: 2-hour user cooldown active.`);
      return;
    }

    setProximityAlertStation(candidate);
    setStationCooldown(userKey, candidate.id);
    showToast(`📍 Geofence Alert: Arrived near ${candidate.name}`);
  };

  // Handlers
  const handleOpenStationDetail = async (station: GasStation) => {
    const userKey = userProfile.email || userProfile.phone || 'default_driver';
    const activeCount = await apiService.pingStationPresence(station.id, userKey);
    const updatedStation = { ...station, activePresenceCount: activeCount };
    setActiveDetailStation(updatedStation);
  };

  const handleOpenReportModal = (station: GasStation) => {
    setReportingStation(station);
    setIsReportModalOpen(true);
  };

  const handleSubmitReport = async (newReport: DriverReport, newStatus: StationStatus) => {
    if (!reportingStation) return;

    const pointsAwarded = newReport.isPhotoVerified ? 100 : 50;
    let newTotalPoints = 0;

    const updatedStations = await apiService.submitReport(reportingStation.id, newReport, newStatus);
    setStations(updatedStations);

    const activeSt = updatedStations.find((s) => s.id === reportingStation.id);
    if (activeSt) {
      if (activeDetailStation?.id === activeSt.id) {
        setActiveDetailStation(activeSt);
      }
      if (selectedStation?.id === activeSt.id) {
        setSelectedStation(activeSt);
      }
    }

    const broadcast = apiService.broadcastStatusUpdate(
      reportingStation,
      newReport,
      newStatus,
      userProfile.state || 'Abuja FCT'
    );

    setUserProfile((prev) => {
      newTotalPoints = (prev.communityPoints || 0) + pointsAwarded;
      return {
        ...prev,
        reportsCount: prev.reportsCount + 1,
        communityPoints: newTotalPoints,
      };
    });

    if (broadcast.isDelivered) {
      showToast(
        `${broadcast.title}: ${broadcast.message} (+${pointsAwarded} PTS)`
      );
    } else {
      showToast(
        `Report submitted (+${pointsAwarded} PTS). Push broadcast skipped for driver: Registered state (${userProfile.state || 'Unassigned'}) does not match station state (${reportingStation.state}).`
      );
    }
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
    showToast(`Navigation summary for ${station.name} (${station.distance})`);
  };

  const handleCreatePost = async (newPost: CommunityPost) => {
    const updatedPosts = await apiService.createPost(newPost);
    setPosts(updatedPosts);
    showToast('Post published to GasFinder Community!');
  };

  const handleAuthSuccess = (newUserProfile: UserProfile) => {
    setUserProfile(newUserProfile);
    setIsAuthenticated(true);
    setAuthMode(null);
    localStorage.setItem('cng_user_authenticated', 'true');
    localStorage.setItem('cng_user_profile', JSON.stringify(newUserProfile));
    showToast(`Welcome to GasFinder, ${newUserProfile.name}!`);
  };

  const handleLoginSuccess = (identifier: string) => {
    const updatedUser: UserProfile = {
      ...userProfile,
      phone: identifier.includes('@') ? userProfile.phone : identifier,
      email: identifier.includes('@') ? identifier : userProfile.email,
    };
    handleAuthSuccess(updatedUser);
  };

  const handleSignOut = () => {
    setIsAuthenticated(false);
    setAuthMode('onboarding');
    localStorage.removeItem('cng_user_authenticated');
    localStorage.removeItem('cng_user_profile');
    showToast('Signed out successfully.');
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
    headerTitle = undefined; // handled inside StationDetailScreen sticky header
    showHeaderBack = false;
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
        {!isOnline && (
          <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-[#004D40]/95 text-white text-[11.5px] font-extrabold px-4 py-1.5 rounded-full shadow-lg border border-emerald-400/40 backdrop-blur-md flex items-center gap-1.5 animate-pulse pointer-events-none">
            <span className="material-symbols-outlined text-[16px] text-amber-400">wifi_off</span>
            <span>Offline Mode — Showing Cached Stations</span>
          </div>
        )}
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
            onAddStationComment={handleAddStationComment}
          />
        ) : activeTab === 'map' ? (
          <MapScreen
            stations={scopedStations}
            selectedStation={selectedStation}
            onSelectStation={(st) => setSelectedStation(st)}
            onOpenStationDetails={handleOpenStationDetail}
            onNavigate={handleNavigate}
            gpsStatus={gpsStatus}
            userGps={userCoords}
            onGpsStatusChange={(status, coords) => {
              setGpsStatus(status);
              if (coords) setUserCoords(coords);
            }}
          />
        ) : activeTab === 'conversions' ? (
          <ConversionCentersScreen
            centers={INITIAL_CONVERSION_CENTERS as ConversionCenter[]}
            onBookAppointment={(center) => setSelectedBookingCenter(center)}
          />
        ) : activeTab === 'community' ? (
          <CommunityScreen
            posts={posts}
            stations={scopedStations}
            onOpenDiscussion={(p) => setActiveDiscussionPost(p)}
            onOpenChat={(p) => setActiveChatPost(p)}
            onOpenCreatePost={() => setIsCreatePostOpen(true)}
            onOpenStationGroup={(st) => setActiveDetailStation(st)}
            onOpenNotifications={() => {
              handleSimulateProximityNudge();
            }}
          />
        ) : (
          <ProfileScreen
            user={userProfile}
            onOpenOnboarding={() => setAuthMode('onboarding')}
            onOpenSignUp={() => setAuthMode('signup')}
            onSignOut={handleSignOut}
            onUpdateState={(newState) => {
              setUserProfile((prev) => ({ ...prev, state: newState }));
            }}
            onTriggerProximityAlert={() => {
              handleSimulateProximityNudge();
              setActiveTab('map');
            }}
          />
        )}
      </main>

      {/* Auth-Gated Onboarding & Registration Screen */}
      {(!isAuthenticated || authMode !== null) && (
        <div className="fixed inset-0 z-[60] bg-[#f2fcf5] overflow-y-auto">
          {authMode === 'onboarding' && (
            <OnboardingScreen
              onStartSignUp={() => setAuthMode('signup')}
              onStartLogin={() => setAuthMode('login')}
            />
          )}

          {authMode === 'signup' && (
            <SignUpScreen
              onSignUpComplete={handleAuthSuccess}
              onSwitchToLogin={() => setAuthMode('login')}
              onCancel={() => (isAuthenticated ? setAuthMode(null) : setAuthMode('onboarding'))}
            />
          )}

          {authMode === 'login' && (
            <OnboardingModal
              isOpen={true}
              onClose={() => (isAuthenticated ? setAuthMode(null) : setAuthMode('onboarding'))}
              onLoginSuccess={handleLoginSuccess}
            />
          )}
        </div>
      )}

      {/* Book Conversion Kit Modal */}
      {selectedBookingCenter && (
        <BookConversionModal
          center={selectedBookingCenter}
          user={userProfile}
          onClose={() => setSelectedBookingCenter(null)}
          onSuccess={(appointmentInfo) => {
            showToast(`Appointment requested at ${appointmentInfo.centerName} for ${appointmentInfo.preferredDate}!`);
            setSelectedBookingCenter(null);
          }}
        />
      )}

      {/* Bottom Navigation Bar (Shown when authenticated & not in sub-screens) */}
      {isAuthenticated && !activeDetailStation && !activeDiscussionPost && !activeChatPost && !authMode && (
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
          user={userProfile}
          isPresenceActive={
            Boolean(
              gpsStatus === 'active' &&
              reportingStation.distance &&
              parseFloat(reportingStation.distance) <= 0.8
            )
          }
          onClose={() => {
            setIsReportModalOpen(false);
            setReportingStation(null);
          }}
          onSubmitReport={handleSubmitReport}
        />
      )}

      <CreatePostModal
        isOpen={isCreatePostOpen}
        user={userProfile}
        onClose={() => setIsCreatePostOpen(false)}
        onSubmitPost={handleCreatePost}
      />

      <AiAssistantModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        stations={scopedStations}
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

