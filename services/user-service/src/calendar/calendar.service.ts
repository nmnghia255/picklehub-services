import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { UnifiedCalendarItem, ActivityType, ActivityStatus } from './calendar.types';

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);
  private readonly sportCenterAxios: AxiosInstance;
  private readonly eventAxios: AxiosInstance;
  private readonly matchAxios: AxiosInstance;
  private readonly tournamentAxios: AxiosInstance;
  private readonly coachAxios: AxiosInstance;

  constructor() {
    const sportCenterUrl = process.env.SPORT_CENTER_SERVICE_URL ?? 'http://localhost:8007';
    const eventUrl = process.env.EVENT_SERVICE_URL ?? 'http://localhost:8004';
    const matchUrl = process.env.MATCH_SERVICE_URL ?? 'http://localhost:8005';
    const tournamentUrl = process.env.TOURNAMENT_SERVICE_URL ?? 'http://localhost:8008';
    const coachUrl = process.env.COACH_SERVICE_URL ?? 'http://localhost:8019';

    const sportCenterToken = process.env.SERVICE_INTERNAL_TOKEN ?? '';
    const internalBearerToken = process.env.SERVICE_INTERNAL_TOKEN ?? '';
    const matchToken = process.env.SERVICE_INTERNAL_TOKEN ?? '';
    const coachToken = process.env.SERVICE_INTERNAL_TOKEN ?? '';

    this.sportCenterAxios = axios.create({
      baseURL: sportCenterUrl,
      headers: {
        'x-internal-service-token': sportCenterToken,
        'Content-Type': 'application/json',
      },
      timeout: 5000,
    });

    this.eventAxios = axios.create({
      baseURL: eventUrl,
      headers: {
        'x-internal-service-token': internalBearerToken,
        'Content-Type': 'application/json',
      },
      timeout: 5000,
    });

    this.matchAxios = axios.create({
      baseURL: matchUrl,
      headers: {
        'x-internal-service-token': matchToken,
        'Content-Type': 'application/json',
      },
      timeout: 5000,
    });

    this.tournamentAxios = axios.create({
      baseURL: tournamentUrl,
      headers: {
        'x-internal-service-token': internalBearerToken,
        'Content-Type': 'application/json',
      },
      timeout: 5000,
    });

    this.coachAxios = axios.create({
      baseURL: coachUrl,
      headers: {
        'x-internal-token': coachToken,
        'Content-Type': 'application/json',
      },
      timeout: 5000,
    });
  }

  async getMergedCalendar(
    userId: string,
    startDate?: string,
    endDate?: string
  ): Promise<{ items: UnifiedCalendarItem[]; warnings: string[] }> {
    const warnings: string[] = [];
    const items: UnifiedCalendarItem[] = [];

    // Define helper to resolve status
    const resolveStatus = (baseStatus: string, start: Date, end: Date): ActivityStatus => {
      const normalizedStatus = baseStatus.toUpperCase();
      if (normalizedStatus === 'CANCELLED' || normalizedStatus === 'WALKOVER') return 'CANCELLED';
      if (normalizedStatus === 'PENDING_CONFIRMATION') return 'PENDING_CONFIRM';
      if (normalizedStatus === 'LIVE' || normalizedStatus === 'IN_PROGRESS' || normalizedStatus === 'ACTIVE') return 'LIVE';
      if (normalizedStatus === 'PENDING' || normalizedStatus === 'PENDING_CONFIRM') return 'PENDING_CONFIRM';
      if (normalizedStatus === 'COMPLETED') return 'COMPLETED';

      const now = new Date();
      if (now >= start && now <= end) return 'LIVE';
      if (now > end) return 'COMPLETED';
      return 'UPCOMING';
    };

    // Helper to combine date and time string
    const combineDateAndTime = (dateVal: string | Date, timeStr: string): Date => {
      const d = new Date(dateVal);
      const [hours, minutes] = timeStr.split(':').map(Number);
      d.setUTCHours(hours || 0, minutes || 0, 0, 0);
      return d;
    };

    // Define the 4 concurrent operations
    const fetchBookings = async () => {
      try {
        const response = await this.sportCenterAxios.post(
          `/api/bookings/internal/query-by-player`,
          { playerId: userId, startDate, endDate },
          { signal: AbortSignal.timeout(2000) }
        );
        
        if ((response.status === 200 || response.status === 201) && Array.isArray(response.data)) {
          for (const booking of response.data) {
            const bookingItems = booking.bookingItems || [];
            bookingItems.forEach((item: any, idx: number) => {
              const start = combineDateAndTime(booking.date, item.startTime || '00:00');
              const end = combineDateAndTime(booking.date, item.endTime || '23:59');
              
              items.push({
                id: `${booking.id}_${idx}`,
                type: 'BOOKING',
                title: `Booking ${item.court?.name || ''} - ${booking.center?.name || 'Center'}`,
                startTime: start.toISOString(),
                endTime: end.toISOString(),
                location: {
                  name: booking.center?.name || 'Center',
                  address: booking.center?.address,
                  centerId: booking.center?.id
                },
                status: resolveStatus(booking.status, start, end),
                role: 'PLAYER',
                metadata: {
                  bookingId: booking.id,
                  paymentStatus: booking.paymentStatus
                }
              });
            });
          }
        }
      } catch (err: any) {
        this.logger.error(`Error fetching bookings: ${err.message}`);
        warnings.push(`Sport center service (sport-center-service) is down or not responding.`);
      }
    };

    const fetchSocials = async () => {
      try {
        const response = await this.eventAxios.post(
          `/api/events/socials/internal/query-by-player`,
          { userId, startDate, endDate },
          { signal: AbortSignal.timeout(2000) }
        );

        if ((response.status === 200 || response.status === 201) && Array.isArray(response.data)) {
          for (const social of response.data) {
            const start = new Date(social.startTime);
            const end = new Date(social.endTime);
            const isHost = social.creatorId === userId;
            
            items.push({
              id: social.id,
              type: 'SOCIAL_SESSION',
              title: `Social: ${social.title}`,
              description: social.description,
              startTime: start.toISOString(),
              endTime: end.toISOString(),
              location: {
                name: social.locationName || 'Social Court',
                address: social.locationAddress,
                centerId: social.sportCenterId
              },
              status: resolveStatus(social.status, start, end),
              role: isHost ? 'HOST' : 'PLAYER',
              metadata: {
                socialId: social.id
              }
            });
          }
        }
      } catch (err: any) {
        this.logger.error(`Error fetching socials: ${err.message}`);
        warnings.push(`Event service (event-service) is down or not responding.`);
      }
    };

    const fetchMatches = async () => {
      try {
        const response = await this.matchAxios.post(
          `/api/matches/internal/query-by-player`,
          { userId, startDate, endDate },
          { signal: AbortSignal.timeout(2000) }
        );

        if ((response.status === 200 || response.status === 201) && Array.isArray(response.data)) {
          for (const match of response.data) {
            const start = new Date(match.scheduledAt);
            const end = new Date(start.getTime() + 60 * 60 * 1000); // estimate 1 hour
            
            const isTeamA = Array.isArray(match.teamA) && match.teamA.some((p: any) => p.id === userId);
            const opponentProfiles = isTeamA ? (match.teamB || []) : (match.teamA || []);
            const opponentNames = opponentProfiles.map((p: any) => p.fullName || p.name || 'Player');
            
            const myTeam = isTeamA ? (match.teamA || []) : (match.teamB || []);
            const partnerProfile = myTeam.find((p: any) => p.id !== userId);
            const partnerName = partnerProfile ? (partnerProfile.fullName || partnerProfile.name) : undefined;
            
            const role = match.refereeId === userId ? 'REFEREE' : 'PLAYER';

            items.push({
              id: match.id,
              type: 'MATCH_PRACTICE',
              title: `Practice Match: ${match.teamA?.map((p: any) => p.fullName || p.name || 'Player').join(', ')} vs ${match.teamB?.map((p: any) => p.fullName || p.name || 'Player').join(', ')}`,
              startTime: start.toISOString(),
              endTime: end.toISOString(),
              location: {
                name: match.court?.name || 'Practice Court',
                address: match.court?.address,
                centerId: match.courtId
              },
              status: resolveStatus(match.status, start, end),
              role,
              metadata: {
                matchId: match.id,
                score: match.scoreA !== undefined && match.scoreB !== undefined ? `${match.scoreA} - ${match.scoreB}` : undefined,
                opponentNames,
                partnerName
              }
            });
          }
        }
      } catch (err: any) {
        this.logger.error(`Error fetching matches: ${err.message}`);
        warnings.push(`Match service (match-service) is down or not responding.`);
      }
    };

    const fetchTournaments = async () => {
      try {
        const response = await this.tournamentAxios.post(
          `/api/tournaments/internal/query-by-player`,
          { userId, startDate, endDate },
          { signal: AbortSignal.timeout(2000) }
        );

        if ((response.status === 200 || response.status === 201) && response.data) {
          const { tournaments = [], matches = [] } = response.data;

          // Process tournaments
          for (const tour of tournaments) {
            const start = new Date(tour.startDate);
            const end = new Date(tour.endDate);
            
            let status: ActivityStatus = 'UPCOMING';
            if (tour.status === 'active' || tour.status === 'in_progress') status = 'LIVE';
            else if (tour.status === 'completed') status = 'COMPLETED';

            items.push({
              id: tour.id.toString(),
              type: 'TOURNAMENT',
              title: `Tournament: ${tour.name}`,
              description: tour.description,
              startTime: start.toISOString(),
              endTime: end.toISOString(),
              location: {
                name: tour.location || 'Tournament Location'
              },
              status,
              role: tour.organizerId === userId ? 'ORGANIZER' : 'PLAYER',
              metadata: {
                tournamentId: tour.id.toString()
              }
            });
          }

          // Process tournament matches
          for (const match of matches) {
            const start = new Date(match.time);
            const end = new Date(start.getTime() + 60 * 60 * 1000); // estimate 1 hour

            const isTeam1 = match.team1?.player1Id === userId || match.team1?.player2Id === userId;
            const opponentTeam = isTeam1 ? match.team2 : match.team1;
            const opponentNames: string[] = [];
            if (opponentTeam) {
              if (opponentTeam.player1Name) opponentNames.push(opponentTeam.player1Name);
              if (opponentTeam.player2Name) opponentNames.push(opponentTeam.player2Name);
            }

            const myTeam = isTeam1 ? match.team1 : match.team2;
            let partnerName: string | undefined = undefined;
            if (myTeam) {
              if (myTeam.player1Id === userId) {
                partnerName = myTeam.player2Name || undefined;
              } else {
                partnerName = myTeam.player1Name || undefined;
              }
            }

            const role = match.refereeId === userId ? 'REFEREE' : 'PLAYER';
            
            let status: ActivityStatus = 'UPCOMING';
            if (match.status === 'completed') {
              status = 'COMPLETED';
            } else {
              status = resolveStatus(match.status || 'UPCOMING', start, end);
            }

            items.push({
              id: match.id.toString(),
              type: 'MATCH_TOURNAMENT',
              title: `Tournament Match ${match.tournament?.name || ''}: ${match.team1?.name || 'Team 1'} vs ${match.team2?.name || 'Team 2'}`,
              startTime: start.toISOString(),
              endTime: end.toISOString(),
              location: {
                name: match.tournament?.location || 'Tournament Court'
              },
              status,
              role,
              metadata: {
                tournamentId: match.tournamentId?.toString(),
                matchId: match.id.toString(),
                score: match.score || undefined,
                opponentNames,
                partnerName
              }
            });
          }
        }
      } catch (err: any) {
        this.logger.error(`Error fetching tournaments: ${err.message}`);
        warnings.push(`Tournament service (tournament-service) is down or not responding.`);
      }
    };

    const fetchLearningSchedule = async () => {
      try {
        const response = await this.coachAxios.get(
          '/api/learner/schedule/internal/query-by-user',
          {
            params: {
              userId,
              from: startDate,
              to: endDate,
            },
            signal: AbortSignal.timeout(2000),
          },
        );

        if ((response.status === 200 || response.status === 201) && Array.isArray(response.data?.items)) {
          for (const item of response.data.items) {
            const start = new Date(item.startsAt);
            const end = new Date(item.endsAt);
            const isClass = item.kind === 'class';

            items.push({
              id: item.id,
              type: 'LEARNING_SESSION',
              title: item.kind === 'class' ? `Class: ${item.title}` : item.title,
              description: item.topic || item.note || undefined,
              startTime: start.toISOString(),
              endTime: end.toISOString(),
              location: {
                name: item.locationDescription || item.coachProfile?.locationCity || 'Learning Session',
              },
              status: resolveStatus(item.status, start, end),
              role: 'LEARNER',
              metadata: {
                classId: item.classId ?? undefined,
                bookingId: item.bookingId ?? undefined,
                coachProfileId: item.coachProfile?.id,
                sourceType: item.kind,
                paymentStatus: item.paymentStatus ?? undefined,
              },
            });
          }
        }
      } catch (err: any) {
        this.logger.error(`Error fetching learning schedule: ${err.message}`);
        warnings.push(`Coach service (coach-service) is down or not responding.`);
      }
    };

    const fetchCoachingSchedule = async () => {
      try {
        const response = await this.coachAxios.get(
          '/api/coach/schedule/internal/query-by-user',
          {
            params: {
              userId,
              from: startDate,
              to: endDate,
            },
            signal: AbortSignal.timeout(2000),
          },
        );

        if ((response.status === 200 || response.status === 201) && Array.isArray(response.data?.items)) {
          for (const item of response.data.items) {
            const start = new Date(item.startsAt);
            const end = new Date(item.endsAt);
            const isClass = item.kind === 'class';

            items.push({
              id: item.id,
              type: 'COACHING_SESSION',
              title: isClass ? `Teaching: ${item.title}` : `Coaching: ${item.title}`,
              description: item.topic || item.note || undefined,
              startTime: start.toISOString(),
              endTime: end.toISOString(),
              location: {
                name: item.locationDescription || item.coachProfile?.locationCity || 'Coaching Session',
              },
              status: resolveStatus(item.status, start, end),
              role: 'COACH',
              metadata: {
                classId: item.classId ?? undefined,
                bookingId: item.bookingId ?? undefined,
                coachProfileId: item.coachProfile?.id,
                learnerProfileId: item.learnerProfile?.id,
                sourceType: item.kind,
                paymentStatus: item.paymentStatus ?? undefined,
              },
            });
          }
        }
      } catch (err: any) {
        if (err.response?.status === 404) {
          // User might not be a coach, ignore 404
          return;
        }
        this.logger.error(`Error fetching coaching schedule: ${err.message}`);
        warnings.push(`Coach service (coach-service) is down or not responding for coaching schedule.`);
      }
    };

    // Execute concurrently
    await Promise.all([
      fetchBookings(),
      fetchSocials(),
      fetchMatches(),
      fetchTournaments(),
      fetchLearningSchedule(),
      fetchCoachingSchedule(),
    ]);

    // Sort by startTime ascending
    items.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    return { items, warnings };
  }
}
