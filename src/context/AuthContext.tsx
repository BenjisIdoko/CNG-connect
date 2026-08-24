import React, { createContext, useContext, useState } from 'react';
import { UserProfile } from '../types';
import { INITIAL_USER } from '../data/mockData';

interface AuthContextType {
  userProfile: UserProfile;
  isAuthenticated: boolean;
  authMode: 'onboarding' | 'signup' | 'login' | null;
  setAuthMode: (mode: 'onboarding' | 'signup' | 'login' | null) => void;
  handleAuthSuccess: (updatedUser: UserProfile) => void;
  handleLoginSuccess: (identifier: string) => void;
  handleSignOut: () => void;
  updateUserProfile: (updater: (prev: UserProfile) => UserProfile) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('cng_user_authenticated') === 'true';
  });

  const [authMode, setAuthMode] = useState<'onboarding' | 'signup' | 'login' | null>(() => {
    return localStorage.getItem('cng_user_authenticated') === 'true' ? null : 'onboarding';
  });

  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem('cng_user_profile');
      return saved ? JSON.parse(saved) : INITIAL_USER;
    } catch {
      return INITIAL_USER;
    }
  });

  const handleAuthSuccess = (updatedUser: UserProfile) => {
    setUserProfile(updatedUser);
    setIsAuthenticated(true);
    setAuthMode(null);
    try {
      localStorage.setItem('cng_user_authenticated', 'true');
      localStorage.setItem('cng_user_profile', JSON.stringify(updatedUser));
    } catch (e) {
      console.error('Failed to persist auth status', e);
    }
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
  };

  const updateUserProfile = (updater: (prev: UserProfile) => UserProfile) => {
    setUserProfile((prev) => {
      const next = updater(prev);
      try {
        localStorage.setItem('cng_user_profile', JSON.stringify(next));
      } catch (e) {
        console.error('Failed to save profile', e);
      }
      return next;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        userProfile,
        isAuthenticated,
        authMode,
        setAuthMode,
        handleAuthSuccess,
        handleLoginSuccess,
        handleSignOut,
        updateUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
