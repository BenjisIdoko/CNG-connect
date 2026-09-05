import { GasStation, DriverReport, CommunityPost, StationStatus, VerificationLevel, StationMedia, StationSuggestion, CommentItem } from '../types';
import { INITIAL_STATIONS, INITIAL_POSTS, deduplicateStations } from '../data/mockData';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { checkNotificationPermission } from '../utils/permissionManager';
import { formatRelativeTime } from '../utils/timeUtils';
import { buildLeaderboard, LeaderboardDriver, LeaderboardProfileRow } from '../utils/reputationEngine';

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
const STATIONS_STORAGE_KEY = 'gasfinder_stations_v10';
const POSTS_STORAGE_KEY = 'gasfinder_posts_v10';

const memoryStore: Record<string, string> = {};

function getStorageItem(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {
    // Fallback
  }
  return memoryStore[key] || null;
}

function setStorageItem(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
      return;
    }
  } catch {
    // Fallback
  }
  memoryStore[key] = value;
}

function removeStorageItem(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
      return;
    }
  } catch {
    // Fallback
  }
  delete memoryStore[key];
}

function purgeStaleLocalStorage() {
  try {
    const keysToRemove = [
      'gasfinder_stations_v1',
      'gasfinder_stations_v2',
      'gasfinder_stations_v3',
      'gasfinder_stations_v4',
      'gasfinder_stations_v5',
      'gasfinder_stations_v6',
      'gasfinder_stations_v7',
      'gasfinder_stations_v8',
      'gasfinder_stations_v9',
      'gasfinder_posts_v1',
      'gasfinder_posts_v2',
      'gasfinder_posts_v3',
      'gasfinder_posts_v4',
      'gasfinder_posts_v5',
      'gasfinder_posts_v6',
      'gasfinder_posts_v7',
      'gasfinder_posts_v8',
      'gasfinder_posts_v9',
    ];
    keysToRemove.forEach((k) => removeStorageItem(k));
  } catch {
    // Ignore storage errors
  }
}

function getLocalStations(): GasStation[] {
  purgeStaleLocalStorage();
  try {
    const saved = getStorageItem(STATIONS_STORAGE_KEY);
    if (!saved) return deduplicateStations(INITIAL_STATIONS);
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return deduplicateStations(INITIAL_STATIONS);
    }
    return deduplicateStations(parsed);
  } catch {
    return deduplicateStations(INITIAL_STATIONS);
  }
}

function saveLocalStations(stations: GasStation[]) {
  try {
    setStorageItem(STATIONS_STORAGE_KEY, JSON.stringify(stations));
  } catch (e) {
    console.error('Failed to save stations locally', e);
  }
}

function getLocalPosts(): CommunityPost[] {
  try {
    const saved = getStorageItem(POSTS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : INITIAL_POSTS;
  } catch {
    return INITIAL_POSTS;
  }
}

function saveLocalPosts(posts: CommunityPost[]) {
  try {
    setStorageItem(POSTS_STORAGE_KEY, JSON.stringify(posts));
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

        const { data: commentsData } = await supabase
          .from('station_comments')
          .select('*')
          .order('created_at', { ascending: false });

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
              likes: r.likes ?? 0,
              dislikes: r.dislikes ?? 0,
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

          const stationComments: CommentItem[] = (commentsData || [])
            .filter((c: any) => c.station_id === s.id)
            .map((c: any) => ({
              id: c.id,
              author: c.author,
              authorAvatar: c.author_avatar,
              timeAgo: formatRelativeTime(c.created_at),
              content: c.content,
            }));

          return {
            id: s.id,
            name: s.name,
            address: s.address,
            city: s.city,
            state: s.state,
            distance: s.distance || '',
            driveTime: s.drive_time || '',
            status: (s.status as StationStatus) || 'unknown',
            statusLabel: s.status_label || 'No recent reports',
            cngPrice: s.cng_price != null ? Number(s.cng_price) : undefined,
            priceTrend: s.price_trend || undefined,
            pumpPressure: s.pump_pressure != null ? Number(s.pump_pressure) : undefined,
            busyEstimate: s.busy_estimate || undefined,
            lastUpdated: s.last_updated || '',
            verifiedByCommunity: s.verified_by_community ?? false,
            isPiCngAccredited: s.is_picng_accredited ?? false,
            operator: s.operator,
            phone: s.phone,
            lat: Number(s.lat),
            lng: Number(s.lng),
            images: s.images || [],
            reports: stationReports,
            stationMedia: stationMedia,
            activePresenceCount: s.active_presence_count ?? 0,
            stationComments,
            stationNotice: s.station_notice,
            locationPrecision: s.location_precision,
            area: s.area,
            accuracyRadiusM: s.accuracy_radius_m,
            needsPinReview: s.needs_pin_review ?? false,
            stationType: (s.station_type || 'cng') as 'cng' | 'ev_charging',
            connectorTypes: s.connector_types || undefined,
            chargingSpeedKw: s.charging_speed_kw ?? undefined,
            pricePerKwh: s.price_per_kwh ?? undefined,
            totalPorts: s.total_ports ?? undefined,
            network: s.network ?? undefined,
          };
        });

        if (stations.length > 0) {
          saveLocalStations(stations);
          return stations;
        }
        return getLocalStations();
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

    const statusLabels: Record<StationStatus, string> = {
      full: 'Full stock',
      low: 'Low pressure',
      queue: 'Queuing',
      out: 'Out of gas',
      unknown: 'No recent reports',
    };

    // 1. ALWAYS update local cache and persist to localStorage (gasfinder_stations_v7)
    const currentStations = getLocalStations();
    const updatedLocalStations = currentStations.map((st) => {
      if (st.id === stationId) {
        const existingReports = st.reports || [];
        const filteredReports = existingReports.filter((r) => r.id !== enrichedReport.id);
        return {
          ...st,
          status: newStatus,
          statusLabel: statusLabels[newStatus],
          lastUpdated: 'Just now',
          reports: [enrichedReport, ...filteredReports],
        };
      }
      return st;
    });

    saveLocalStations(updatedLocalStations);

    // 2. Sync to Supabase if configured (log errors clearly; never fail silently)
    if (isSupabaseConfigured && supabase) {
      try {
        // A. Insert into station_reports table
        const { error: reportError } = await supabase.from('station_reports').insert({
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

        if (reportError) {
          console.error('Supabase station_reports insert failed:', reportError.message, reportError);
        }

        // B. Insert into station_media table if photo attached
        if (enrichedReport.photo) {
          const targetStation = currentStations.find((s) => s.id === stationId);
          let mediaLat = targetStation?.lat ?? 9.0765;
          let mediaLng = targetStation?.lng ?? 7.4853;
          try {
            const savedUserCoords = getStorageItem('gasfinder_user_coords');
            if (savedUserCoords) {
              const parsedCoords = JSON.parse(savedUserCoords);
              if (parsedCoords?.lat && parsedCoords?.lng) {
                mediaLat = parsedCoords.lat;
                mediaLng = parsedCoords.lng;
              }
            }
          } catch {
            // fallback to station coords
          }

          const { error: mediaError } = await supabase.from('station_media').insert({
            station_id: stationId,
            report_id: enrichedReport.id,
            media_url: enrichedReport.photo,
            is_verified: Boolean(enrichedReport.isPhotoVerified),
            geo_lat: mediaLat,
            geo_lng: mediaLng,
            geo_accuracy_meters: 10,
            photo_timestamp: new Date().toISOString(),
            perceptual_hash: `phash-${Date.now()}`,
          });

          if (mediaError) {
            console.error('Supabase station_media insert failed:', mediaError.message, mediaError);
          }
        }

        // C. Update station status via SECURITY DEFINER RPC report_station_status
        if (newStatus !== 'unknown') {
          const { error: rpcError } = await supabase.rpc('report_station_status', {
            p_station_id: stationId,
            p_status: newStatus,
            p_status_label: statusLabels[newStatus],
          });

          if (rpcError) {
            console.error('Supabase report_station_status rpc failed:', rpcError.message, rpcError);
          }
        }

        // D. Fetch updated stations from Supabase and merge local report
        const freshStations = await this.fetchStations();
        if (freshStations && freshStations.length > 0) {
          const mergedStations = freshStations.map((st) => {
            if (st.id === stationId) {
              const existingReports = st.reports || [];
              const hasReport = existingReports.some((r) => r.id === enrichedReport.id);
              const reports = hasReport ? existingReports : [enrichedReport, ...existingReports];
              return {
                ...st,
                status: newStatus,
                statusLabel: statusLabels[newStatus],
                lastUpdated: 'Just now',
                reports,
              };
            }
            return st;
          });

          saveLocalStations(mergedStations);
          return mergedStations;
        }
      } catch (err) {
        console.error('API Service submitReport Supabase exception, using updated local cache:', err);
      }
    }

    // 3. Return full updated stations list
    return updatedLocalStations;
  },

  /**
   * Fetch all community posts. Pass the current driver's userKey to also
   * resolve which posts they've personally liked (post_likes is the source
   * of truth for that; community_posts.likes is just the cached count).
   */
  async fetchPosts(userKey?: string): Promise<CommunityPost[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('community_posts')
          .select('*')
          .order('created_at', { ascending: false });

        if (error || !data || data.length === 0) {
          return getLocalPosts();
        }

        const { data: commentsData } = await supabase
          .from('post_comments')
          .select('*')
          .order('created_at', { ascending: true });

        let likedPostIds = new Set<string>();
        if (userKey) {
          const { data: likesData } = await supabase
            .from('post_likes')
            .select('post_id')
            .eq('user_key', userKey);
          likedPostIds = new Set((likesData || []).map((l: any) => l.post_id));
        }

        return data.map((p: any) => {
          const postComments: CommentItem[] = (commentsData || [])
            .filter((c: any) => c.post_id === p.id)
            .map((c: any) => ({
              id: c.id,
              author: c.author,
              authorAvatar: c.author_avatar,
              timeAgo: formatRelativeTime(c.created_at),
              content: c.content,
            }));

          return {
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
            likes: p.likes || 0,
            isLiked: likedPostIds.has(p.id),
            repliesCount: postComments.length || p.replies_count || 0,
            comments: postComments,
            isListing: p.is_listing,
            price: p.price,
            carDetails: p.car_details,
          };
        });
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
        const { error: insertError } = await supabase.from('community_posts').insert({
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
        if (insertError) {
          console.error('Supabase community_posts insert failed:', insertError.message);
        }

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
        // onConflict must target the table's real UNIQUE constraint
        // (station_id, user_key) — the primary key is a separate uuid `id`
        // column, so without this every repeat ping for the same driver at
        // the same station would try to INSERT a new row and fail the
        // UNIQUE(station_id, user_key) constraint instead of updating it.
        const { error: pingError } = await supabase.from('station_presence').upsert(
          {
            station_id: stationId,
            user_key: userKey,
            last_ping_at: nowIso,
            expires_at: expiresAt,
          },
          { onConflict: 'station_id,user_key' }
        );
        if (pingError) {
          console.error('Supabase station_presence upsert failed:', pingError.message);
        }

        const { count, error: countError } = await supabase
          .from('station_presence')
          .select('*', { count: 'exact', head: true })
          .eq('station_id', stationId)
          .gt('expires_at', nowIso);

        if (countError) {
          console.error('Supabase station_presence count failed:', countError.message);
          return 0;
        }
        return count || 0;
      } catch (err) {
        console.error('API Service pingStationPresence failed:', err);
      }
    }

    return 0; // No backend configured or reachable — no presence data
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

    // Default fallback: return false (fail-closed/secure)
    return false;
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
      unknown: 'No recent reports',
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

  /**
   * Subscribe to live station status reports across all connected devices using Supabase Realtime.
   */
  subscribeToLiveStationUpdates(
    onUpdate: (payload: { stationId: string; newStatus: StationStatus; statusLabel: string }) => void
  ): () => void {
    if (!isSupabaseConfigured || !supabase) {
      return () => {};
    }

    const channel = supabase
      .channel('public:station_reports')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'station_reports' },
        (payload: any) => {
          if (payload.new && payload.new.station_id) {
            onUpdate({
              stationId: payload.new.station_id,
              newStatus: payload.new.status as StationStatus,
              statusLabel: payload.new.status_label || payload.new.status,
            });
          }
        }
      )
      .subscribe();

    return () => {
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };
  },

  /**
   * Updates and persists exact GPS location coordinates for a station.
   */
  async updateStationLocation(
    stationId: string,
    lat: number,
    lng: number
  ): Promise<GasStation | null> {
    const stations = getLocalStations();
    let updatedStation: GasStation | null = null;

    const updatedStations = stations.map((st) => {
      if (st.id === stationId) {
        updatedStation = {
          ...st,
          lat,
          lng,
          locationPrecision: 'gps_confirmed' as const,
          accuracyRadiusM: 20,
          needsPinReview: false,
          dataSource: 'Community GPS Confirmed Pin',
          dataSourceDate: new Date().toISOString().split('T')[0],
          verifiedByCommunity: true,
        };
        return updatedStation;
      }
      return st;
    });

    saveLocalStations(updatedStations);

    if (isSupabaseConfigured && supabase) {
      try {
        // Anon clients have no direct UPDATE grant on `stations` (see RLS in
        // supabase/schema.sql) — pin corrections go through this
        // SECURITY DEFINER function, which can only touch location columns.
        const { error } = await supabase.rpc('update_station_pin', {
          p_station_id: stationId,
          p_lat: lat,
          p_lng: lng,
        });
        if (error) {
          console.error('Supabase update_station_pin rpc failed:', error.message);
        }
      } catch (err) {
        console.warn('Supabase location update fallback:', err);
      }
    }

    return updatedStation;
  },

  /**
   * Submits a user suggestion for a new CNG or EV station.
   */
  async addStationSuggestion(
    suggestion: Omit<StationSuggestion, 'id' | 'createdAt' | 'status'>
  ): Promise<StationSuggestion> {
    const newSuggestion: StationSuggestion = {
      id: `suggestion-${Date.now()}`,
      ...suggestion,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('station_suggestions').insert({
          id: newSuggestion.id,
          name: newSuggestion.name,
          address: newSuggestion.address,
          station_type: newSuggestion.stationType,
          city: newSuggestion.city,
          state: newSuggestion.state,
          operator: newSuggestion.operator,
          notes: newSuggestion.notes,
          photo: newSuggestion.photo,
          status: newSuggestion.status,
          submitted_by: newSuggestion.submittedBy,
        });
        if (error) {
          console.error('Supabase station_suggestions insert failed:', error.message);
        }
      } catch (err) {
        console.error('API Service addStationSuggestion Supabase exception, using local fallback:', err);
      }
    }

    // Always keep a local copy too, so a driver can see their own pending
    // suggestions even before a backend reviewer approves them.
    const suggestionsKey = 'gasfinder_suggestions_v1';
    let existing: StationSuggestion[] = [];
    const raw = getStorageItem(suggestionsKey);
    if (raw) {
      try {
        existing = JSON.parse(raw);
      } catch {
        existing = [];
      }
    }
    existing.unshift(newSuggestion);
    setStorageItem(suggestionsKey, JSON.stringify(existing));

    return newSuggestion;
  },

  /**
   * Adds a comment to a station's group discussion thread.
   */
  async addStationComment(
    stationId: string,
    comment: { author: string; authorAvatar: string; content: string }
  ): Promise<GasStation[]> {
    const newComment: CommentItem = {
      id: `st-c-${Date.now()}`,
      author: comment.author,
      authorAvatar: comment.authorAvatar,
      timeAgo: 'Just now',
      content: comment.content,
    };

    const currentStations = getLocalStations();
    const updatedLocalStations = currentStations.map((st) =>
      st.id === stationId
        ? { ...st, stationComments: [newComment, ...(st.stationComments || [])] }
        : st
    );
    saveLocalStations(updatedLocalStations);

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('station_comments').insert({
          id: newComment.id,
          station_id: stationId,
          author: comment.author,
          author_avatar: comment.authorAvatar,
          content: comment.content,
        });
        if (error) {
          console.error('Supabase station_comments insert failed:', error.message);
        } else {
          const freshStations = await this.fetchStations();
          if (freshStations && freshStations.length > 0) {
            saveLocalStations(freshStations);
            return freshStations;
          }
        }
      } catch (err) {
        console.error('API Service addStationComment Supabase exception, using local cache:', err);
      }
    }

    return updatedLocalStations;
  },

  /**
   * Adds a comment to a community post's discussion thread.
   */
  async addPostComment(
    postId: string,
    comment: { author: string; authorAvatar: string; content: string },
    userKey?: string
  ): Promise<CommunityPost[]> {
    const newComment: CommentItem = {
      id: `post-c-${Date.now()}`,
      author: comment.author,
      authorAvatar: comment.authorAvatar,
      timeAgo: 'Just now',
      content: comment.content,
    };

    const currentPosts = getLocalPosts();
    const updatedLocalPosts = currentPosts.map((p) =>
      p.id === postId
        ? { ...p, comments: [...(p.comments || []), newComment], repliesCount: (p.repliesCount || 0) + 1 }
        : p
    );
    saveLocalPosts(updatedLocalPosts);

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('post_comments').insert({
          id: newComment.id,
          post_id: postId,
          author: comment.author,
          author_avatar: comment.authorAvatar,
          content: comment.content,
        });
        if (error) {
          console.error('Supabase post_comments insert failed:', error.message);
        } else {
          const freshPosts = await this.fetchPosts(userKey);
          if (freshPosts && freshPosts.length > 0) {
            saveLocalPosts(freshPosts);
            return freshPosts;
          }
        }
      } catch (err) {
        console.error('API Service addPostComment Supabase exception, using local cache:', err);
      }
    }

    return updatedLocalPosts;
  },

  /**
   * Toggles the signed-in driver's like on a community post. Backed by a
   * SECURITY DEFINER RPC that derives identity from auth.uid() server-side
   * (not a client-supplied parameter) — a client can't fabricate someone
   * else's like or inflate the count directly. Requires a real session;
   * returns null (caller falls back to its own optimistic toggle) otherwise.
   */
  async togglePostLike(postId: string): Promise<{ liked: boolean; likeCount: number } | null> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .rpc('toggle_post_like', { p_post_id: postId })
          .single();
        if (error) {
          console.error('Supabase toggle_post_like rpc failed:', error.message);
          return null;
        }
        return data ? { liked: Boolean((data as any).liked), likeCount: Number((data as any).like_count) } : null;
      } catch (err) {
        console.error('API Service togglePostLike Supabase exception:', err);
        return null;
      }
    }

    // No backend configured: caller falls back to its own optimistic toggle.
    return null;
  },

  /**
   * Fetch the ranked driver leaderboard from real `profiles` rows.
   * Returns [] when the backend isn't configured or no driver has points yet
   * — there is no seed/mock fallback.
   */
  async fetchLeaderboard(): Promise<LeaderboardDriver[]> {
    if (!isSupabaseConfigured || !supabase) return [];
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id,name,state,avatar,community_points,reports_count,vehicle')
        .order('community_points', { ascending: false })
        .limit(100);
      if (error || !data) {
        console.error('Supabase fetchLeaderboard failed:', error?.message);
        return [];
      }
      return buildLeaderboard(data as LeaderboardProfileRow[]);
    } catch (err) {
      console.error('API Service fetchLeaderboard exception:', err);
      return [];
    }
  },
};
