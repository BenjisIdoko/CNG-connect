export type StationStatus = 'full' | 'low' | 'queue' | 'out' | 'unknown';
export type VerificationLevel = 'unverified_text' | 'quick_tap_geofence' | 'verified_live_photo';

export interface StationMedia {
  id: string;
  stationId: string;
  reportId?: string;
  mediaUrl: string;
  isVerified: boolean;
  geoLat?: number;
  geoLng?: number;
  geoAccuracyMeters?: number;
  photoTimestamp?: string;
  perceptualHash?: string;
}

export interface DriverReport {
  id: string;
  author: string;
  authorAvatar: string;
  verified: boolean;
  isPhotoVerified?: boolean;
  verificationLevel?: VerificationLevel;
  verificationWeight?: number; // 0.5 for unverified/quick-tap, 1.0 for photo verified
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
  cngPrice?: number;
  priceTrend?: 'stable' | 'up' | 'down';
  pumpPressure?: number; // in bar
  busyEstimate?: string;
  lastUpdated: string;
  verifiedByCommunity: boolean;
  isPiCngAccredited?: boolean; // Presidential CNG Initiative (pci.gov.ng) accreditation
  operator?: string; // NIPCO, NNPC, BOVAS, Portland Gas, Axxela, etc.
  phone: string;
  lat: number; // Real GPS latitude
  lng: number; // Real GPS longitude
  images: string[];
  reports: DriverReport[];
  stationType?: 'cng' | 'ev_charging'; // Default is 'cng'
  connectorTypes?: string[]; // e.g. ['CCS2', 'Type 2 AC']
  chargingSpeedKw?: number; // e.g. 120 (kW)
  pricePerKwh?: number; // e.g. 180 (NGN / kWh)
  totalPorts?: number; // e.g. 4
  network?: string; // e.g. Qoray Mobility, SAGLEV, NNPC / Shafa
  stationMedia?: StationMedia[];
  activePresenceCount?: number;
  stationComments?: CommentItem[];
  stationNotice?: string;
  // 'geocoded' is a legacy tier from before the real Nominatim geocoding pass;
  // rooftop/street/area/city are honest confidence tiers from that pass, and
  // 'unlocated' means no usable geocode was found (existing pin is a guess).
  locationPrecision?: 'source_exact' | 'gps_confirmed' | 'rooftop' | 'street' | 'area' | 'city' | 'geocoded' | 'unlocated';
  accuracyRadiusM?: number; // Approximate pin uncertainty radius in meters, derived from locationPrecision
  area?: string; // Neighbourhood/landmark within the city (distinct from `city`)
  needsPinReview?: boolean; // Flagged by the geocoder as unresolved or colliding with another station's pin
  dataSource?: string;
  dataSourceDate?: string;
  createdBy?: string | null;
}

export interface StationSuggestion {
  id: string;
  name: string;
  address: string;
  stationType: 'cng' | 'ev_charging';
  city: string;
  state: string;
  operator?: string;
  notes?: string;
  photo?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  submittedBy?: string;
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
  communityPoints?: number;
  state?: string; // Registered or detected state (e.g., 'Abuja FCT', 'Lagos', etc.)
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
  locationPrecision?: 'source_exact' | 'geocoded' | 'gps_confirmed';
  dataSource?: string;
  dataSourceDate?: string;
}
