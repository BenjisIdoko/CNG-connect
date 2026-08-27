import React, { createContext, useContext, useState, useEffect } from 'react';
import { GasStation, DriverReport, StationStatus, CommunityPost, StationSuggestion } from '../types';
import { INITIAL_STATIONS, INITIAL_POSTS } from '../data/mockData';
import { apiService } from '../services/apiService';
import { useAuth } from './AuthContext';

interface StationContextType {
  stations: GasStation[];
  posts: CommunityPost[];
  selectedStation: GasStation | null;
  activeDetailStation: GasStation | null;
  reportingStation: GasStation | null;
  proximityAlertStation: GasStation | null;
  isReportModalOpen: boolean;
  userCoords: { lat: number; lng: number } | null;
  gpsStatus: 'active' | 'unavailable' | 'permission_denied';

  setSelectedStation: (station: GasStation | null) => void;
  setActiveDetailStation: (station: GasStation | null) => void;
  setReportingStation: (station: GasStation | null) => void;
  setProximityAlertStation: (station: GasStation | null) => void;
  setIsReportModalOpen: (open: boolean) => void;
  setUserCoords: (coords: { lat: number; lng: number } | null) => void;
  setGpsStatus: (status: 'active' | 'unavailable' | 'permission_denied') => void;

  handleSubmitReport: (report: DriverReport, newStatus: StationStatus) => Promise<void>;
  handleAddStationComment: (stationId: string, commentText: string) => void;
  handleToggleLikePost: (postId: string) => void;
  handleCreatePost: (newPost: CommunityPost) => void;
  handleOpenReportModal: (station: GasStation) => void;
  handleUpdateStationLocation: (stationId: string, lat: number, lng: number) => Promise<void>;
  handleSuggestStation: (suggestion: Omit<StationSuggestion, 'id' | 'createdAt' | 'status'>) => Promise<void>;
}

const StationContext = createContext<StationContextType | undefined>(undefined);

export const StationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile, updateUserProfile, isAuthenticated, setAuthMode } = useAuth();

  const [stations, setStations] = useState<GasStation[]>(INITIAL_STATIONS);
  const [posts, setPosts] = useState<CommunityPost[]>(INITIAL_POSTS);
  const [selectedStation, setSelectedStation] = useState<GasStation | null>(null);
  const [activeDetailStation, setActiveDetailStation] = useState<GasStation | null>(null);
  const [reportingStation, setReportingStation] = useState<GasStation | null>(null);
  const [proximityAlertStation, setProximityAlertStation] = useState<GasStation | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'active' | 'unavailable' | 'permission_denied'>('unavailable');

  // Load initial data from Supabase / localStorage API Service
  useEffect(() => {
    let isMounted = true;
    apiService.fetchStations().then((data) => {
      if (isMounted && data && data.length > 0) {
        setStations(data);
        if (!selectedStation) {
          setSelectedStation(data[0]);
        }
      }
    });
    apiService.fetchPosts().then((data) => {
      if (isMounted && data && data.length > 0) {
        setPosts(data);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Supabase Realtime Subscription for Live Station Updates across all drivers
  useEffect(() => {
    const unsubscribe = apiService.subscribeToLiveStationUpdates(({ stationId, newStatus, statusLabel }) => {
      setStations((prev) =>
        prev.map((st) => {
          if (st.id === stationId) {
            const updated = {
              ...st,
              status: newStatus,
              statusLabel,
              lastUpdated: 'Just now',
            };
            if (activeDetailStation?.id === stationId) {
              setActiveDetailStation(updated);
            }
            if (selectedStation?.id === stationId) {
              setSelectedStation(updated);
            }
            return updated;
          }
          return st;
        })
      );
    });
    return () => {
      unsubscribe();
    };
  }, [activeDetailStation?.id, selectedStation?.id]);

  const handleOpenReportModal = (station: GasStation) => {
    setReportingStation(station);
    setIsReportModalOpen(true);
  };

  const handleSubmitReport = async (report: DriverReport, newStatus: StationStatus) => {
    if (!reportingStation) return;

    const pointsAwarded = report.verified && report.isPhotoVerified ? 50 : 25;
    const newReport: DriverReport = {
      ...report,
      id: `rep-${Date.now()}`,
      timestamp: 'Just now',
    };

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

    updateUserProfile((prev) => ({
      ...prev,
      reportsCount: prev.reportsCount + 1,
      communityPoints: (prev.communityPoints || 0) + pointsAwarded,
    }));
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
  };

  const handleToggleLikePost = (postId: string) => {
    setPosts((prev) =>
      prev.map((post) => {
        if (post.id === postId) {
          const isLiked = post.isLiked;
          return {
            ...post,
            isLiked: !isLiked,
            likes: isLiked ? Math.max(0, post.likes - 1) : post.likes + 1,
          };
        }
        return post;
      })
    );
  };

  const handleCreatePost = (newPost: CommunityPost) => {
    setPosts((prev) => [newPost, ...prev]);
  };

  const handleUpdateStationLocation = async (stationId: string, lat: number, lng: number) => {
    const updated = await apiService.updateStationLocation(stationId, lat, lng);
    if (updated) {
      setStations((prev) =>
        prev.map((st) => (st.id === stationId ? updated : st))
      );
      if (activeDetailStation?.id === stationId) {
        setActiveDetailStation(updated);
      }
      if (selectedStation?.id === stationId) {
        setSelectedStation(updated);
      }
    }
  };

  const handleSuggestStation = async (suggestion: Omit<StationSuggestion, 'id' | 'createdAt' | 'status'>) => {
    await apiService.addStationSuggestion(suggestion);
  };

  return (
    <StationContext.Provider
      value={{
        stations,
        posts,
        selectedStation,
        activeDetailStation,
        reportingStation,
        proximityAlertStation,
        isReportModalOpen,
        userCoords,
        gpsStatus,
        setSelectedStation,
        setActiveDetailStation,
        setReportingStation,
        setProximityAlertStation,
        setIsReportModalOpen,
        setUserCoords,
        setGpsStatus,
        handleSubmitReport,
        handleAddStationComment,
        handleToggleLikePost,
        handleCreatePost,
        handleOpenReportModal,
        handleUpdateStationLocation,
        handleSuggestStation,
      }}
    >
      {children}
    </StationContext.Provider>
  );
};

export const useStations = () => {
  const context = useContext(StationContext);
  if (!context) {
    throw new Error('useStations must be used within a StationProvider');
  }
  return context;
};
