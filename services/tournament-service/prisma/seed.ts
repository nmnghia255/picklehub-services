import { PrismaClient, TournamentStatus, EventType, Gender, RegistrationStatus, MatchStatus, CourtStatus } from '@prisma/client';

const prisma = new PrismaClient();

const MAIN_USER_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_USER_ID = '22222222-2222-4222-8222-222222222222';
const BOOKER_1_ID = 'b0000001-b000-4000-8000-000000000000';
const REFEREE_ID = 'f0000000-f000-4000-8000-000000000000';

const TOURNAMENT_PLAYER_IDS = Array.from({ length: 32 }, (_, i) => {
  const hex = (i + 1).toString().padStart(7, '0');
  return `e${hex}-e000-4000-8000-000000000000`;
});

const SEED_TOURNAMENT_PLAYER_NAMES = [
  "Nguyễn Minh Triết", "Lê Quang Liêm", "Trần Quốc Bảo", "Phạm Minh Đức", "Hoàng Quốc Anh",
  "Huỳnh Thanh Tùng", "Phan Văn Trị", "Vũ Hoài Nam", "Đặng Cao Sơn", "Bùi Ngọc Minh",
  "Đỗ Đăng Khoa", "Ngô Gia Bảo", "Dương Hoàng Long", "Lý Trường Sơn", "Võ Duy Mạnh",
  "Nguyễn Tiến Minh", "Trần Thị Thanh Thủy", "Lê Tú Chinh", "Nguyễn Thị Ánh Viên", "Hoàng Xuân Vinh",
  "Huỳnh Thị Ngoan", "Phan Thị Hà Thanh", "Vũ Thị Trang", "Đặng Thị Kim Thanh", "Bùi Thị Ngà",
  "Đỗ Thị Minh", "Ngô Thu Giang", "Dương Thị Việt Anh", "Lý Thị Quỳnh", "Võ Thị Kim Phụng",
  "Nguyễn Thị Lệ Kim", "Trần Thị Mỹ Lệ"
];

const SEED_PICKLEHUB_PLAYER_NAMES = [
  "", // index 0 (not used)
  "Nguyễn Công Phượng", // index 1 (corresponds to PLAYER_1_ID)
  "Trần Minh Vương", // index 2 (corresponds to PLAYER_2_ID)
  "Lê Văn Đô", // index 3 (corresponds to PLAYER_3_ID)
  "Phạm Văn Đạt", // index 4
  "Hoàng Quốc Bảo", // index 5
  "Huỳnh Ngọc Sơn", // index 6
  "Phan Thanh Bình", // index 7
  "Vũ Minh Tuấn", // index 8
  "Đặng Văn Lâm", // index 9
  "Bùi Tiến Dũng", // index 10
  "Đỗ Hùng Dũng", // index 11
  "Ngô Hoàng Thịnh", // index 12
  "Dương Văn Hào", // index 13
  "Lý Công Hoàng Anh", // index 14
  "Võ Huy Toàn", // index 15
  "Nguyễn Hoàng Đức", // index 16
  "Hoàng Đức Chinh", // index 17
  "Huỳnh Tấn Sinh", // index 18
  "Phan Văn Đức", // index 19
  "Vũ Văn Thanh", // index 20
  "Đặng Văn Robert", // index 21
  "Bùi Hoàng Việt Anh", // index 22
  "Đỗ Duy Mạnh", // index 23
  "Ngô Tùng Quốc", // index 24
  "Dương Thanh Hào", // index 25
  "Lý Nam Đế", // index 26
  "Võ Minh Trí", // index 27
  "Nguyễn Văn Quyết", // index 28
  "Trần Đình Trọng", // index 29
  "Lê Văn Xuân", // index 30
  "Phạm Đức Huy", // index 31
  "Hoàng Vĩnh Nguyên", // index 32
  "Huỳnh Tuấn Tài", // index 33
  "Phan Tuấn Tài", // index 34
  "Vũ Hồng Quân", // index 35
  "Đặng Văn Tới", // index 36
  "Bùi Quang Huy", // index 37
  "Đỗ Thanh Thịnh", // index 38
  "Ngô Hồng Phước", // index 39
  "Dương Quang Tuấn", // index 40
  "Lý Anh Đức", // index 41
  "Võ Nguyên Giáp", // index 42
  "Nguyễn Văn Toàn", // index 43
  "Trần Thanh Sơn", // index 44
  "Lê Xuân Tú", // index 45
  "Phạm Xuân Mạnh", // index 46
  "Hoàng Anh Tuấn", // index 47
  "Huỳnh Tấn Tài (2)", // index 48
  "Phan Thanh Hưng", // index 49
  "Vũ Anh Tuấn", // index 50
  "Đặng Khánh Lâm", // index 51
  "Bùi Tấn Trường", // index 52
  "Đỗ Văn Thuận", // index 53
  "Ngô Đức Thắng", // index 54
  "Dương Văn Khoa", // index 55
  "Lý Công Hoàng Anh (2)", // index 56
  "Võ Ngọc Đức", // index 57
  "Nguyễn Hữu Tuấn", // index 58
  "Trần Mạnh Cường", // index 59
  "Lê Sỹ Minh", // index 60
  "Phạm Nguyên Sa", // index 61
  "Đặng Văn Robert (2)", // index 62
  "Nguyễn Văn Đạt", // index 63
  "Trần Văn Sơn" // index 64
];

// Deterministic external UUID for a seeded tournament (the `uuid` used to correlate
// with match/sport-center), stable across re-runs. Internal ids stay numeric.
function tid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

function getPlayerName(index: number): string {
  return SEED_TOURNAMENT_PLAYER_NAMES[index] ?? `Tournament Player ${(index + 1).toString().padStart(2, '0')}`;
}

// Helpers for upserting entities to prevent duplicate keys and avoid DELETE commands
async function upsertGroupStageGroup(data: {
  id: number;
  tournamentId: number;
  eventId: number;
  name: string;
  order: number;
}) {
  return prisma.groupStageGroup.upsert({
    where: { id: data.id },
    update: {
      tournamentId: data.tournamentId,
      eventId: data.eventId,
      name: data.name,
      order: data.order,
    },
    create: data,
  });
}

async function upsertGroupStageMembership(data: {
  id: number;
  groupId: number;
  teamId: number;
  seed?: number | null;
  wins?: number;
  draws?: number;
  losses?: number;
  points?: number;
  gameDiff?: number;
  isAdvanced?: boolean;
}) {
  return prisma.groupStageMembership.upsert({
    where: { id: data.id },
    update: {
      groupId: data.groupId,
      teamId: data.teamId,
      seed: data.seed ?? undefined,
      wins: data.wins ?? undefined,
      draws: data.draws ?? undefined,
      losses: data.losses ?? undefined,
      points: data.points ?? undefined,
      gameDiff: data.gameDiff ?? undefined,
      isAdvanced: data.isAdvanced ?? undefined,
    },
    create: data,
  });
}

async function upsertTournamentReferee(data: {
  id: number;
  tournamentId: number;
  refereeId: string;
  refereeName: string;
  refereeEmail?: string | null;
  refereeAvatar?: string | null;
  phone?: string | null;
}) {
  return prisma.tournamentReferee.upsert({
    where: { id: data.id },
    update: {
      refereeName: data.refereeName,
      refereeEmail: data.refereeEmail,
      refereeAvatar: data.refereeAvatar,
      phone: data.phone,
    },
    create: data,
  });
}

async function upsertTournamentBooking(data: {
  id: number;
  tournamentId: number;
  externalBookingId: string;
  centerId: string;
  date?: string | null;
  statusMirror: string;
  totalPrice?: number | null;
}) {
  return prisma.tournamentBooking.upsert({
    where: { externalBookingId: data.externalBookingId },
    update: {
      tournamentId: data.tournamentId,
      centerId: data.centerId,
      date: data.date,
      statusMirror: data.statusMirror,
      totalPrice: data.totalPrice,
    },
    create: data,
  });
}

async function upsertCourt(id: number, name: string, status: CourtStatus) {
  return prisma.court.upsert({
    where: { id },
    update: { name, status },
    create: { id, name, status },
  });
}

async function upsertTournament(data: {
  id: number;
  organizerId: string | null;
  name: string;
  venue: string;
  latitude?: number | null;
  longitude?: number | null;
  startDate: Date;
  endDate: Date;
  registered: number;
  status: TournamentStatus;
  banner: string | null;
  description?: string | null;
  registrationStartDate: Date | null;
  registrationEndDate: Date | null;
  centerIds?: string[];
}) {
  return prisma.tournament.upsert({
    where: { id: data.id },
    update: {
      organizerId: data.organizerId,
      name: data.name,
      venue: data.venue,
      latitude: data.latitude,
      longitude: data.longitude,
      startDate: data.startDate,
      endDate: data.endDate,
      registered: data.registered,
      status: data.status,
      banner: data.banner,
      description: data.description,
      registrationStartDate: data.registrationStartDate,
      registrationEndDate: data.registrationEndDate,
      centerIds: data.centerIds ?? undefined,
    },
    create: { ...data, uuid: tid(data.id), centerIds: data.centerIds ?? [] },
  });
}

async function upsertEvent(data: {
  id: number;
  tournamentId: number;
  name: string;
  type: EventType;
  skillRange: string;
  gender: Gender;
  participants: number;
  capacity: number;
  entryFee: number;
  numGroups?: number | null;
  totalAdvance?: number | null;
  advanceMethod?: string | null;
}) {
  return prisma.tournamentEvent.upsert({
    where: { id: data.id },
    update: {
      name: data.name,
      type: data.type,
      skillRange: data.skillRange,
      gender: data.gender,
      participants: data.participants,
      capacity: data.capacity,
      entryFee: data.entryFee,
      numGroups: data.numGroups ?? undefined,
      totalAdvance: data.totalAdvance ?? undefined,
      advanceMethod: data.advanceMethod ?? undefined,
      bracketStatus: 'unlocked',
    },
    create: data,
  });
}

async function upsertRegistration(data: {
  id: number;
  tournamentId: number;
  eventId: number;
  playerId: string;
  playerName: string;
  playerRating: number;
  playerAvatar?: string | null;
  playerAge?: number | null;
  playerGender?: string | null;
  playerDuprId?: string | null;
  partnerId?: string | null;
  partnerName?: string | null;
  partnerRating?: number | null;
  partnerAvatar?: string | null;
  partnerAge?: number | null;
  partnerGender?: string | null;
  partnerDuprId?: string | null;
  paymentStatus: string;
  paymentProofUrl?: string | null;
  paymentProofUploadedAt?: Date | null;
  status: RegistrationStatus;
  registrationDate?: Date;
}) {
  return prisma.registration.upsert({
    where: { id: data.id },
    update: {
      playerId: data.playerId,
      playerName: data.playerName,
      playerRating: data.playerRating,
      playerAvatar: data.playerAvatar,
      playerAge: data.playerAge,
      playerGender: data.playerGender,
      playerDuprId: data.playerDuprId,
      partnerId: data.partnerId,
      partnerName: data.partnerName,
      partnerRating: data.partnerRating,
      partnerAvatar: data.partnerAvatar,
      partnerAge: data.partnerAge,
      partnerGender: data.partnerGender,
      partnerDuprId: data.partnerDuprId,
      paymentStatus: data.paymentStatus,
      paymentProofUrl: data.paymentProofUrl,
      paymentProofUploadedAt: data.paymentProofUploadedAt,
      status: data.status,
    },
    create: data,
  });
}

async function upsertTeam(data: {
  id: number;
  tournamentId: number;
  eventId: number;
  player1Id: string;
  player1Name: string;
  player1Rating: number;
  player1Age?: number | null;
  player1Gender?: string | null;
  player1DuprId?: string | null;
  player2Id?: string | null;
  player2Name?: string | null;
  player2Rating?: number | null;
  player2Age?: number | null;
  player2Gender?: string | null;
  player2DuprId?: string | null;
  avgRating?: number | null;
}) {
  return prisma.team.upsert({
    where: { id: data.id },
    update: {
      player1Id: data.player1Id,
      player1Name: data.player1Name,
      player1Rating: data.player1Rating,
      player1Age: data.player1Age,
      player1Gender: data.player1Gender,
      player1DuprId: data.player1DuprId,
      player2Id: data.player2Id,
      player2Name: data.player2Name,
      player2Rating: data.player2Rating,
      player2Age: data.player2Age,
      player2Gender: data.player2Gender,
      player2DuprId: data.player2DuprId,
      avgRating: data.avgRating,
    },
    create: data,
  });
}

async function upsertSeed(data: {
  id: number;
  tournamentId: number;
  eventId: number;
  seed: number;
  teamId: number;
  teamName: string;
  rating: number;
  wins?: number;
  losses?: number;
  status: string;
}) {
  return prisma.seed.upsert({
    where: { id: data.id },
    update: {
      seed: data.seed,
      teamId: data.teamId,
      teamName: data.teamName,
      rating: data.rating,
      wins: data.wins,
      losses: data.losses,
      status: data.status,
    },
    create: data,
  });
}

async function upsertMatch(data: {
  id: number;
  tournamentId: number;
  eventId: number;
  round?: string | null;
  team1Id?: number | null;
  team2Id?: number | null;
  winner?: number | null;
  score?: string | null;
  status: MatchStatus;
  courtId?: number | null;
  time?: Date | null;
  startTime?: Date | null;
  duration?: number | null;
  priority?: string | null;
  refereeId?: string | null;
  refereeName?: string | null;
  stage?: string | null;
  loserMatchId?: number | null;
  nextMatchId?: number | null;
  bookingId?: number | null;
  bookingItemId?: string | null;
  groupId?: number | null;
  groupStage?: boolean;
}) {
  return prisma.match.upsert({
    where: { id: data.id },
    update: {
      round: data.round,
      team1Id: data.team1Id,
      team2Id: data.team2Id,
      winner: data.winner,
      score: data.score,
      status: data.status,
      courtId: data.courtId,
      time: data.time,
      startTime: data.startTime,
      duration: data.duration,
      priority: data.priority,
      refereeId: data.refereeId,
      refereeName: data.refereeName,
      stage: data.stage,
      loserMatchId: data.loserMatchId,
      nextMatchId: data.nextMatchId,
      bookingId: data.bookingId,
      bookingItemId: data.bookingItemId,
      groupId: data.groupId,
      groupStage: data.groupStage,
    },
    create: data,
  });
}

async function upsertSponsor(data: {
  id: number;
  tournamentId: number;
  name: string;
  logoUrl?: string | null;
  amount: number;
  websiteUrl?: string | null;
}) {
  return prisma.sponsor.upsert({
    where: { id: data.id },
    update: {
      name: data.name,
      logoUrl: data.logoUrl,
      amount: data.amount,
      websiteUrl: data.websiteUrl,
    },
    create: data,
  });
}

async function upsertPrize(data: {
  id: number;
  tournamentId: number;
  eventId?: number | null;
  name: string;
  rewardType: string;
  value: number;
  description?: string | null;
  winnerTeamId?: number | null;
}) {
  return prisma.prize.upsert({
    where: { id: data.id },
    update: {
      eventId: data.eventId,
      name: data.name,
      rewardType: data.rewardType,
      value: data.value,
      description: data.description,
      winnerTeamId: data.winnerTeamId,
    },
    create: data,
  });
}

async function upsertFinancialTransaction(data: {
  id: number;
  tournamentId: number;
  description: string;
  type: string;
  amount: number;
  status: string;
  date?: Date;
}) {
  return prisma.financialTransaction.upsert({
    where: { id: data.id },
    update: {
      description: data.description,
      type: data.type,
      amount: data.amount,
      status: data.status,
      date: data.date,
    },
    create: data,
  });
}

async function upsertCheckIn(data: {
  id: number;
  tournamentId: number;
  registrationId: number;
  player1CheckedIn: boolean;
  player1CheckedInAt?: Date | null;
  player2CheckedIn: boolean;
  player2CheckedInAt?: Date | null;
}) {
  return prisma.checkIn.upsert({
    where: { id: data.id },
    update: {
      registrationId: data.registrationId,
      player1CheckedIn: data.player1CheckedIn,
      player1CheckedInAt: data.player1CheckedInAt,
      player2CheckedIn: data.player2CheckedIn,
      player2CheckedInAt: data.player2CheckedInAt,
    },
    create: data,
  });
}

async function upsertTournamentPoster(data: {
  tournamentId: number;
  imageUrl: string;
  metadataHash: string;
}) {
  return prisma.tournamentPoster.upsert({
    where: { tournamentId: data.tournamentId },
    update: {
      imageUrl: data.imageUrl,
      metadataHash: data.metadataHash,
    },
    create: {
      tournamentId: data.tournamentId,
      imageUrl: data.imageUrl,
      metadataHash: data.metadataHash,
    },
  });
}

async function seedClosedTournament(id: number, name: string) {
  const relativeDate = (daysOffset: number) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + daysOffset);
    return date.toISOString().slice(0, 10);
  };

  await prisma.match.deleteMany({ where: { tournamentId: id } });
  // await prisma.tournamentBooking.deleteMany({ where: { tournamentId: id } });
  await prisma.seed.deleteMany({ where: { tournamentId: id } });

  await upsertTournament({
    id,
    organizerId: MAIN_USER_ID,
    name,
    venue: 'Picklehub Central Court, District 1',
    latitude: 10.7769,
    longitude: 106.7009,
    startDate: new Date('2026-07-25T08:00:00Z'),
    endDate: new Date('2026-07-28T18:00:00Z'),
    registered: 32,
    status: id === 9998 ? TournamentStatus.in_progress : TournamentStatus.closed_registration,
    banner: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0',
    description: `Deterministic closed registration tournament for frontend testing - ${name}`,
    registrationStartDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    registrationEndDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    centerIds: id === 9998 ? ['c0000000-c000-4000-8000-000000000001'] : [],
  });

  await upsertEvent({
    id: id * 10 + 1,
    tournamentId: id,
    name: "Men's Singles Closed",
    type: EventType.Singles,
    skillRange: '3.5-4.5',
    gender: Gender.Men,
    participants: 16,
    capacity: 32,
    entryFee: 150000,
  });

  await upsertEvent({
    id: id * 10 + 2,
    tournamentId: id,
    name: 'Mixed Doubles Closed',
    type: EventType.Doubles,
    skillRange: 'All',
    gender: Gender.Mixed,
    participants: 16,
    capacity: 32,
    entryFee: 300000,
  });

  for (let i = 0; i < 16; i++) {
    const idxStr = (i + 1).toString().padStart(2, '0');
    const playerId = TOURNAMENT_PLAYER_IDS[i];
    const regId = id * 1000 + i + 1;
    const teamId = id * 1000 + 500 + i + 1;
    const rating = parseFloat((3.4 + i * 0.05).toFixed(2));

    await upsertRegistration({
      id: regId,
      tournamentId: id,
      eventId: id * 10 + 1,
      playerId,
      playerName: getPlayerName(i),
      playerRating: rating,
      playerGender: 'M',
      playerAge: 20 + i,
      paymentStatus: 'completed',
      status: RegistrationStatus.approved,
    });

    await upsertTeam({
      id: teamId,
      tournamentId: id,
      eventId: id * 10 + 1,
      player1Id: playerId,
      player1Name: getPlayerName(i),
      player1Rating: rating,
      player1Gender: 'M',
      avgRating: rating,
    });

    await upsertFinancialTransaction({
      id: id * 1000 + 900 + i + 1,
      tournamentId: id,
      description: `Registration fee (Reg ID: ${regId}) - Player: ${getPlayerName(i)}`,
      type: 'income',
      amount: 150000,
      status: 'completed',
    });
  }

  for (let i = 0; i < 16; i++) {
    const idxStr = (i + 1).toString().padStart(2, '0');
    const partnerIdxStr = (17 + i).toString().padStart(2, '0');
    const player1Id = TOURNAMENT_PLAYER_IDS[i];
    const player2Id = TOURNAMENT_PLAYER_IDS[16 + i];
    const regId = id * 1000 + 100 + i + 1;
    const teamId = id * 1000 + 600 + i + 1;
    const r1 = parseFloat((3.5 + i * 0.04).toFixed(2));
    const r2 = parseFloat((3.3 + i * 0.04).toFixed(2));
    const avgRating = parseFloat(((r1 + r2) / 2).toFixed(2));

    await upsertRegistration({
      id: regId,
      tournamentId: id,
      eventId: id * 10 + 2,
      playerId: player1Id,
      playerName: getPlayerName(i),
      playerRating: r1,
      playerGender: 'M',
      playerAge: 20 + i,
      partnerId: player2Id,
      partnerName: getPlayerName(16 + i),
      partnerRating: r2,
      partnerGender: 'F',
      partnerAge: 20 + i,
      paymentStatus: 'completed',
      status: RegistrationStatus.approved,
    });

    await upsertTeam({
      id: teamId,
      tournamentId: id,
      eventId: id * 10 + 2,
      player1Id,
      player1Name: getPlayerName(i),
      player1Rating: r1,
      player1Gender: 'M',
      player2Id,
      player2Name: getPlayerName(16 + i),
      player2Rating: r2,
      player2Gender: 'F',
      avgRating,
    });

    await upsertFinancialTransaction({
      id: id * 1000 + 950 + i + 1,
      tournamentId: id,
      description: `Registration fee (Reg ID: ${regId}) - Players: ${getPlayerName(i)} / ${getPlayerName(16 + i)}`,
      type: 'income',
      amount: 300000,
      status: 'completed',
    });
  }

  if (id === 9998 || id === 9997) {
    // Seed Seeds
    for (let i = 0; i < 16; i++) {
      const teamId = id * 1000 + 600 + i + 1; // e.g. 9998601 to 9998616
      await upsertSeed({
        id: id * 100 + i + 1, // e.g. 999801 to 999816
        tournamentId: id,
        eventId: id * 10 + 2, // 99982
        seed: i + 1,
        teamId,
        teamName: `${getPlayerName(i)} / ${getPlayerName(16 + i)}`,
        rating: parseFloat((3.5 + i * 0.04).toFixed(2)),
        status: 'locked',
      });
    }

    const bookingIndices = id === 9998 ? [16, 17, 18, 19] : [31, 32, 33, 34];
    const dateOffset = id === 9998 ? 21 : 35;
    for (let i = 0; i < 4; i++) {
      const bIdx = bookingIndices[i];
      const externalBookingId = `b0040000-b004-4000-8000-0000000100${bIdx}`;
      await prisma.tournamentBooking.upsert({
        where: { externalBookingId },
        update: {
          tournamentId: id,
          statusMirror: 'CONFIRMED',
          date: relativeDate(dateOffset + i),
          totalPrice: 300000.0,
        },
        create: {
          id: id * 100 + i + 1,
          tournamentId: id,
          externalBookingId,
          centerId: 'c0000000-c000-4000-8000-000000000001',
          date: relativeDate(dateOffset + i),
          statusMirror: 'CONFIRMED',
          totalPrice: 300000.0,
        },
      });
    }
  }
}


async function seedT10101() {
  const id = 10101;
  const eventId = 101011;

  await prisma.checkIn.deleteMany({ where: { tournamentId: id } });
  await prisma.match.deleteMany({ where: { tournamentId: id } });
  // await prisma.tournamentBooking.deleteMany({ where: { tournamentId: id } });
  await prisma.seed.deleteMany({ where: { tournamentId: id } });
  // await prisma.tournamentReferee.deleteMany({ where: { tournamentId: id } });

  await upsertTournament({
    id,
    organizerId: MAIN_USER_ID,
    name: 'PickleHub Seeds Locked - Awaiting Draw',
    venue: 'Picklehub Central Court, District 1',
    latitude: 10.7769,
    longitude: 106.7009,
    startDate: new Date('2026-08-01T08:00:00Z'),
    endDate: new Date('2026-08-03T18:00:00Z'),
    registered: 16,
    status: TournamentStatus.closed_registration,
    banner: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0',
    description: 'Seeds locked, awaiting group stage draw or knockout configuration.',
    registrationStartDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    registrationEndDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  });

  await upsertEvent({
    id: eventId,
    tournamentId: id,
    name: 'Mixed Doubles 4.0',
    type: EventType.Doubles,
    skillRange: '4.0',
    gender: Gender.Mixed,
    participants: 16,
    capacity: 32,
    entryFee: 300000,
  });

  // Seed referee
  await upsertTournamentReferee({
    id: 10101100,
    tournamentId: id,
    refereeId: REFEREE_ID,
    refereeName: 'Picklehub Seed Referee',
    refereeEmail: 'referee@picklehub.com',
  });

  for (let i = 0; i < 16; i++) {
    const idxStr = (i + 1).toString().padStart(2, '0');
    const partnerIdxStr = (17 + i).toString().padStart(2, '0');
    const player1Id = TOURNAMENT_PLAYER_IDS[i];
    const player2Id = TOURNAMENT_PLAYER_IDS[16 + i];
    const regId = id * 100 + i; // 1010100 to 1010115
    const teamId = id * 100 + 50 + i; // 1010150 to 1010165
    const r1 = parseFloat((4.0 + i * 0.02).toFixed(2));
    const r2 = parseFloat((3.8 + i * 0.02).toFixed(2));
    const avgRating = parseFloat(((r1 + r2) / 2).toFixed(2));
    const paymentStatus = i < 12 ? 'completed' : 'pending';

    await upsertRegistration({
      id: regId,
      tournamentId: id,
      eventId,
      playerId: player1Id,
      playerName: getPlayerName(i),
      playerRating: r1,
      playerGender: 'M',
      playerAge: 20 + i,
      partnerId: player2Id,
      partnerName: getPlayerName(16 + i),
      partnerRating: r2,
      partnerGender: 'F',
      partnerAge: 20 + i,
      paymentStatus,
      status: RegistrationStatus.approved,
    });

    await upsertTeam({
      id: teamId,
      tournamentId: id,
      eventId,
      player1Id,
      player1Name: getPlayerName(i),
      player1Rating: r1,
      player1Gender: 'M',
      player2Id,
      player2Name: getPlayerName(16 + i),
      player2Rating: r2,
      player2Gender: 'F',
      avgRating,
    });

    await upsertSeed({
      id: id * 100 + i, // 1010100 to 1010115
      tournamentId: id,
      eventId,
      seed: i + 1,
      teamId,
      teamName: `${getPlayerName(i)} / ${getPlayerName(16 + i)}`,
      rating: avgRating,
      status: 'locked',
    });

    await upsertFinancialTransaction({
      id: id * 1000 + i, // 10101000 to 10101015
      tournamentId: id,
      description: `Registration fee (Reg ID: ${regId}) - Players: ${getPlayerName(i)} / ${getPlayerName(16 + i)}`,
      type: 'income',
      amount: 300000,
      status: paymentStatus,
    });
  }

  // Seed Check-ins
  await upsertCheckIn({
    id: 1010191,
    tournamentId: id,
    registrationId: 1010100,
    player1CheckedIn: true,
    player1CheckedInAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    player2CheckedIn: true,
    player2CheckedInAt: new Date(Date.now() - 50 * 60 * 1000),
  });

  await upsertCheckIn({
    id: 1010192,
    tournamentId: id,
    registrationId: 1010101,
    player1CheckedIn: true,
    player1CheckedInAt: new Date(Date.now() - 40 * 60 * 1000),
    player2CheckedIn: false,
  });

  await upsertCheckIn({
    id: 1010193,
    tournamentId: id,
    registrationId: 1010102,
    player1CheckedIn: true,
    player1CheckedInAt: new Date(Date.now() - 30 * 60 * 1000),
    player2CheckedIn: true,
    player2CheckedInAt: new Date(Date.now() - 25 * 60 * 1000),
  });

  await upsertCheckIn({
    id: 1010194,
    tournamentId: id,
    registrationId: 1010103,
    player1CheckedIn: true,
    player1CheckedInAt: new Date(Date.now() - 20 * 60 * 1000),
    player2CheckedIn: false,
  });
}

async function seedT10102() {
  const id = 10102;
  const event1Id = 101021;
  const event2Id = 101022;

  await prisma.checkIn.deleteMany({ where: { tournamentId: id } });
  await prisma.match.deleteMany({ where: { tournamentId: id } });
  await prisma.groupStageMembership.deleteMany({ where: { group: { tournamentId: id } } });
  await prisma.groupStageGroup.deleteMany({ where: { tournamentId: id } });
  // await prisma.tournamentBooking.deleteMany({ where: { tournamentId: id } });
  await prisma.seed.deleteMany({ where: { tournamentId: id } });
  // await prisma.tournamentReferee.deleteMany({ where: { tournamentId: id } });

  await upsertTournament({
    id,
    organizerId: MAIN_USER_ID,
    name: 'PickleHub Group Stage In Progress',
    venue: 'Picklehub Central Court, District 1',
    latitude: 10.7769,
    longitude: 106.7009,
    startDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    registered: 11,
    status: TournamentStatus.in_progress,
    banner: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0',
    description: 'Active group stage round-robin tournaments.',
    registrationStartDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    registrationEndDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    centerIds: ['c0000000-c000-4000-8000-000000000001'],
  });

  // Seed referee
  await upsertTournamentReferee({
    id: 10102100,
    tournamentId: id,
    refereeId: REFEREE_ID,
    refereeName: 'Picklehub Seed Referee',
    refereeEmail: 'referee@picklehub.com',
  });

  // Bookings mirrors
  for (let bIdx = 0; bIdx < 6; bIdx++) {
    const bookingIndex = 120 + bIdx;
    await upsertTournamentBooking({
      id: id * 100 + bIdx, // 1010200 to 1010205
      tournamentId: id,
      externalBookingId: `b0040000-b004-4000-8000-000000010${bookingIndex}`,
      centerId: 'c0000000-c000-4000-8000-000000000001',
      date: new Date().toISOString().slice(0, 10),
      statusMirror: 'CONFIRMED',
      totalPrice: 150000.0,
    });
  }

  // --- EVENT 1 ---
  await upsertEvent({
    id: event1Id,
    tournamentId: id,
    name: "Men's Singles 3.5",
    type: EventType.Singles,
    skillRange: '3.5',
    gender: Gender.Men,
    participants: 7,
    capacity: 16,
    entryFee: 150000,
    numGroups: 2,
    totalAdvance: 4,
    advanceMethod: 'standard',
  });

  // Seed Event 1 Teams & Registrations
  for (let i = 0; i < 7; i++) {
    const idxStr = (i + 1).toString().padStart(2, '0');
    const playerId = TOURNAMENT_PLAYER_IDS[i];
    const regId = id * 100 + i; // 1010200 to 1010206
    const teamId = id * 100 + 50 + i; // 1010250 to 1010256
    const rating = parseFloat((3.5 + i * 0.05).toFixed(2));

    await upsertRegistration({
      id: regId,
      tournamentId: id,
      eventId: event1Id,
      playerId,
      playerName: getPlayerName(i),
      playerRating: rating,
      playerGender: 'M',
      playerAge: 20 + i,
      paymentStatus: 'completed',
      status: RegistrationStatus.approved,
    });

    await upsertTeam({
      id: teamId,
      tournamentId: id,
      eventId: event1Id,
      player1Id: playerId,
      player1Name: getPlayerName(i),
      player1Rating: rating,
      player1Gender: 'M',
      avgRating: rating,
    });

    await upsertSeed({
      id: id * 100 + i, // 1010200 to 1010206
      tournamentId: id,
      eventId: event1Id,
      seed: i + 1,
      teamId,
      teamName: getPlayerName(i),
      rating,
      status: 'locked',
    });
  }

  // Seed Groups for Event 1
  const grpAId = 1010211;
  const grpBId = 1010212;
  await upsertGroupStageGroup({ id: grpAId, tournamentId: id, eventId: event1Id, name: 'Group A', order: 0 });
  await upsertGroupStageGroup({ id: grpBId, tournamentId: id, eventId: event1Id, name: 'Group B', order: 1 });

  // Group A memberships
  await upsertGroupStageMembership({ id: 1010201, groupId: grpAId, teamId: 1010250, seed: 1, wins: 2, losses: 0, points: 6 });
  await upsertGroupStageMembership({ id: 1010202, groupId: grpAId, teamId: 1010251, seed: 2, wins: 0, losses: 1, points: 0 });
  await upsertGroupStageMembership({ id: 1010203, groupId: grpAId, teamId: 1010252, seed: 3, wins: 1, losses: 1, points: 3 });
  await upsertGroupStageMembership({ id: 1010204, groupId: grpAId, teamId: 1010253, seed: 4, wins: 0, losses: 1, points: 0 });

  // Group B memberships
  await upsertGroupStageMembership({ id: 1010205, groupId: grpBId, teamId: 1010254, seed: 5, wins: 1, losses: 0, points: 3 });
  await upsertGroupStageMembership({ id: 1010206, groupId: grpBId, teamId: 1010255, seed: 6, wins: 0, losses: 1, points: 0 });
  await upsertGroupStageMembership({ id: 1010207, groupId: grpBId, teamId: 1010256, seed: 7, wins: 0, losses: 0, points: 0 });

  // Group A matches (6 matches)
  // Match 1: 1010250 vs 1010251 (Completed)
  await upsertMatch({
    id: 1010281, tournamentId: id, eventId: event1Id, round: 'Round 1',
    team1Id: 1010250, team2Id: 1010251, winner: 1010250, score: '11-5, 11-7',
    status: MatchStatus.completed, time: new Date(Date.now() - 5 * 60 * 60 * 1000), stage: 'group_stage', groupId: grpAId, groupStage: true
  });
  // Match 2: 1010252 vs 1010253 (Completed)
  await upsertMatch({
    id: 1010282, tournamentId: id, eventId: event1Id, round: 'Round 1',
    team1Id: 1010252, team2Id: 1010253, winner: 1010252, score: '11-8, 11-6',
    status: MatchStatus.completed, time: new Date(Date.now() - 4 * 60 * 60 * 1000), stage: 'group_stage', groupId: grpAId, groupStage: true
  });
  // Match 3: 1010250 vs 1010252 (Completed)
  await upsertMatch({
    id: 1010283, tournamentId: id, eventId: event1Id, round: 'Round 2',
    team1Id: 1010250, team2Id: 1010252, winner: 1010250, score: '11-9, 11-8',
    status: MatchStatus.completed, time: new Date(Date.now() - 2 * 60 * 60 * 1000), stage: 'group_stage', groupId: grpAId, groupStage: true
  });
  // Match 4: 1010251 vs 1010253 (Scheduled - Referee assigned)
  await upsertMatch({
    id: 1010284, tournamentId: id, eventId: event1Id, round: 'Round 2',
    team1Id: 1010251, team2Id: 1010253, status: MatchStatus.scheduled,
    time: new Date(Date.now() + 2 * 60 * 60 * 1000), priority: 'medium', stage: 'group_stage', groupId: grpAId, groupStage: true,
    refereeId: REFEREE_ID, refereeName: 'Picklehub Seed Referee', bookingId: 1010201, bookingItemId: `17e10000-17e1-4000-8000-000000112101`
  });
  // Match 5: 1010250 vs 1010253 (Scheduled - Referee is null)
  await upsertMatch({
    id: 1010285, tournamentId: id, eventId: event1Id, round: 'Round 3',
    team1Id: 1010250, team2Id: 1010253, status: MatchStatus.scheduled,
    time: new Date(Date.now() + 4 * 60 * 60 * 1000), priority: 'high', stage: 'group_stage', groupId: grpAId, groupStage: true,
    bookingId: 1010202, bookingItemId: `17e10000-17e1-4000-8000-000000112201`
  });
  // Match 6: 1010251 vs 1010252 (Pending)
  await upsertMatch({
    id: 1010286, tournamentId: id, eventId: event1Id, round: 'Round 3',
    team1Id: 1010251, team2Id: 1010252, status: MatchStatus.pending, stage: 'group_stage', groupId: grpAId, groupStage: true
  });

  // Group B matches (3 matches)
  // Match 7: 1010254 vs 1010255 (Completed)
  await upsertMatch({
    id: 1010287, tournamentId: id, eventId: event1Id, round: 'Round 1',
    team1Id: 1010254, team2Id: 1010255, winner: 1010254, score: '11-6, 11-4',
    status: MatchStatus.completed, time: new Date(Date.now() - 3 * 60 * 60 * 1000), stage: 'group_stage', groupId: grpBId, groupStage: true
  });
  // Match 8: 1010254 vs 1010256 (Live - in_progress, score 8-6)
  await upsertMatch({
    id: 1010288, tournamentId: id, eventId: event1Id, round: 'Round 2',
    team1Id: 1010254, team2Id: 1010256, status: MatchStatus.in_progress, score: '8-6',
    time: new Date(), startTime: new Date(), priority: 'high', stage: 'group_stage', groupId: grpBId, groupStage: true,
    refereeId: REFEREE_ID, refereeName: 'Picklehub Seed Referee', bookingId: 1010200, bookingItemId: `17e10000-17e1-4000-8000-000000112001`
  });
  // Match 9: 1010255 vs 1010256 (Pending)
  await upsertMatch({
    id: 1010289, tournamentId: id, eventId: event1Id, round: 'Round 3',
    team1Id: 1010255, team2Id: 1010256, status: MatchStatus.pending, stage: 'group_stage', groupId: grpBId, groupStage: true
  });

  // Seed Check-in
  await upsertCheckIn({
    id: 1010291,
    tournamentId: id,
    registrationId: 1010200,
    player1CheckedIn: true,
    player1CheckedInAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    player2CheckedIn: false,
  });

  // --- EVENT 2 ---
  await upsertEvent({
    id: event2Id,
    tournamentId: id,
    name: "Men's Singles 4.0",
    type: EventType.Singles,
    skillRange: '4.0',
    gender: Gender.Men,
    participants: 4,
    capacity: 16,
    entryFee: 150000,
    numGroups: 1,
    totalAdvance: 2,
    advanceMethod: 'standard',
  });

  // Seed Event 2 Teams & Registrations (4 players, mapping TOURNAMENT_PLAYER_IDS[8..11])
  for (let i = 0; i < 4; i++) {
    const idxStr = (9 + i).toString().padStart(2, '0');
    const playerId = TOURNAMENT_PLAYER_IDS[8 + i];
    const regId = id * 100 + 10 + i; // 1010210 to 1010213
    const teamId = id * 100 + 60 + i; // 1010260 to 1010263
    const rating = parseFloat((4.0 + i * 0.05).toFixed(2));

    await upsertRegistration({
      id: regId,
      tournamentId: id,
      eventId: event2Id,
      playerId,
      playerName: getPlayerName(8 + i),
      playerRating: rating,
      playerGender: 'M',
      playerAge: 20 + i,
      paymentStatus: 'completed',
      status: RegistrationStatus.approved,
    });

    await upsertTeam({
      id: teamId,
      tournamentId: id,
      eventId: event2Id,
      player1Id: playerId,
      player1Name: getPlayerName(8 + i),
      player1Rating: rating,
      player1Gender: 'M',
      avgRating: rating,
    });

    await upsertSeed({
      id: id * 100 + 10 + i, // 1010210 to 1010213
      tournamentId: id,
      eventId: event2Id,
      seed: i + 1,
      teamId,
      teamName: getPlayerName(8 + i),
      rating,
      status: 'locked',
    });
  }

  // Seed Groups for Event 2
  const grpE2Id = 1010221;
  await upsertGroupStageGroup({ id: grpE2Id, tournamentId: id, eventId: event2Id, name: 'Group A', order: 0 });

  // Membership statistics
  await upsertGroupStageMembership({ id: 1010211, groupId: grpE2Id, teamId: 1010260, seed: 1, wins: 3, losses: 0, points: 9 });
  await upsertGroupStageMembership({ id: 1010212, groupId: grpE2Id, teamId: 1010261, seed: 2, wins: 2, losses: 1, points: 6 });
  await upsertGroupStageMembership({ id: 1010213, groupId: grpE2Id, teamId: 1010262, seed: 3, wins: 1, losses: 2, points: 3 });
  await upsertGroupStageMembership({ id: 1010214, groupId: grpE2Id, teamId: 1010263, seed: 4, wins: 0, losses: 3, points: 0 });

  // 6 completed matches
  // Match 1: 1010260 vs 1010261
  await upsertMatch({
    id: 1010291, tournamentId: id, eventId: event2Id, round: 'Round 1',
    team1Id: 1010260, team2Id: 1010261, winner: 1010260, score: '11-7, 11-5',
    status: MatchStatus.completed, time: new Date(Date.now() - 6 * 60 * 60 * 1000), stage: 'group_stage', groupId: grpE2Id, groupStage: true
  });
  // Match 2: 1010262 vs 1010263
  await upsertMatch({
    id: 1010292, tournamentId: id, eventId: event2Id, round: 'Round 1',
    team1Id: 1010262, team2Id: 1010263, winner: 1010262, score: '11-6, 11-8',
    status: MatchStatus.completed, time: new Date(Date.now() - 5 * 60 * 60 * 1000), stage: 'group_stage', groupId: grpE2Id, groupStage: true
  });
  // Match 3: 1010260 vs 1010262
  await upsertMatch({
    id: 1010293, tournamentId: id, eventId: event2Id, round: 'Round 2',
    team1Id: 1010260, team2Id: 1010262, winner: 1010260, score: '11-4, 11-6',
    status: MatchStatus.completed, time: new Date(Date.now() - 4 * 60 * 60 * 1000), stage: 'group_stage', groupId: grpE2Id, groupStage: true
  });
  // Match 4: 1010261 vs 1010263
  await upsertMatch({
    id: 1010294, tournamentId: id, eventId: event2Id, round: 'Round 2',
    team1Id: 1010261, team2Id: 1010263, winner: 1010261, score: '11-8, 11-7',
    status: MatchStatus.completed, time: new Date(Date.now() - 3 * 60 * 60 * 1000), stage: 'group_stage', groupId: grpE2Id, groupStage: true
  });
  // Match 5: 1010260 vs 1010263
  await upsertMatch({
    id: 1010295, tournamentId: id, eventId: event2Id, round: 'Round 3',
    team1Id: 1010260, team2Id: 1010263, winner: 1010260, score: '11-3, 11-5',
    status: MatchStatus.completed, time: new Date(Date.now() - 2 * 60 * 60 * 1000), stage: 'group_stage', groupId: grpE2Id, groupStage: true
  });
  // Match 6: 1010261 vs 1010262
  await upsertMatch({
    id: 1010296, tournamentId: id, eventId: event2Id, round: 'Round 3',
    team1Id: 1010261, team2Id: 1010262, winner: 1010261, score: '11-9, 11-7',
    status: MatchStatus.completed, time: new Date(Date.now() - 1 * 60 * 60 * 1000), stage: 'group_stage', groupId: grpE2Id, groupStage: true
  });
}

async function seedT10103() {
  const id = 10103;
  const eventId = 101031;

  await prisma.checkIn.deleteMany({ where: { tournamentId: id } });
  await prisma.match.deleteMany({ where: { tournamentId: id } });
  // await prisma.tournamentBooking.deleteMany({ where: { tournamentId: id } });
  await prisma.seed.deleteMany({ where: { tournamentId: id } });
  // await prisma.tournamentReferee.deleteMany({ where: { tournamentId: id } });

  await upsertTournament({
    id,
    organizerId: MAIN_USER_ID,
    name: 'PickleHub Knockout - With BYE',
    venue: 'Picklehub Central Court, District 1',
    latitude: 10.7769,
    longitude: 106.7009,
    startDate: new Date('2026-07-20T08:00:00Z'),
    endDate: new Date('2026-07-22T18:00:00Z'),
    registered: 6,
    status: TournamentStatus.in_progress,
    banner: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0',
    description: 'Knockout bracket stage featuring Walkovers and BYEs.',
    registrationStartDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    registrationEndDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    centerIds: ['c0000000-c000-4000-8000-000000000001'],
  });

  await upsertEvent({
    id: eventId,
    tournamentId: id,
    name: 'Mixed Doubles Open',
    type: EventType.Doubles,
    skillRange: 'Open',
    gender: Gender.Mixed,
    participants: 6,
    capacity: 16,
    entryFee: 300000,
  });

  // Bookings mirrors
  for (let bIdx = 0; bIdx < 4; bIdx++) {
    const bookingIndex = 130 + bIdx;
    await upsertTournamentBooking({
      id: id * 100 + bIdx, // 1010300 to 1010303
      tournamentId: id,
      externalBookingId: `b0040000-b004-4000-8000-000000010${bookingIndex}`,
      centerId: 'c0000000-c000-4000-8000-000000000001',
      date: new Date().toISOString().slice(0, 10),
      statusMirror: 'CONFIRMED',
      totalPrice: 150000.0,
    });
  }

  // Seed 6 Teams & Registrations
  for (let i = 0; i < 6; i++) {
    const idxStr = (i + 1).toString().padStart(2, '0');
    const partnerIdxStr = (17 + i).toString().padStart(2, '0');
    const player1Id = TOURNAMENT_PLAYER_IDS[i];
    const player2Id = TOURNAMENT_PLAYER_IDS[16 + i];
    const regId = id * 100 + i; // 1010300 to 1010305
    const teamId = id * 100 + 50 + i; // 1010350 to 1010355
    const r1 = parseFloat((4.5 + i * 0.02).toFixed(2));
    const r2 = parseFloat((4.3 + i * 0.02).toFixed(2));
    const avgRating = parseFloat(((r1 + r2) / 2).toFixed(2));

    await upsertRegistration({
      id: regId,
      tournamentId: id,
      eventId,
      playerId: player1Id,
      playerName: getPlayerName(i),
      playerRating: r1,
      playerGender: 'M',
      playerAge: 20 + i,
      partnerId: player2Id,
      partnerName: getPlayerName(16 + i),
      partnerRating: r2,
      partnerGender: 'F',
      partnerAge: 20 + i,
      paymentStatus: 'completed',
      status: RegistrationStatus.approved,
    });

    await upsertTeam({
      id: teamId,
      tournamentId: id,
      eventId,
      player1Id,
      player1Name: getPlayerName(i),
      player1Rating: r1,
      player1Gender: 'M',
      player2Id,
      player2Name: getPlayerName(16 + i),
      player2Rating: r2,
      player2Gender: 'F',
      avgRating,
    });

    await upsertSeed({
      id: id * 100 + i, // 1010300 to 1010305
      tournamentId: id,
      eventId,
      seed: i + 1,
      teamId,
      teamName: `${getPlayerName(i)} / ${getPlayerName(16 + i)}`,
      rating: avgRating,
      status: 'locked',
    });
  }

  // Knockout stage matches (QF -> SF -> Final)
  // Let's create matches in order:
  // Final (7)
  const m7 = await upsertMatch({
    id: 1010387, tournamentId: id, eventId, round: 'Finals',
    status: MatchStatus.pending, stage: 'knockout'
  });

  // SF1 (5), SF2 (6)
  const m5 = await upsertMatch({
    id: 1010385, tournamentId: id, eventId, round: 'Semifinals',
    team1Id: 1010350, team2Id: 1010352, status: MatchStatus.scheduled,
    time: new Date(Date.now() + 3 * 60 * 60 * 1000), priority: 'high',
    nextMatchId: m7.id, stage: 'knockout', bookingId: 1010301, bookingItemId: `17e10000-17e1-4000-8000-000000113101`
  });

  const m6 = await upsertMatch({
    id: 1010386, tournamentId: id, eventId, round: 'Semifinals',
    team1Id: 1010351, team2Id: null, status: MatchStatus.pending,
    nextMatchId: m7.id, stage: 'knockout'
  });

  // QF1 (1), QF2 (2), QF3 (3), QF4 (4)
  await upsertMatch({
    id: 1010381, tournamentId: id, eventId, round: 'Quarterfinals',
    team1Id: 1010350, team2Id: null, winner: 1010350, score: 'Walkover',
    status: MatchStatus.walkover, time: new Date(Date.now() - 5 * 60 * 60 * 1000),
    nextMatchId: m5.id, stage: 'knockout'
  });

  await upsertMatch({
    id: 1010382, tournamentId: id, eventId, round: 'Quarterfinals',
    team1Id: 1010351, team2Id: null, winner: 1010351, score: 'Walkover',
    status: MatchStatus.walkover, time: new Date(Date.now() - 4 * 60 * 60 * 1000),
    nextMatchId: m6.id, stage: 'knockout'
  });

  await upsertMatch({
    id: 1010383, tournamentId: id, eventId, round: 'Quarterfinals',
    team1Id: 1010352, team2Id: 1010355, winner: 1010352, score: '11-6, 11-8',
    status: MatchStatus.completed, time: new Date(Date.now() - 3 * 60 * 60 * 1000),
    nextMatchId: m5.id, stage: 'knockout'
  });

  await upsertMatch({
    id: 1010384, tournamentId: id, eventId, round: 'Quarterfinals',
    team1Id: 1010353, team2Id: 1010354, status: MatchStatus.scheduled,
    time: new Date(Date.now() + 1 * 60 * 60 * 1000), priority: 'medium',
    nextMatchId: m6.id, stage: 'knockout', bookingId: 1010300, bookingItemId: `17e10000-17e1-4000-8000-000000113001`
  });
}

async function seedT10104() {
  const id = 10104;
  const eventId = 101041;

  await prisma.checkIn.deleteMany({ where: { tournamentId: id } });
  await prisma.match.deleteMany({ where: { tournamentId: id } });
  await prisma.groupStageMembership.deleteMany({ where: { group: { tournamentId: id } } });
  await prisma.groupStageGroup.deleteMany({ where: { tournamentId: id } });
  // await prisma.tournamentBooking.deleteMany({ where: { tournamentId: id } });
  await prisma.seed.deleteMany({ where: { tournamentId: id } });
  // await prisma.tournamentReferee.deleteMany({ where: { tournamentId: id } });
  // await prisma.prize.deleteMany({ where: { tournamentId: id } });
  // await prisma.financialTransaction.deleteMany({ where: { tournamentId: id } });

  await upsertTournament({
    id,
    organizerId: MAIN_USER_ID,
    name: 'PickleHub Completed - Full Flow',
    venue: 'Picklehub Central Court, District 1',
    latitude: 10.7769,
    longitude: 106.7009,
    startDate: new Date('2026-06-15T08:00:00Z'),
    endDate: new Date('2026-06-18T18:00:00Z'),
    registered: 8,
    status: TournamentStatus.completed,
    banner: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea',
    description: 'Fully completed tournament from group stage through knockout and prize handouts.',
    registrationStartDate: new Date('2026-05-01T08:00:00Z'),
    registrationEndDate: new Date('2026-06-10T18:00:00Z'),
  });

  await upsertEvent({
    id: eventId,
    tournamentId: id,
    name: "Men's Doubles 4.0",
    type: EventType.Doubles,
    skillRange: '4.0',
    gender: Gender.Men,
    participants: 8,
    capacity: 16,
    entryFee: 300000,
  });

  // Seed 8 Teams & Registrations
  for (let i = 0; i < 8; i++) {
    const idxStr = (i + 1).toString().padStart(2, '0');
    const partnerIdxStr = (9 + i).toString().padStart(2, '0');
    const player1Id = TOURNAMENT_PLAYER_IDS[i];
    const player2Id = TOURNAMENT_PLAYER_IDS[8 + i];
    const regId = id * 100 + i; // 1010400 to 1010407
    const teamId = id * 100 + 50 + i; // 1010450 to 1010457
    const r1 = parseFloat((4.0 + i * 0.02).toFixed(2));
    const r2 = parseFloat((3.8 + i * 0.02).toFixed(2));
    const avgRating = parseFloat(((r1 + r2) / 2).toFixed(2));

    await upsertRegistration({
      id: regId,
      tournamentId: id,
      eventId,
      playerId: player1Id,
      playerName: getPlayerName(i),
      playerRating: r1,
      playerGender: 'M',
      playerAge: 20 + i,
      partnerId: player2Id,
      partnerName: getPlayerName(8 + i),
      partnerRating: r2,
      partnerGender: 'M',
      partnerAge: 20 + i,
      paymentStatus: 'completed',
      status: RegistrationStatus.approved,
    });

    await upsertTeam({
      id: teamId,
      tournamentId: id,
      eventId,
      player1Id,
      player1Name: getPlayerName(i),
      player1Rating: r1,
      player1Gender: 'M',
      player2Id,
      player2Name: getPlayerName(8 + i),
      player2Rating: r2,
      player2Gender: 'M',
      avgRating,
    });

    await upsertSeed({
      id: id * 100 + i, // 1010400 to 1010407
      tournamentId: id,
      eventId,
      seed: i + 1,
      teamId,
      teamName: `${getPlayerName(i)} / ${getPlayerName(8 + i)}`,
      rating: avgRating,
      status: 'locked',
    });

    await upsertFinancialTransaction({
      id: id * 1000 + i, // 10104000 to 10104007
      tournamentId: id,
      description: `Registration fee (Reg ID: ${regId}) - Players: ${getPlayerName(i)} / ${getPlayerName(8 + i)}`,
      type: 'income',
      amount: 300000,
      status: 'completed',
      date: new Date('2026-05-15T09:00:00Z'),
    });
  }

  // Group stage
  const grpAId = 1010411;
  const grpBId = 1010412;
  await upsertGroupStageGroup({ id: grpAId, tournamentId: id, eventId, name: 'Group A', order: 0 });
  await upsertGroupStageGroup({ id: grpBId, tournamentId: id, eventId, name: 'Group B', order: 1 });

  // Memberships
  await upsertGroupStageMembership({ id: 1010411, groupId: grpAId, teamId: 1010450, seed: 1, wins: 3, losses: 0, points: 9, isAdvanced: true });
  await upsertGroupStageMembership({ id: 1010412, groupId: grpAId, teamId: 1010451, seed: 2, wins: 2, losses: 1, points: 6, isAdvanced: true });
  await upsertGroupStageMembership({ id: 1010413, groupId: grpAId, teamId: 1010452, seed: 3, wins: 1, losses: 2, points: 3, isAdvanced: false });
  await upsertGroupStageMembership({ id: 1010414, groupId: grpAId, teamId: 1010453, seed: 4, wins: 0, losses: 3, points: 0, isAdvanced: false });

  await upsertGroupStageMembership({ id: 1010415, groupId: grpBId, teamId: 1010454, seed: 5, wins: 3, losses: 0, points: 9, isAdvanced: true });
  await upsertGroupStageMembership({ id: 1010416, groupId: grpBId, teamId: 1010455, seed: 6, wins: 2, losses: 1, points: 6, isAdvanced: true });
  await upsertGroupStageMembership({ id: 1010417, groupId: grpBId, teamId: 1010456, seed: 7, wins: 1, losses: 2, points: 3, isAdvanced: false });
  await upsertGroupStageMembership({ id: 1010418, groupId: grpBId, teamId: 1010457, seed: 8, wins: 0, losses: 3, points: 0, isAdvanced: false });

  // 12 Group Stage matches
  const startTime = new Date('2026-06-15T09:00:00Z');
  let matchId = 1010461;
  const groupTeams = [
    [1010450, 1010451, 1010452, 1010453], // Group A
    [1010454, 1010455, 1010456, 1010457]  // Group B
  ];

  for (let grpIdx = 0; grpIdx < 2; grpIdx++) {
    const grpId = grpIdx === 0 ? grpAId : grpBId;
    const teams = groupTeams[grpIdx];
    const pairs = [
      [0, 1], [2, 3],
      [0, 2], [1, 3],
      [0, 3], [1, 2]
    ];
    for (let pIdx = 0; pIdx < pairs.length; pIdx++) {
      const t1 = teams[pairs[pIdx][0]];
      const t2 = teams[pairs[pIdx][1]];
      // Lower index team always wins deterministically to match group stats
      const winner = t1 < t2 ? t1 : t2;
      const matchDate = new Date(startTime.getTime() + (matchId - 1010461) * 30 * 60 * 1000);
      await upsertMatch({
        id: matchId, tournamentId: id, eventId, round: `Round ${Math.floor(pIdx/2) + 1}`,
        team1Id: t1, team2Id: t2, winner, score: '11-6, 11-8', status: MatchStatus.completed,
        time: matchDate, stage: 'group_stage', groupId: grpId, groupStage: true
      });
      matchId++;
    }
  }

  // Knockout completed matches
  // Final (ID 1010487)
  const finalMatch = await upsertMatch({
    id: 1010487, tournamentId: id, eventId, round: 'Finals',
    team1Id: 1010450, team2Id: 1010451, winner: 1010450, score: '11-9, 11-7',
    status: MatchStatus.completed, time: new Date('2026-06-18T15:00:00Z'), stage: 'knockout'
  });

  // SF1 (1010485), SF2 (1010486)
  const sf1 = await upsertMatch({
    id: 1010485, tournamentId: id, eventId, round: 'Semifinals',
    team1Id: 1010450, team2Id: 1010454, winner: 1010450, score: '11-7, 11-8',
    status: MatchStatus.completed, time: new Date('2026-06-17T14:00:00Z'),
    nextMatchId: finalMatch.id, stage: 'knockout'
  });

  const sf2 = await upsertMatch({
    id: 1010486, tournamentId: id, eventId, round: 'Semifinals',
    team1Id: 1010451, team2Id: 1010452, winner: 1010451, score: '11-8, 11-9',
    status: MatchStatus.completed, time: new Date('2026-06-17T15:30:00Z'),
    nextMatchId: finalMatch.id, stage: 'knockout'
  });

  // QF1 to QF4 (1010481 to 1010484)
  await upsertMatch({
    id: 1010481, tournamentId: id, eventId, round: 'Quarterfinals',
    team1Id: 1010450, team2Id: 1010457, winner: 1010450, score: '11-6, 11-7',
    status: MatchStatus.completed, time: new Date('2026-06-16T09:00:00Z'),
    nextMatchId: sf1.id, stage: 'knockout'
  });

  await upsertMatch({
    id: 1010482, tournamentId: id, eventId, round: 'Quarterfinals',
    team1Id: 1010453, team2Id: 1010454, winner: 1010454, score: '11-8, 11-9',
    status: MatchStatus.completed, time: new Date('2026-06-16T10:30:00Z'),
    nextMatchId: sf1.id, stage: 'knockout'
  });

  await upsertMatch({
    id: 1010483, tournamentId: id, eventId, round: 'Quarterfinals',
    team1Id: 1010451, team2Id: 1010456, winner: 1010451, score: '11-5, 11-6',
    status: MatchStatus.completed, time: new Date('2026-06-16T13:00:00Z'),
    nextMatchId: sf2.id, stage: 'knockout'
  });

  await upsertMatch({
    id: 1010484, tournamentId: id, eventId, round: 'Quarterfinals',
    team1Id: 1010452, team2Id: 1010455, winner: 1010452, score: '11-9, 11-7',
    status: MatchStatus.completed, time: new Date('2026-06-16T14:30:00Z'),
    nextMatchId: sf2.id, stage: 'knockout'
  });

  // Prizes
  await upsertPrize({
    id: 1010491, tournamentId: id, eventId, name: 'Champion Prize', rewardType: 'cash',
    value: 15000000, description: '15,000,000 VND cash reward', winnerTeamId: 1010450
  });

  await upsertPrize({
    id: 1010492, tournamentId: id, eventId, name: 'Runner-up Prize', rewardType: 'trophy',
    value: 0, description: 'Runner-up trophy shield', winnerTeamId: 1010451
  });

  // Financials
  // Sponsorship
  await upsertFinancialTransaction({
    id: 1010493, tournamentId: id, description: 'Adidas Sponsorship for Men Doubles',
    type: 'income', amount: 20000000, status: 'completed', date: new Date('2026-06-01T10:00:00Z')
  });

  // Champion Cash payout
  await upsertFinancialTransaction({
    id: 1010494, tournamentId: id, description: 'Cash Prize payout to Champion - Team 1010450',
    type: 'expense', amount: 15000000, status: 'completed', date: new Date('2026-06-19T09:00:00Z')
  });

  // Venue payout
  await upsertFinancialTransaction({
    id: 1010495, tournamentId: id, description: 'Court booking & venue rental fee',
    type: 'expense', amount: 2000000, status: 'completed', date: new Date('2026-06-14T08:00:00Z')
  });

  // 1 refund transaction
  await upsertFinancialTransaction({
    id: 1010496, tournamentId: id, description: 'Refund for entry fee change',
    type: 'refund', amount: 300000, status: 'completed', date: new Date('2026-06-12T16:00:00Z')
  });
}

async function seedT10105() {
  const id = 10105;
  const eventId = 101051;

  await prisma.checkIn.deleteMany({ where: { tournamentId: id } });
  await prisma.match.deleteMany({ where: { tournamentId: id } });
  await prisma.groupStageMembership.deleteMany({ where: { group: { tournamentId: id } } });
  await prisma.groupStageGroup.deleteMany({ where: { tournamentId: id } });
  // await prisma.tournamentBooking.deleteMany({ where: { tournamentId: id } });
  await prisma.seed.deleteMany({ where: { tournamentId: id } });
  // await prisma.tournamentReferee.deleteMany({ where: { tournamentId: id } });
  // await prisma.prize.deleteMany({ where: { tournamentId: id } });
  // await prisma.financialTransaction.deleteMany({ where: { tournamentId: id } });

  await upsertTournament({
    id,
    organizerId: MAIN_USER_ID,
    name: 'PickleHub Auto-Schedule Reality Test',
    venue: 'Picklehub Central Court, District 1',
    latitude: 10.7769,
    longitude: 106.7009,
    startDate: new Date('2026-08-01T08:00:00Z'),
    endDate: new Date('2026-08-03T18:00:00Z'),
    registered: 8,
    status: TournamentStatus.in_progress,
    banner: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0',
    description: 'Tournament with groups drawn and matches generated but unscheduled, ready for auto-scheduling.',
    registrationStartDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    registrationEndDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    centerIds: ['c0000000-c000-4000-8000-000000000001'],
  });

  await upsertEvent({
    id: eventId,
    tournamentId: id,
    name: "Men's Singles 4.5",
    type: EventType.Singles,
    skillRange: '4.5',
    gender: Gender.Men,
    participants: 8,
    capacity: 16,
    entryFee: 150000,
    numGroups: 2,
    totalAdvance: 4,
    advanceMethod: 'standard',
  });

  // Seed referee
  await upsertTournamentReferee({
    id: 10105100,
    tournamentId: id,
    refereeId: REFEREE_ID,
    refereeName: 'Picklehub Seed Referee',
    refereeEmail: 'referee@picklehub.com',
  });

  // Seed 8 Teams & Registrations (using TOURNAMENT_PLAYER_IDS 0 to 7)
  for (let i = 0; i < 8; i++) {
    const idxStr = (i + 1).toString().padStart(2, '0');
    const playerId = TOURNAMENT_PLAYER_IDS[i];
    const regId = id * 100 + i; // 1010500 to 1010507
    const teamId = id * 100 + 50 + i; // 1010550 to 1010557
    const rating = parseFloat((4.5 + i * 0.05).toFixed(2));

    await upsertRegistration({
      id: regId,
      tournamentId: id,
      eventId,
      playerId,
      playerName: getPlayerName(i),
      playerRating: rating,
      playerGender: 'M',
      playerAge: 20 + i,
      paymentStatus: 'completed',
      status: RegistrationStatus.approved,
    });

    await upsertTeam({
      id: teamId,
      tournamentId: id,
      eventId,
      player1Id: playerId,
      player1Name: getPlayerName(i),
      player1Rating: rating,
      player1Gender: 'M',
      avgRating: rating,
    });

    await upsertSeed({
      id: id * 100 + i, // 1010500 to 1010507
      tournamentId: id,
      eventId,
      seed: i + 1,
      teamId,
      teamName: getPlayerName(i),
      rating,
      status: 'locked',
    });

    await upsertFinancialTransaction({
      id: id * 1000 + i, // 10105000 to 10105007
      tournamentId: id,
      description: `Registration fee (Reg ID: ${regId}) - Player: ${getPlayerName(i)}`,
      type: 'income',
      amount: 150000,
      status: 'completed',
    });
  }

  // Seed Prizes
  await upsertPrize({
    id: 1010591,
    tournamentId: id,
    eventId,
    name: 'Championship Trophy',
    rewardType: 'trophy',
    value: 2000000,
    description: 'Gold Trophy + 2,000,000 VND Cash',
  });

  await upsertPrize({
    id: 1010592,
    tournamentId: id,
    eventId,
    name: 'Second Place',
    rewardType: 'merchandise',
    value: 1000000,
    description: 'Silver Medal + Picklehub Merchandise Kit',
  });

  // Seed Groups
  const grpAId = 1010511;
  const grpBId = 1010512;
  await upsertGroupStageGroup({ id: grpAId, tournamentId: id, eventId, name: 'Group A', order: 0 });
  await upsertGroupStageGroup({ id: grpBId, tournamentId: id, eventId, name: 'Group B', order: 1 });

  // Group memberships: 4 teams in Group A, 4 teams in Group B
  // Group A: 1010550, 1010551, 1010552, 1010553
  await upsertGroupStageMembership({ id: 1010501, groupId: grpAId, teamId: 1010550, seed: 1 });
  await upsertGroupStageMembership({ id: 1010502, groupId: grpAId, teamId: 1010551, seed: 2 });
  await upsertGroupStageMembership({ id: 1010503, groupId: grpAId, teamId: 1010552, seed: 3 });
  await upsertGroupStageMembership({ id: 1010504, groupId: grpAId, teamId: 1010553, seed: 4 });

  // Group B: 1010554, 1010555, 1010556, 1010557
  await upsertGroupStageMembership({ id: 1010505, groupId: grpBId, teamId: 1010554, seed: 5 });
  await upsertGroupStageMembership({ id: 1010506, groupId: grpBId, teamId: 1010555, seed: 6 });
  await upsertGroupStageMembership({ id: 1010507, groupId: grpBId, teamId: 1010556, seed: 7 });
  await upsertGroupStageMembership({ id: 1010508, groupId: grpBId, teamId: 1010557, seed: 8 });

  // Seed Matches: Round-robin for Group A and Group B
  // Group A matches (6 matches)
  const groupAMatches = [
    { id: 1010581, team1Id: 1010550, team2Id: 1010551, round: 'Round 1' },
    { id: 1010582, team1Id: 1010552, team2Id: 1010553, round: 'Round 1' },
    { id: 1010583, team1Id: 1010550, team2Id: 1010552, round: 'Round 2' },
    { id: 1010584, team1Id: 1010551, team2Id: 1010553, round: 'Round 2' },
    { id: 1010585, team1Id: 1010550, team2Id: 1010553, round: 'Round 3' },
    { id: 1010586, team1Id: 1010551, team2Id: 1010552, round: 'Round 3' },
  ];

  for (const m of groupAMatches) {
    await upsertMatch({
      id: m.id,
      tournamentId: id,
      eventId,
      round: m.round,
      team1Id: m.team1Id,
      team2Id: m.team2Id,
      status: MatchStatus.scheduled,
      stage: 'Group Stage',
      groupId: grpAId,
      groupStage: true,
      bookingId: null,
      bookingItemId: null,
    });
  }

  // Group B matches (6 matches)
  const groupBMatches = [
    { id: 1010587, team1Id: 1010554, team2Id: 1010555, round: 'Round 1' },
    { id: 1010588, team1Id: 1010556, team2Id: 1010557, round: 'Round 1' },
    { id: 1010589, team1Id: 1010554, team2Id: 1010556, round: 'Round 2' },
    { id: 1010590, team1Id: 1010555, team2Id: 1010557, round: 'Round 2' },
    { id: 1010593, team1Id: 1010554, team2Id: 1010557, round: 'Round 3' },
    { id: 1010594, team1Id: 1010555, team2Id: 1010556, round: 'Round 3' },
  ];

  for (const m of groupBMatches) {
    await upsertMatch({
      id: m.id,
      tournamentId: id,
      eventId,
      round: m.round,
      team1Id: m.team1Id,
      team2Id: m.team2Id,
      status: MatchStatus.scheduled,
      stage: 'Group Stage',
      groupId: grpBId,
      groupStage: true,
      bookingId: null,
      bookingItemId: null,
    });
  }

  // Bookings mirrors: Seed 12 CONFIRMED bookings from center 1, referencing bookingIndex 101 to 112
  for (let bIdx = 0; bIdx < 12; bIdx++) {
    const bookingIndex = 101 + bIdx;
    await upsertTournamentBooking({
      id: id * 100 + bIdx, // 1010500 to 1010511
      tournamentId: id,
      externalBookingId: `b0040000-b004-4000-8000-000000010${bookingIndex}`,
      centerId: 'c0000000-c000-4000-8000-000000000001',
      date: new Date('2026-08-02').toISOString().slice(0, 10),
      statusMirror: 'CONFIRMED',
      totalPrice: 300000.0,
    });
  }
}

async function main() {
  console.log('Seeding tournament database using upsert...');

  // 1. Seed Courts
  await upsertCourt(999311, 'Central Court 1', CourtStatus.available);
  await upsertCourt(999312, 'Central Court 2', CourtStatus.available);
  await upsertCourt(999313, 'Central Court 3', CourtStatus.occupied);
  await upsertCourt(999314, 'Central Court 4', CourtStatus.maintenance);
  console.log('Seeded Courts.');

  // 2. Scenario 1: Draft Tournament (ID: 9991)
  await upsertTournament({
    id: 9991,
    organizerId: MAIN_USER_ID,
    name: 'Internal Club Warm-up (Draft)',
    venue: 'Picklehub Central Court, District 1',
    latitude: 10.7769,
    longitude: 106.7009,
    startDate: new Date('2026-09-01T08:00:00Z'),
    endDate: new Date('2026-09-03T18:00:00Z'),
    registered: 0,
    status: TournamentStatus.draft,
    banner: null,
    description: 'Internal warm-up tournament for Picklehub club members.',
    registrationStartDate: null,
    registrationEndDate: null,
  });

  await upsertEvent({
    id: 99911,
    tournamentId: 9991,
    name: "Men's Singles Practice",
    type: EventType.Singles,
    skillRange: '3.0-4.0',
    gender: Gender.Men,
    participants: 0,
    capacity: 8,
    entryFee: 50000,
  });
  console.log('Seeded Tournament 1 (Draft).');

  // 3. Scenario 2: Published Tournament (ID: 9992)
  await upsertTournament({
    id: 9992,
    organizerId: OWNER_USER_ID,
    name: 'Saigon Winter Open 2026',
    venue: 'Saigon Pickleball Arena, District 7',
    latitude: 10.7969,
    longitude: 106.7209,
    startDate: new Date('2026-08-20T08:00:00Z'),
    endDate: new Date('2026-08-22T18:00:00Z'),
    registered: 0,
    status: TournamentStatus.published,
    banner: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0',
    registrationStartDate: new Date('2026-08-01T00:00:00Z'), // Future registration start
    registrationEndDate: new Date('2026-08-15T23:59:59Z'),
  });

  await upsertEvent({
    id: 99921,
    tournamentId: 9992,
    name: "Women's Singles Open",
    type: EventType.Singles,
    skillRange: 'Open',
    gender: Gender.Women,
    participants: 0,
    capacity: 32,
    entryFee: 200000,
  });

  await upsertSponsor({
    id: 999291,
    tournamentId: 9992,
    name: 'Adidas Vietnam',
    logoUrl: 'https://example.com/adidas.png',
    amount: 50000000,
    websiteUrl: 'https://adidas.com.vn',
  });

  await upsertFinancialTransaction({
    id: 999295,
    tournamentId: 9992,
    description: 'Sponsor ID: 999291 - Adidas Vietnam',
    type: 'income',
    amount: 50000000,
    status: 'completed',
  });

  await upsertPrize({
    id: 999281,
    tournamentId: 9992,
    eventId: 99921,
    name: 'First Place - Women Singles',
    rewardType: 'cash',
    value: 10000000,
    description: '10,000,000 VND Cash + Adidas Gift Voucher',
  });
  console.log('Seeded Tournament 2 (Published).');

  // 4. Scenario 3: Open Registration Tournament (ID: 9993)
  await upsertTournament({
    id: 9993,
    organizerId: MAIN_USER_ID,
    name: 'Picklehub Summer Championship 2026',
    venue: 'Picklehub Central Court, District 1',
    latitude: 10.7769,
    longitude: 106.7009,
    startDate: new Date('2026-07-15T08:00:00Z'),
    endDate: new Date('2026-07-18T18:00:00Z'),
    registered: 32,
    status: TournamentStatus.open_registration,
    banner: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea',
    registrationStartDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // Opened 5 days ago
    registrationEndDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000), // Closes in 20 days
  });

  await upsertEvent({
    id: 99931,
    tournamentId: 9993,
    name: "Men's Singles 3.5+",
    type: EventType.Singles,
    skillRange: '3.5-4.5',
    gender: Gender.Men,
    participants: 16,
    capacity: 32,
    entryFee: 150000,
  });

  await upsertEvent({
    id: 99932,
    tournamentId: 9993,
    name: 'Mixed Doubles Open',
    type: EventType.Doubles,
    skillRange: 'All',
    gender: Gender.Mixed,
    participants: 16,
    capacity: 32,
    entryFee: 300000,
  });

  // Programmatically seed 16 approved teams for Event 99931 (Men's Singles 3.5+)
  for (let i = 0; i < 16; i++) {
    const idxStr = (i + 1).toString().padStart(2, '0');
    const playerId = TOURNAMENT_PLAYER_IDS[i];
    const regId = 9993000 + i + 1;
    const teamId = 9993500 + i + 1;
    const rating = parseFloat((3.4 + i * 0.05).toFixed(2));

    await upsertRegistration({
      id: regId,
      tournamentId: 9993,
      eventId: 99931,
      playerId,
      playerName: getPlayerName(i),
      playerRating: rating,
      playerGender: 'M',
      playerAge: 20 + i,
      paymentStatus: 'completed',
      status: RegistrationStatus.approved,
    });

    await upsertTeam({
      id: teamId,
      tournamentId: 9993,
      eventId: 99931,
      player1Id: playerId,
      player1Name: getPlayerName(i),
      player1Rating: rating,
      player1Gender: 'M',
      avgRating: rating,
    });

    await upsertFinancialTransaction({
      id: 9993900 + i + 1,
      tournamentId: 9993,
      description: `Registration fee (Reg ID: ${regId}) - Player: ${getPlayerName(i)}`,
      type: 'income',
      amount: 150000,
      status: 'completed',
    });
  }

  // Programmatically seed 16 approved teams for Event 99932 (Mixed Doubles Open)
  for (let i = 0; i < 16; i++) {
    const idxStr = (i + 1).toString().padStart(2, '0');
    const partnerIdxStr = (17 + i).toString().padStart(2, '0');
    const player1Id = TOURNAMENT_PLAYER_IDS[i];
    const player2Id = TOURNAMENT_PLAYER_IDS[16 + i];
    const regId = 9993100 + i + 1;
    const teamId = 9993600 + i + 1;
    const r1 = parseFloat((3.5 + i * 0.04).toFixed(2));
    const r2 = parseFloat((3.3 + i * 0.04).toFixed(2));
    const avgRating = parseFloat(((r1 + r2) / 2).toFixed(2));

    await upsertRegistration({
      id: regId,
      tournamentId: 9993,
      eventId: 99932,
      playerId: player1Id,
      playerName: getPlayerName(i),
      playerRating: r1,
      playerGender: 'M',
      playerAge: 20 + i,
      partnerId: player2Id,
      partnerName: getPlayerName(16 + i),
      partnerRating: r2,
      partnerGender: 'F',
      partnerAge: 20 + i,
      paymentStatus: 'completed',
      status: RegistrationStatus.approved,
    });

    await upsertTeam({
      id: teamId,
      tournamentId: 9993,
      eventId: 99932,
      player1Id,
      player1Name: getPlayerName(i),
      player1Rating: r1,
      player1Gender: 'M',
      player2Id,
      player2Name: getPlayerName(16 + i),
      player2Rating: r2,
      player2Gender: 'F',
      avgRating,
    });

    await upsertFinancialTransaction({
      id: 9993950 + i + 1,
      tournamentId: 9993,
      description: `Registration fee (Reg ID: ${regId}) - Players: ${getPlayerName(i)} / ${getPlayerName(16 + i)}`,
      type: 'income',
      amount: 300000,
      status: 'completed',
    });
  }
  console.log('Seeded Tournament 3 (Open Registration).');

  // 5. Scenario 4: In Progress Tournament (ID: 9994)
  await upsertTournament({
    id: 9994,
    organizerId: MAIN_USER_ID,
    name: 'Hanoi Spring Classic 2026',
    venue: 'Hanoi Pickleball Hub, Tay Ho',
    latitude: 21.0600,
    longitude: 105.8200,
    startDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Started yesterday
    endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // Ends in 2 days
    registered: 3,
    status: TournamentStatus.in_progress,
    banner: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0',
    registrationStartDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    registrationEndDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // Closed 5 days ago
    centerIds: ['c0000000-c000-4000-8000-000000000001'],
  });

  await upsertEvent({
    id: 99941,
    tournamentId: 9994,
    name: 'Mixed Doubles 4.0',
    type: EventType.Doubles,
    skillRange: '4.0',
    gender: Gender.Mixed,
    participants: 16,
    capacity: 32,
    entryFee: 300000,
  });

  // Approved registrations that formed teams
  await upsertRegistration({
    id: 999401,
    tournamentId: 9994,
    eventId: 99941,
    playerId: MAIN_USER_ID,
    playerName: 'Picklehub Seed User',
    playerRating: 4.1,
    playerGender: 'M',
    partnerId: BOOKER_1_ID,
    partnerName: 'Picklehub Booker 01',
    partnerRating: 3.9,
    partnerGender: 'F',
    paymentStatus: 'completed',
    status: RegistrationStatus.approved,
  });

  await upsertRegistration({
    id: 999402,
    tournamentId: 9994,
    eventId: 99941,
    playerId: 'e0000094-e29b-41d4-a716-446655440211',
    playerName: 'David Beckham',
    playerRating: 4.2,
    playerGender: 'M',
    partnerId: 'e0000094-e29b-41d4-a716-446655440212',
    partnerName: 'Victoria Beckham',
    partnerRating: 3.8,
    partnerGender: 'F',
    paymentStatus: 'completed',
    status: RegistrationStatus.approved,
  });

  await upsertRegistration({
    id: 999403,
    tournamentId: 9994,
    eventId: 99941,
    playerId: 'e0000094-e29b-41d4-a716-446655440311',
    playerName: 'Roger Federer',
    playerRating: 4.5,
    playerGender: 'M',
    partnerId: 'e0000094-e29b-41d4-a716-446655440312',
    partnerName: 'Mirka Federer',
    partnerRating: 3.5,
    partnerGender: 'F',
    paymentStatus: 'completed',
    status: RegistrationStatus.approved,
  });

  // Teams formed from registrations
  const team1 = await upsertTeam({
    id: 999451,
    tournamentId: 9994,
    eventId: 99941,
    player1Id: MAIN_USER_ID,
    player1Name: 'Picklehub Seed User',
    player1Rating: 4.1,
    player1Gender: 'M',
    player2Id: BOOKER_1_ID,
    player2Name: 'Picklehub Booker 01',
    player2Rating: 3.9,
    player2Gender: 'F',
    avgRating: 4.0,
  });

  const team2 = await upsertTeam({
    id: 999452,
    tournamentId: 9994,
    eventId: 99941,
    player1Id: 'e0000094-e29b-41d4-a716-446655440211',
    player1Name: 'David Beckham',
    player1Rating: 4.2,
    player1Gender: 'M',
    player2Id: 'e0000094-e29b-41d4-a716-446655440212',
    player2Name: 'Victoria Beckham',
    player2Rating: 3.8,
    player2Gender: 'F',
    avgRating: 4.0,
  });

  const team3 = await upsertTeam({
    id: 999453,
    tournamentId: 9994,
    eventId: 99941,
    player1Id: 'e0000094-e29b-41d4-a716-446655440311',
    player1Name: 'Roger Federer',
    player1Rating: 4.5,
    player1Gender: 'M',
    player2Id: 'e0000094-e29b-41d4-a716-446655440312',
    player2Name: 'Mirka Federer',
    player2Rating: 3.5,
    player2Gender: 'F',
    avgRating: 4.0,
  });

  // Programmatically seed 13 more approved teams to reach 16 teams in Event 99941
  for (let i = 3; i < 16; i++) {
    const idxStr = (i + 1).toString().padStart(2, '0');
    const partnerIdxStr = (17 + i).toString().padStart(2, '0');
    const player1Id = TOURNAMENT_PLAYER_IDS[i];
    const player2Id = TOURNAMENT_PLAYER_IDS[16 + i];
    const regId = 999410 + i;
    const teamId = 999460 + i;
    const r1 = parseFloat((3.8 + i * 0.02).toFixed(2));
    const r2 = parseFloat((3.6 + i * 0.02).toFixed(2));
    const avgRating = parseFloat(((r1 + r2) / 2).toFixed(2));

    await upsertRegistration({
      id: regId,
      tournamentId: 9994,
      eventId: 99941,
      playerId: player1Id,
      playerName: getPlayerName(i),
      playerRating: r1,
      playerGender: 'M',
      playerAge: 20 + i,
      partnerId: player2Id,
      partnerName: getPlayerName(16 + i),
      partnerRating: r2,
      partnerGender: 'F',
      partnerAge: 20 + i,
      paymentStatus: 'completed',
      status: RegistrationStatus.approved,
    });

    await upsertTeam({
      id: teamId,
      tournamentId: 9994,
      eventId: 99941,
      player1Id,
      player1Name: getPlayerName(i),
      player1Rating: r1,
      player1Gender: 'M',
      player2Id,
      player2Name: getPlayerName(16 + i),
      player2Rating: r2,
      player2Gender: 'F',
      avgRating,
    });
  }

  // Seeds
  await upsertSeed({
    id: 999471,
    tournamentId: 9994,
    eventId: 99941,
    seed: 1,
    teamId: team1.id,
    teamName: 'Picklehub Seed User / Picklehub Booker 01',
    rating: 4.0,
    status: 'locked',
  });

  await upsertSeed({
    id: 999472,
    tournamentId: 9994,
    eventId: 99941,
    seed: 2,
    teamId: team2.id,
    teamName: 'David Beckham / Victoria Beckham',
    rating: 4.0,
    status: 'locked',
  });

  // Matches in different statuses
  // A. Match completed
  await upsertMatch({
    id: 999481,
    tournamentId: 9994,
    eventId: 99941,
    round: 'Quarterfinals',
    team1Id: team1.id,
    team2Id: team2.id,
    winner: team1.id,
    score: '11-7, 11-9',
    status: MatchStatus.completed,
    courtId: 999311,
    time: new Date(Date.now() - 4 * 60 * 60 * 1000),
    startTime: new Date(Date.now() - 4 * 60 * 60 * 1000),
    duration: 35,
    priority: 'medium',
  });

  // B. Match in progress
  await upsertMatch({
    id: 999482,
    tournamentId: 9994,
    eventId: 99941,
    round: 'Semifinals',
    team1Id: team1.id,
    team2Id: team3.id,
    status: MatchStatus.in_progress,
    courtId: 999312,
    time: new Date(),
    startTime: new Date(),
    priority: 'high',
    refereeId: REFEREE_ID,
    refereeName: 'Picklehub Seed Referee',
  });

  // C. Match scheduled
  await upsertMatch({
    id: 999483,
    tournamentId: 9994,
    eventId: 99941,
    round: 'Finals',
    status: MatchStatus.scheduled,
    time: new Date(Date.now() + 24 * 60 * 60 * 1000),
    priority: 'high',
  });

  // D. Match walkover
  await upsertMatch({
    id: 999484,
    tournamentId: 9994,
    eventId: 99941,
    round: 'Consolation',
    team1Id: team2.id,
    team2Id: team3.id,
    winner: team2.id,
    score: 'Walkover',
    status: MatchStatus.walkover,
    time: new Date(Date.now() - 2 * 60 * 60 * 1000),
  });

  // CheckIn records
  await upsertCheckIn({
    id: 999491,
    tournamentId: 9994,
    registrationId: 999401,
    player1CheckedIn: true,
    player1CheckedInAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    player2CheckedIn: true,
    player2CheckedInAt: new Date(Date.now() - 50 * 60 * 1000),
  });
  console.log('Seeded Tournament 4 (In Progress).');

  // 6. Scenario 5: Completed Tournament (ID: 9995)
  await upsertTournament({
    id: 9995,
    organizerId: MAIN_USER_ID,
    name: 'Picklehub Autumn Classic 2025',
    venue: 'Picklehub Central Court, District 1',
    latitude: 10.7769,
    longitude: 106.7009,
    startDate: new Date('2025-10-10T08:00:00Z'),
    endDate: new Date('2025-10-12T18:00:00Z'),
    registered: 2,
    status: TournamentStatus.completed,
    banner: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea',
    registrationStartDate: new Date('2025-09-01T08:00:00Z'),
    registrationEndDate: new Date('2025-10-01T18:00:00Z'),
  });

  await upsertEvent({
    id: 99951,
    tournamentId: 9995,
    name: 'Singles Open Division',
    type: EventType.Singles,
    skillRange: 'Open',
    gender: Gender.Mixed,
    participants: 2,
    capacity: 16,
    entryFee: 150000,
  });

  await upsertRegistration({
    id: 999501,
    tournamentId: 9995,
    eventId: 99951,
    playerId: MAIN_USER_ID,
    playerName: 'Picklehub Seed User',
    playerRating: 4.1,
    playerGender: 'M',
    paymentStatus: 'completed',
    status: RegistrationStatus.approved,
  });

  await upsertRegistration({
    id: 999502,
    tournamentId: 9995,
    eventId: 99951,
    playerId: BOOKER_1_ID,
    playerName: 'Picklehub Booker 01',
    playerRating: 3.9,
    playerGender: 'F',
    paymentStatus: 'completed',
    status: RegistrationStatus.approved,
  });

  const compTeam1 = await upsertTeam({
    id: 999551,
    tournamentId: 9995,
    eventId: 99951,
    player1Id: MAIN_USER_ID,
    player1Name: 'Picklehub Seed User',
    player1Rating: 4.1,
    player1Gender: 'M',
    avgRating: 4.1,
  });

  const compTeam2 = await upsertTeam({
    id: 999552,
    tournamentId: 9995,
    eventId: 99951,
    player1Id: BOOKER_1_ID,
    player1Name: 'Picklehub Booker 01',
    player1Rating: 3.9,
    player1Gender: 'F',
    avgRating: 3.9,
  });

  // Completed Matches
  await upsertMatch({
    id: 999581,
    tournamentId: 9995,
    eventId: 99951,
    round: 'Finals',
    team1Id: compTeam1.id,
    team2Id: compTeam2.id,
    winner: compTeam1.id,
    score: '11-9, 12-10',
    status: MatchStatus.completed,
    courtId: 999311,
    time: new Date('2025-10-12T15:00:00Z'),
    startTime: new Date('2025-10-12T15:00:00Z'),
    duration: 40,
    priority: 'high',
  });

  // Prizes awarded
  await upsertPrize({
    id: 999591,
    tournamentId: 9995,
    eventId: 99951,
    name: 'Championship Trophy',
    rewardType: 'trophy',
    value: 5000000,
    description: 'Gold Trophy + 5,000,000 VND Cash',
    winnerTeamId: compTeam1.id,
  });

  await upsertPrize({
    id: 999592,
    tournamentId: 9995,
    eventId: 99951,
    name: 'Second Place',
    rewardType: 'merchandise',
    value: 2000000,
    description: 'Silver Medal + Picklehub Merchandise Kit',
    winnerTeamId: compTeam2.id,
  });

  // Financial transactions reflecting full logs
  await upsertFinancialTransaction({
    id: 999595,
    tournamentId: 9995,
    description: 'Registration fee (Reg ID: 999501) - Player: Picklehub Seed User',
    type: 'income',
    amount: 150000,
    status: 'completed',
    date: new Date('2025-09-15T09:00:00Z'),
  });

  await upsertFinancialTransaction({
    id: 999596,
    tournamentId: 9995,
    description: 'Registration fee (Reg ID: 999502) - Player: Picklehub Booker 01',
    type: 'income',
    amount: 150000,
    status: 'completed',
    date: new Date('2025-09-16T10:00:00Z'),
  });

  await upsertFinancialTransaction({
    id: 999597,
    tournamentId: 9995,
    description: 'Court reservation fee',
    type: 'expense',
    amount: 500000,
    status: 'completed',
    date: new Date('2025-10-10T07:00:00Z'),
  });
  console.log('Seeded Tournament 5 (Completed).');

  // 6b. Postman Test-Flow fixtures — the entities the F2–F7 flows operate on.
  // The flow-mutated rows are cleared first so each flow is re-runnable after a re-seed
  // (matchmaking teams, the referee match, and T2 check-ins are all flow-created).
  await prisma.checkIn.deleteMany({ where: { tournamentId: 9992 } });
  // await prisma.team.deleteMany({ where: { tournamentId: 9991 } });
  await prisma.match.deleteMany({ where: { tournamentId: 9991 } });

  // F3 — Doubles Teams: a Men's Doubles event on T1 with two pre-matched doubles teams (four players total).
  await upsertEvent({
    id: 99912,
    tournamentId: 9991,
    name: "Men's Doubles Open",
    type: EventType.Doubles,
    skillRange: '3.0-4.5',
    gender: Gender.Men,
    participants: 2,
    capacity: 16,
    entryFee: 80000,
  });

  // Team 1 Registration
  await upsertRegistration({
    id: 999103,
    tournamentId: 9991,
    eventId: 99912,
    playerId: '33333333-3333-4333-8333-333333333333',
    playerName: 'Solo Player A',
    playerRating: 3.7,
    playerGender: 'M',
    partnerId: '44444444-4444-4444-8444-444444444444',
    partnerName: 'Solo Player B',
    partnerRating: 3.7,
    partnerGender: 'M',
    paymentStatus: 'completed',
    status: RegistrationStatus.approved,
  });

  // Team 2 Registration
  await upsertRegistration({
    id: 999105,
    tournamentId: 9991,
    eventId: 99912,
    playerId: '55555555-5555-4555-8555-555555555555',
    playerName: 'Solo Player C',
    playerRating: 3.7,
    playerGender: 'M',
    partnerId: BOOKER_1_ID,
    partnerName: 'Solo Player D',
    partnerRating: 3.7,
    partnerGender: 'M',
    paymentStatus: 'completed',
    status: RegistrationStatus.approved,
  });

  // Seed Team records
  await upsertTeam({
    id: 999151,
    tournamentId: 9991,
    eventId: 99912,
    player1Id: '33333333-3333-4333-8333-333333333333',
    player1Name: 'Solo Player A',
    player1Rating: 3.7,
    player1Gender: 'M',
    player2Id: '44444444-4444-4444-8444-444444444444',
    player2Name: 'Solo Player B',
    player2Rating: 3.7,
    player2Gender: 'M',
    avgRating: 3.7,
  });

  await upsertTeam({
    id: 999152,
    tournamentId: 9991,
    eventId: 99912,
    player1Id: '55555555-5555-4555-8555-555555555555',
    player1Name: 'Solo Player C',
    player1Rating: 3.7,
    player1Gender: 'M',
    player2Id: BOOKER_1_ID,
    player2Name: 'Solo Player D',
    player2Rating: 3.7,
    player2Gender: 'M',
    avgRating: 3.7,
  });

  // F4 — Referee: an unassigned match the host can assign/unassign a referee on.
  await upsertMatch({
    id: 999411,
    tournamentId: 9991,
    eventId: 99911,
    round: 'Round 1',
    status: MatchStatus.scheduled,
    priority: 'medium',
  });

  // F5 — Check-in: an approved doubles registration in T2 (both players check in).
  await upsertRegistration({
    id: 999201,
    tournamentId: 9992,
    eventId: 99921,
    playerId: OWNER_USER_ID,
    playerName: 'Picklehub Seed Owner',
    playerRating: 4.0,
    playerGender: 'F',
    partnerId: BOOKER_1_ID,
    partnerName: 'Picklehub Booker 01',
    partnerRating: 3.9,
    partnerGender: 'F',
    paymentStatus: 'completed',
    status: RegistrationStatus.approved,
  });

  // F7 — Prize award: a seeded team in T2 to receive the awarded prize.
  await upsertTeam({ id: 999251, tournamentId: 9992, eventId: 99921, player1Id: OWNER_USER_ID, player1Name: 'Picklehub Seed Owner', player1Rating: 4.0, player1Gender: 'F', avgRating: 4.0 });
  await upsertTeam({ id: 999252, tournamentId: 9992, eventId: 99921, player1Id: BOOKER_1_ID, player1Name: 'Picklehub Booker 01', player1Rating: 3.9, player1Gender: 'F', avgRating: 3.9 });
  console.log('Seeded Postman Test-Flow fixtures (F2-F7).');

  // 7. Scenario 6: Operation Sandbox Tournament (ID: 9996)
  // Purpose-built for the Postman "Operation" flow (seeding → bracket → court → run →
  // standings). It is reset on every re-seed so the flow always starts from a clean
  // slate: four single-player teams with REAL seeded user UUIDs (so match-service accepts
  // a dispatch), NO seeds and NO matches yet. The targeted deletes below are the one place
  // we intentionally clear instead of upsert, because the flow mutates this event.
  await prisma.match.deleteMany({ where: { tournamentId: 9996 } });
  // await prisma.tournamentBooking.deleteMany({ where: { tournamentId: 9996 } });
  await prisma.seed.deleteMany({ where: { tournamentId: 9996 } });

  await upsertTournament({
    id: 9996,
    organizerId: MAIN_USER_ID,
    name: 'Picklehub Operation Sandbox (In Progress)',
    venue: 'Picklehub Central Court, District 1',
    latitude: 10.7769,
    longitude: 106.7009,
    startDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    registered: 16,
    status: TournamentStatus.in_progress,
    banner: null,
    registrationStartDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    registrationEndDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  });

  await upsertEvent({
    id: 99961,
    tournamentId: 9996,
    name: "Men's Singles Sandbox",
    type: EventType.Singles,
    skillRange: '3.0-4.5',
    gender: Gender.Men,
    participants: 16,
    capacity: 32,
    entryFee: 100000,
  });

  // 16 single-player teams, distinct ratings so the seed order is deterministic
  for (let i = 0; i < 16; i++) {
    const idxStr = (i + 1).toString().padStart(2, '0');
    const playerId = TOURNAMENT_PLAYER_IDS[i];
    const teamId = 999460 + i + 1;
    const rating = parseFloat((4.0 - i * 0.1).toFixed(2));

    await upsertTeam({
      id: teamId,
      tournamentId: 9996,
      eventId: 99961,
      player1Id: playerId,
      player1Name: getPlayerName(i),
      player1Rating: rating,
      player1Gender: 'M',
      avgRating: rating,
    });
  }
  console.log('Seeded Tournament 6 (Operation Sandbox).');

  // 8. Scenario 7: Closed Registration Tournament (ID: 9997)
  await seedClosedTournament(9997, 'Picklehub Grand Championship 2026 (Closed)');
  console.log('Seeded Tournament 7 (Closed Registration).');

  // Extra copy tournaments for frontend testing
  await seedClosedTournament(9998, 'Picklehub Master Cup 2026 (Closed - Copy A)');
  console.log('Seeded Tournament 8 (Closed Registration Copy A).');

  await seedClosedTournament(9999, 'Picklehub Open Cup 2026 (Closed - Copy B)');
  console.log('Seeded Tournament 9 (Closed Registration Copy B).');

  await seedClosedTournament(10000, 'Picklehub Arena Challenge 2026 (Closed - Copy C)');
  console.log('Seeded Tournament 10 (Closed Registration Copy C).');

  await seedClosedTournament(10001, 'Picklehub Pro Series 2026 (Closed - Copy D)');
  console.log('Seeded Tournament 11 (Closed Registration Copy D).');

  // Seed mock TournamentPoster data for cache testing
  await upsertTournamentPoster({
    tournamentId: 9992,
    imageUrl: 'https://res.cloudinary.com/picklehub/image/upload/v12345/posters/tournament_9992.png',
    metadataHash: 'mockmetadatahash9992',
  });

  await upsertTournamentPoster({
    tournamentId: 9993,
    imageUrl: 'https://res.cloudinary.com/picklehub/image/upload/v12345/posters/tournament_9993.png',
    metadataHash: 'mockmetadatahash9993',
  });
  console.log('Seeded TournamentPoster cache data.');

  // Seed new PickleHub tournament scenarios
  await seedT10101();
  console.log('Seeded Tournament 10101 (Seeds Locked - Awaiting Draw).');

  await seedT10102();
  console.log('Seeded Tournament 10102 (Group Stage In Progress).');

  await seedT10103();
  console.log('Seeded Tournament 10103 (Knockout - With BYE).');

  await seedT10104();
  console.log('Seeded Tournament 10104 (Completed - Full Flow).');

  // Seed 24 bookings for Auto-Schedule testing in Tournament 10101
  for (let bIdx = 0; bIdx < 12; bIdx++) {
    const bookingIndex = 101 + bIdx;
    await upsertTournamentBooking({
      id: 1010100 + bIdx,
      tournamentId: 10101,
      externalBookingId: `b0040000-b004-4000-8000-000000010${bookingIndex}`,
      centerId: 'c0000000-c000-4000-8000-000000000001',
      date: new Date('2026-08-02').toISOString().slice(0, 10),
      statusMirror: 'CONFIRMED',
      totalPrice: 300000.0,
    });
  }

  await seedT10105();
  console.log('Seeded Tournament 10105 (Auto-Schedule Reality Test).');

  console.log('Database seeding complete using upsert.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
