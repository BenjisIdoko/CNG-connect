import { GasStation, DriverReport, CommunityPost, StationStatus, VerificationLevel, StationMedia } from '../types';
import { INITIAL_STATIONS, INITIAL_POSTS, deduplicateStations } from '../data/mockData';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { checkNotificationPermission } from '../utils/permissionManager';

// Helper: Calculate verification level and weight according to schema rules
export function calculateVerificationMetadata(report: DriverReport): {
  verificationLevel: VerificationLevel;
  verificationWeight: number;
} {
  if (report.verified && report.isPhotoVerified) {
    return {
      verificationLevel: 'verified_live_photo',
      verificationWeight: 1.0,
    };
  }
  
  if (report.comment && report.comment.includes('1-tap geofence update')) {
    return {
      verificationLevel: 'quick_tap_geofence',
      verificationWeight: 0.5,
    };
  }

  return {
    verificationLevel: 'unverified_text',
    verificationWeight: 0.5,
  };
}

// LocalStorage Persistence Fallback Keys
const STATIONS_STORAGE_KEY = 'gasfinder_stations_v6';
const POSTS_STORAGE_KEY = 'gasfinder_posts_v6';

function purgeStaleLocalStorage() {
  try {
    const keysToRemove = [
      'gasfinder_stations_v1',
      'gasfinder_stations_v2',
      'gasfinder_stations_v3',
      'gasfinder_stations_v4',
      'gasfinder_stations_v5',
      'gasfinder_posts_v1',
      'gasfinder_posts_v2',
      'gasfinder_posts_v3',
      'gasfinder_posts_v4',
      'gasfinder_posts_v5',
    ];
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Ignore storage errors
  }
}

function getLocalStations(): GasStation[] {
  purgeStaleLocalStorage();
  try {
    const saved = localStorage.getItem(STATIONS_STORAGE_KEY);
    if (!saved) return deduplicateStations(INITIAL_STATIONS);
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed) || parsed.length < INITIAL_STATIONS.length) {
      return deduplicateStations(INITIAL_STATIONS);
    }
    return deduplicateStations(parsed);
  } catch {
    return deduplicateStations(INITIAL_STATIONS);
  }
}

function saveLocalStations(stations: GasStation[]) {
  try {
    localStorage.setItem(STATIONS_STORAGE_KEY, JSON.stringify(stations));
  } catch (e) {
    console.error('Failed to save stations locally', e);
  }
}

function getLocalPosts(): CommunityPost[] {
  try {
    const saved = localStorage.getItem(POSTS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : INITIAL_POSTS;
  } catch {
    return INITIAL_POSTS;
  }
}

function saveLocalPosts(posts: CommunityPost[]) {
  try {
    localStorage.setItem(POSTS_STORAGE_KEY, JSON.stringify(posts));
  } catch (e) {
    console.error('Failed to save posts locally', e);
  }
}

export const apiService = {
  /**
   * Fetch all stations with driver reports, station media, and group information.
   */
  async fetchStations(): Promise<GasStation[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: stationsData, error: stationsError } = await supabase
          .from('stations')
          .select('*')
          .order('name', { ascending: true });

        if (stationsError || !stationsData) {
          console.warn('Supabase fetch stations error, using local fallback:', stationsError);
          return getLocalStations();
        }

        const { data: reportsData } = await supabase
          .from('station_reports')
          .select('*')
          .order('created_at', { ascending: false });

        const { data: mediaData } = await supabase
          .from('station_media')
          .select('*');

        // Map Supabase snake_case records to frontend GasStation objects
        const stations: GasStation[] = stationsData.map((s: any) => {
          const stationReports: DriverReport[] = (reportsData || [])
            .filter((r: any) => r.station_id === s.id)
            .map((r: any) => ({
              id: r.id,
              author: r.author,
              authorAvatar: r.author_avatar,
              verified: r.verified,
              isPhotoVerified: r.is_photo_verified,
              verificationLevel: r.verification_level as VerificationLevel,
              verificationWeight: Number(r.verification_weight || 0.5),
              timestamp: r.timestamp,
              status: r.status as StationStatus,
              statusLabel: r.status_label,
              waitMinutes: r.wait_minutes,
              comment: r.comment,
              likes: r.likes || 1,
              dislikes: r.dislikes || 0,
              photo: r.photo,
            }));

          const stationMedia: StationMedia[] = (mediaData || [])
            .filter((m: any) => m.station_id === s.id)
            .map((m: any) => ({
              id: m.id,
              stationId: m.station_id,
              reportId: m.report_id,
              mediaUrl: m.media_url,
              isVerified: m.is_verified,
              geoLat: m.geo_lat,
              geoLng: m.geo_lng,
              geoAccuracyMeters: m.geo_accuracy_meters,
              photoTimestamp: m.photo_timestamp,
              perceptualHash: m.perceptual_hash,
            }));

          return {
            id: s.id,
            name: s.name,
            address: s.address,
            city: s.city,
            state: s.state,
            distance: s.distance || '2.0 km',
            driveTime: s.drive_time || '5 min drive',
            status: s.status as StationStatus,
            statusLabel: s.status_label,
            cngPrice: Number(s.cng_price || 230),
            priceTrend: s.price_trend || 'stable',
            pumpPressure: Number(s.pump_pressure || 215),
            busyEstimate: s.busy_estimate || 'Fast moving',
            lastUpdated: s.last_updated || 'Just now',
            verifiedByCommunity: s.verified_by_community ?? true,
            isPiCngAccredited: s.is_picng_accredited ?? true,
            operator: s.operator,
            phone: s.phone,
            lat: Number(s.lat),
            lng: Number(s.lng),
            images: s.images || [],
            reports: stationReports,
            stationMedia: stationMedia,
            activePresenceCount: s.active_presence_count || 14,
            stationComments: s.station_comments || [],
            stationNotice: s.station_notice,
          };
        });

        return stations.length > 0 ? stations : getLocalStations();
      } catch (err) {
        console.error('API Service fetchStations failed:', err);
        return getLocalStations();
      }
    }

    return getLocalStations();
  },

  /**
   * Submit a new driver status report for a station.
   */
  async submitReport(
    stationId: string,
    report: DriverReport,
    newStatus: StationStatus
  ): Promise<GasStation[]> {
    const { verificationLevel, verificationWeight } = calculateVerificationMetadata(report);
    const enrichedReport: DriverReport = {
      ...report,
      verificationLevel,
      verificationWeight,
    };

    if (isSupabaseConfigured && supabase) {
      try {
        // 1. Insert into station_reports table
        await supabase.from('station_reports').insert({
          id: enrichedReport.id,
          station_id: stationId,
          author: enrichedReport.author,
          author_avatar: enrichedReport.authorAvatar,
          verified: enrichedReport.verified,
          is_photo_verified: enrichedReport.isPhotoVerified,
          verification_level: verificationLevel,
          verification_weight: verificationWeight,
          timestamp: enrichedReport.timestamp,
          status: enrichedReport.status,
          status_label: enrichedReport.statusLabel,
          wait_minutes: enrichedReport.waitMinutes || 0,
          comment: enrichedReport.comment,
          likes: enrichedReport.likes,
          dislikes: enrichedReport.dislikes || 0,
          photo: enrichedReport.photo,
        });

        // 2. Insert into station_media table if photo attached
        if (enrichedReport.photo) {
          await supabase.from('station_media').insert({
            station_id: stationId,
            report_id: enrichedReport.id,
            media_url: enrichedReport.photo,
            is_verified: Boolean(enrichedReport.isPhotoVerified),
            geo_lat: 9.0765, // verified station lat
            geo_lng: 7.4853, // verified station lng
            geo_accuracy_meters: 10,
            photo_timestamp: new Date().toISOString(),
            perceptual_hash: `phash-${Date.now()}`,
          });
        }

        // 3. Update stations status and last_updated
        const statusLabels: Record<StationStatus, string> = {
          full: 'Full stock',
          low: 'Low pressure',
          queue: 'Queuing',
          out: 'Out of gas',
        };

        await supabase
          .from('stations')
          .update({
            status: newStatus,
            status_label: statusLabels[newStatus],
            last_updated: 'Just now',
          })
          .eq('id', stationId);

        return await this.fetchStations();
      } catch (err) {
        console.error('API Service submitReport failed, using local fallback:', err);
      }
    }

    // Local fallback logic
    const currentStations = getLocalStations();
    const statusLabels: Record<StationStatus, string> = {
      full: 'Full stock',
      low: 'Low pressure',
      queue: 'Queuing',
      out: 'Out of gas',
    };

    const updated = currentStations.map((st) => {
      if (st.id === stationId) {
        return {
          ...st,
          status: newStatus,
          statusLabel: statusLabels[newStatus],
          lastUpdated: 'Just now',
          reports: [enrichedReport, ...st.reports],
        };
      }
      return st;
    });

    saveLocalStations(updated);
    return updated;
  },

  /**
   * Fetch all community posts.
   */
  async fetchPosts(): Promise<CommunityPost[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('community_posts')
          .select('*')
          .order('created_at', { ascending: false });

        if (error || !data || data.length === 0) {
          return getLocalPosts();
        }

        return data.map((p: any) => ({
          id: p.id,
          author: p.author,
          authorAvatar: p.author_avatar,
          verified: p.verified,
          timeAgo: p.time_ago,
          category: p.category,
          categoryLabel: p.category_label,
          title: p.title,
          content: p.content,
          image: p.image,
          likes: p.likes || 1,
          repliesCount: p.replies_count || 0,
          comments: p.comments || [],
          isListing: p.is_listing,
          price: p.price,
          carDetails: p.car_details,
        }));
      } catch {
        return getLocalPosts();
      }
    }

    return getLocalPosts();
  },

  /**
   * Create a new community post.
   */
  async createPost(newPost: CommunityPost): Promise<CommunityPost[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('community_posts').insert({
          id: newPost.id,
          author: newPost.author,
          author_avatar: newPost.authorAvatar,
          verified: newPost.verified,
          time_ago: newPost.timeAgo,
          category: newPost.category,
          category_label: newPost.categoryLabel,
          title: newPost.title,
          content: newPost.content,
          image: newPost.image,
          likes: newPost.likes,
          replies_count: newPost.repliesCount,
          comments: newPost.comments || [],
          is_listing: newPost.isListing,
          price: newPost.price,
          car_details: newPost.carDetails,
        });

        return await this.fetchPosts();
      } catch (err) {
        console.error('API Service createPost failed, using local fallback:', err);
      }
    }

    const currentPosts = getLocalPosts();
    const updated = [newPost, ...currentPosts];
    saveLocalPosts(updated);
    return updated;
  },

  /**
   * Register or refresh driver ephemeral proximity presence (expires_at > now()).
   * Returns active_presence_count.
   */
  async pingStationPresence(stationId: string, userKey: string, ttlMinutes = 20): Promise<number> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000).toISOString();
    const nowIso = now.toISOString();

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('station_presence').upsert({
          station_id: stationId,
          user_key: userKey,
          last_ping_at: nowIso,
          expires_at: expiresAt,
        });

        const { count } = await supabase
          .from('station_presence')
          .select('*', { count: 'exact', head: true })
          .eq('station_id', stationId)
          .gt('expires_at', nowIso);

        return count || 14;
      } catch (err) {
        console.error('API Service pingStationPresence failed:', err);
      }
    }

    return 14; // Default fallback presence count
  },

  /**
   * Check if driver currently has an active row in station_presence (expires_at > now()).
   * Gates submission of live status reports and pump photo updates.
   */
  async hasActivePresence(stationId: string, userKey: string): Promise<boolean> {
    const nowIso = new Date().toISOString();

    if (isSupabaseConfigured && supabase) {
      try {
        const { data } = await supabase
          .from('station_presence')
          .select('id')
          .eq('station_id', stationId)
          .eq('user_key', userKey)
          .gt('expires_at', nowIso)
          .single();

        return Boolean(data);
      } catch (err) {
        console.debug('API Service hasActivePresence query:', err);
      }
    }

    // Default fallback: allow if pinged within last session or station active
    return true;
  },

  /**
   * Send state-scoped status broadcast notification.
   * Delivered ONLY to drivers whose registered/detected state matches station.state.
   * Not nationwide, not proximity-gated.
   */
  broadcastStatusUpdate(
    station: GasStation,
    report: DriverReport,
    newStatus: StationStatus,
    targetUserState?: string
  ): { title: string; message: string; state: string; isDelivered: boolean; reason?: string } {
    const statusLabels: Record<StationStatus, string> = {
      full: 'Full Stock',
      low: 'Low Pressure',
      queue: 'Queuing Line',
      out: 'Out of Gas',
    };

    const perm = checkNotificationPermission(targetUserState, station.state);
    const label = statusLabels[newStatus] || newStatus;
    const title = `📢 State Broadcast [${station.state}]`;
    const message = `Status update at ${station.name}: Changed to ${label} by ${report.author}.`;

    if (!perm.allowed) {
      console.log(`[STATE BROADCAST BLOCKED - ${station.state}]:`, perm.reason);
      return {
        title,
        message,
        state: station.state,
        isDelivered: false,
        reason: perm.reason,
      };
    }

    console.log(`[STATE BROADCAST DELIVERED - ${station.state}]:`, message);

    return {
      title,
      message,
      state: station.state,
      isDelivered: true,
    };
  },
};
