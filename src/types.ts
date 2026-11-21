// 'full' is shown as "Available"; 'out' as "Out of gas". Low pressure was retired: old rows that
// still carry 'low' are read as 'queue' (see normalizeStatus in utils/stationFreshness).
export type StationStatus = 'full' | 'queue' | 'out' | 'unknown';
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
  /** What the driver paid per kg of CNG at the pump, in naira. Optional. */
  cngPriceNaira?: number;
  comment?: string;
  likes: number;
  dislikes?: number;
  userVoted?: 'up' | 'down' | null;
  photo?: string;
  /** Where the phone was when the photo was taken (a report needs a photo within the reporting distance of the station). */
  photoLat?: number;
  photoLng?: number;
  /** Radius in metres the browser reported for that fix. */
  photoAccuracyM?: number;
}

/** The reasons the (retired) station manager flow could give for a Closed or waiting-for-gas post; old posts may still carry one. */
export type ManagerStateReason = 'supply' | 'fault' | 'power' | 'other';

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
  pumpPressure?: number; // in bar (the admin's fixed value)
  /** The station's own staff: "selling now" (true) / "not selling" (false), and when they said it. */
  managerSelling?: boolean;
  managerSellingAt?: string;
  /** The station's own status: 'closed', 'open' (waiting for gas) or 'selling' (gas available), and when. */
  managerState?: 'closed' | 'open' | 'selling' | 'out';
  managerStateAt?: string;
  /** Why a closed / waiting post is that way, and when the manager expects it to change (ISO time). */
  managerStateReason?: ManagerStateReason;
  managerStateUntil?: string;
  /** Pump pressure in bar as last read by the (retired) station manager flow, and when; old readings may still show. */
  livePressureBar?: number;
  livePressureAt?: string;
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
  opensAt?: string | null; // "HH:MM:SS", null when unknown or is24Hours
  closesAt?: string | null;
  is24Hours?: boolean;
  hoursNote?: string | null; // e.g. "Closed Sundays"
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
  /** CNG kit details (tank size, install/conversion status) — kept separate from `vehicle` so
   *  a driver's car and their CNG setup can be edited and shown independently. */
  cngKit: string;
  cngInstalledDate: string;
  monthlySavings: number; // in Naira
  reportsCount: number;
  reputationScore: number;
  communityPoints?: number;
  state?: string; // Registered or detected state (e.g., 'Abuja FCT', 'Lagos', etc.)
  isAdmin?: boolean; // Set manually in the DB; unlocks the ?admin=1 pin editor.
  /** An ambassador the admin has marked: can post Gas available / Gas not available at a station they are at. */
  isCommunityManager?: boolean;
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
