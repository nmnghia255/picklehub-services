import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Deterministic IDs so other service seeds can reference them
const MAIN_USER_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_USER_ID = '22222222-2222-4222-8222-222222222222';
const BOOKER_1_ID = 'b0000001-b000-4000-8000-000000000000';
const BOOKER_2_ID = 'b0000002-b000-4000-8000-000000000000';
const BOOKER_3_ID = 'b0000003-b000-4000-8000-000000000000';
const REFEREE_ID = 'f0000000-f000-4000-8000-000000000000';

const SOCIAL_PARTICIPANT_01_ID = '6e14cbd8-220f-4ebc-9235-b9a1b8fc4f47';
const SOCIAL_PARTICIPANT_02_ID = 'a1b2c3d4-e5f6-4890-abcd-ef1234567890';
const SOCIAL_PARTICIPANT_03_ID = 'f31f0529-6c82-43a2-a785-bb3d77f8a34e';
const SOCIAL_PARTICIPANT_04_ID = 'b0123456-7890-abcd-ef01-234567890abc';
const SOCIAL_PARTICIPANT_05_ID = 'c0123456-7890-abcd-ef01-234567890abc';
const SOCIAL_PARTICIPANT_06_ID = 'd1111111-1111-4111-8111-111111111111';
const SOCIAL_PARTICIPANT_07_ID = 'd2222222-2222-4222-8222-222222222222';
const SOCIAL_PARTICIPANT_08_ID = 'd3333333-3333-4333-8333-333333333333';

const PLAYER_1_ID = '33333333-3333-4333-8333-333333333333';
const PLAYER_2_ID = '44444444-4444-4444-8444-444444444444';
const PLAYER_3_ID = '55555555-5555-4555-8555-555555555555';

const COACH_1_ID = 'c0000001-c000-4000-8000-000000000000';
const COACH_2_ID = 'c0000002-c000-4000-8000-000000000000';
const COACH_3_ID = 'c0000003-c000-4000-8000-000000000000';

const ADMIN_ID = 'a0000000-a000-4000-8000-000000000000';

const LEARNER_1_ID = 'a0000010-a000-4000-8000-000000000010';
const LEARNER_2_ID = 'a0000011-a000-4000-8000-000000000011';
const LEARNER_3_ID = 'a0000012-a000-4000-8000-000000000012';
const LEARNER_4_ID = 'a0000013-a000-4000-8000-000000000013';

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

const SEED_PASSWORD = 'Picklehub123!';

async function main() {
  console.log('Seeding auth-service users...');
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  const users = [
    {
      id: ADMIN_ID,
      email: 'seed-admin@picklehub.com',
      name: 'Picklehub Admin',
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200',
      role: UserRole.ADMIN,
    },
    {
      id: MAIN_USER_ID,
      email: 'seed-user@picklehub.com',
      name: 'Picklehub Seed User',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
      role: UserRole.USER,
    },
    {
      id: OWNER_USER_ID,
      email: 'seed-owner@picklehub.com',
      name: 'Picklehub Seed Owner',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
      role: UserRole.USER,
    },
    {
      id: REFEREE_ID,
      email: 'seed-referee@picklehub.com',
      name: 'Picklehub Seed Referee',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
      role: UserRole.USER,
    },
    {
      id: BOOKER_1_ID,
      email: 'seed-booker-01@picklehub.com',
      name: 'Picklehub Booker 01',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200',
      role: UserRole.USER,
    },
    {
      id: BOOKER_2_ID,
      email: 'seed-booker-02@picklehub.com',
      name: 'Picklehub Booker 02',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200',
      role: UserRole.USER,
    },
    {
      id: BOOKER_3_ID,
      email: 'seed-booker-03@picklehub.com',
      name: 'Picklehub Booker 03',
      avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=200',
      role: UserRole.USER,
    },
    // --- Social Financial Flow Demo Accounts ---
    // These accounts are linked via deterministic IDs to the event-service seed data
    {
      id: SOCIAL_PARTICIPANT_01_ID,
      email: 'seed-participant-01@picklehub.com',
      name: 'Social Participant 01',
      avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
      role: UserRole.USER,
    },
    {
      id: SOCIAL_PARTICIPANT_02_ID,
      email: 'seed-participant-02@picklehub.com',
      name: 'Social Participant 02',
      avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&q=80&w=200',
      role: UserRole.USER,
    },
    {
      id: SOCIAL_PARTICIPANT_03_ID,
      email: 'seed-participant-03@picklehub.com',
      name: 'Social Participant 03',
      avatarUrl: 'https://images.unsplash.com/photo-1554151228-14d9def656e4?auto=format&fit=crop&q=80&w=200',
      role: UserRole.USER,
    },
    {
      id: SOCIAL_PARTICIPANT_04_ID,
      email: 'seed-participant-04@picklehub.com',
      name: 'Social Participant 04',
      avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
      role: UserRole.USER,
    },
    {
      id: SOCIAL_PARTICIPANT_05_ID,
      email: 'seed-participant-05@picklehub.com',
      name: 'Social Participant 05',
      avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&q=80&w=200',
      role: UserRole.USER,
    },
    {
      id: SOCIAL_PARTICIPANT_06_ID,
      email: 'seed-participant-06@picklehub.com',
      name: 'Social Participant 06',
      avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
      role: UserRole.USER,
    },
    {
      id: SOCIAL_PARTICIPANT_07_ID,
      email: 'seed-participant-07@picklehub.com',
      name: 'Social Participant 07',
      avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&q=80&w=200',
      role: UserRole.USER,
    },
    {
      id: SOCIAL_PARTICIPANT_08_ID,
      email: 'seed-participant-08@picklehub.com',
      name: 'Social Participant 08',
      avatarUrl: 'https://images.unsplash.com/photo-1554151228-14d9def656e4?auto=format&fit=crop&q=80&w=200',
      role: UserRole.USER,
    },
    {
      id: PLAYER_1_ID,
      email: 'seed-player-1@picklehub.com',
      name: SEED_PICKLEHUB_PLAYER_NAMES[1],
      avatarUrl: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&q=80&w=200',
      role: UserRole.USER,
    },
    {
      id: PLAYER_2_ID,
      email: 'seed-player-2@picklehub.com',
      name: SEED_PICKLEHUB_PLAYER_NAMES[2],
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
      role: UserRole.USER,
    },
    {
      id: PLAYER_3_ID,
      email: 'seed-player-3@picklehub.com',
      name: SEED_PICKLEHUB_PLAYER_NAMES[3],
      avatarUrl: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&q=80&w=200',
      role: UserRole.USER,
    },
    {
      id: COACH_1_ID,
      email: 'seed-coach-01@picklehub.com',
      name: 'Nguyễn Văn Hùng',
      avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&q=80&w=200',
      role: UserRole.USER,
    },
    {
      id: COACH_2_ID,
      email: 'seed-coach-02@picklehub.com',
      name: 'Trần Thị Lan',
      avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
      role: UserRole.USER,
    },
    {
      id: COACH_3_ID,
      email: 'seed-coach-03@picklehub.com',
      name: 'Lê Bảo Long',
      avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=200',
      role: UserRole.USER,
    },
    {
      id: LEARNER_1_ID,
      email: 'seed-learner-1@picklehub.com',
      name: 'Learner One',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
      role: UserRole.USER,
    },
    {
      id: LEARNER_2_ID,
      email: 'seed-learner-2@picklehub.com',
      name: 'Learner Two',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
      role: UserRole.USER,
    },
    {
      id: LEARNER_3_ID,
      email: 'seed-learner-3@picklehub.com',
      name: 'Learner Three',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200',
      role: UserRole.USER,
    },
    {
      id: LEARNER_4_ID,
      email: 'seed-learner-4@picklehub.com',
      name: 'Learner Four',
      avatarUrl: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&q=80&w=200',
      role: UserRole.USER,
    },
  ];

  // Programmatically add 32 tournament players to the seeding list
  TOURNAMENT_PLAYER_IDS.forEach((id, index) => {
    const idxStr = (index + 1).toString().padStart(2, '0');
    users.push({
      id,
      email: `seed-tournament-player-${idxStr}@picklehub.com`,
      name: SEED_TOURNAMENT_PLAYER_NAMES[index] ?? `Tournament Player ${idxStr}`,
      avatarUrl: `https://images.unsplash.com/photo-${1500648767791 + index}?auto=format&fit=crop&q=80&w=200`,
      role: UserRole.USER,
    });
  });

  // Programmatically add 61 additional seed players (indexes 4 to 64)
  for (let i = 4; i <= 64; i++) {
    const formattedIndex = String(i).padStart(12, '0');
    const userId = `e0000000-0000-4000-8000-${formattedIndex}`;
    users.push({
      id: userId,
      email: `seed-player-${i}@picklehub.com`,
      name: SEED_PICKLEHUB_PLAYER_NAMES[i] ?? `Picklehub Player ${i}`,
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=Picklehub${i}`,
      role: UserRole.USER,
    });
  }

  for (const user of users) {
    // Delete any conflicting users with the same email but different id
    await prisma.user.deleteMany({
      where: {
        email: user.email,
        id: { not: user.id },
      },
    });

    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        passwordHash,
        isVerified: true,
        status: UserStatus.ACTIVE,
      },
      create: {
        id: user.id,
        email: user.email,
        passwordHash,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role,
        status: UserStatus.ACTIVE,
        isVerified: true,
      },
    });
  }

  console.log('Auth seed complete.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error('Failed to seed', error);
    await prisma.$disconnect();
    process.exit(1);
  });
