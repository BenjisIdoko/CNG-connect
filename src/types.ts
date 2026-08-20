export type StationStatus = 'full' | 'low' | 'queue' | 'out';

export interface DriverReport {
  id: string;
  author: string;
  authorAvatar: string;
  verified: boolean;
  isPhotoVerified?: boolean;
  timestamp: string;
  status: StationStatus;
  statusLabel: string;
  waitMinutes?: number;
  comment?: string;
  likes: number;
  dislikes?: number;
  userVoted?: 'up' | 'down' | null;
  photo?: string;
}

export interface GasStation {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  distance: string;
  driveTime: string;
  status: StationStatus;
  statusLabel: string;
  cngPrice: number;
  priceTrend: 'stable' | 'up' | 'down';
  pumpPressure: number; // in bar
  busyEstimate: string;
  lastUpdated: string;
  verifiedByCommunity: boolean;
  isPiCngAccredited?: boolean; // Official Presidential CNG Initiative partner (pci.gov.ng)
  operator?: string; // NIPCO, NNPC, BOVAS, Portland Gas, Axxela, etc.
  phone: string;
  coordinates: { x: number; y: number }; // Percentage 0-100 on map canvas
  lat?: number; // Real GPS latitude
  lng?: number; // Real GPS longitude
  images: string[];
  reports: DriverReport[];
  memberCount?: number;
  isJoined?: boolean;
  stationComments?: CommentItem[];
  stationNotice?: string;
}

export interface CommentItem {
  id: string;
  author: string;
  authorAvatar: string;
  timeAgo: string;
  content: string;
  replies?: CommentItem[];
}

export interface CommunityPost {
  id: string;
  author: string;
  authorAvatar: string;
  authorInitial?: string;
  authorInitialBg?: string;
  verified: boolean;
  timeAgo: string;
  category: 'maintenance' | 'parts' | 'reviews' | 'deals' | 'conversions';
  categoryLabel: string;
  title: string;
  content: string;
  image?: string;
  likes: number;
  isLiked?: boolean;
  repliesCount: number;
  comments: CommentItem[];
  isListing?: boolean;
  price?: string;
  carDetails?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'seller';
  text?: string;
  image?: string;
  time: string;
  status?: 'sent' | 'delivered' | 'read';
}

export interface UserProfile {
  name: string;
  phone: string;
  email: string;
  avatar: string;
  vehicle: string;
  cngInstalledDate: string;
  monthlySavings: number; // in Naira
  reportsCount: number;
  reputationScore: number;
}

export interface ConversionCenter {
  id: string;
  code: string;
  name: string;
  address: string;
  lga: string;
  state: string;
  city: string;
  phone: string;
  status: boolean; // Active / Registered
  isPiCngAccredited: boolean;
  rating: number;
  reviewsCount: number;
  distance?: string;
  lat?: number;
  lng?: number;
  services: string[];
  conversionPriceRange: string;
  estimatedHours: string;
  image?: string;
}
