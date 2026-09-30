import { PrismaClient, Gender, PreferredHand } from '@prisma/client';

const prisma = new PrismaClient();

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

// Deterministic IDs matching auth-service seeds
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

async function main() {
  console.log('Seeding user-service profiles...');

  const users = [
    {
      id: MAIN_USER_ID,
      fullName: 'Picklehub Seed User',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
      bio: 'Lover of pickleball, playing since 2023. Let\'s play a match!',
      gender: Gender.MALE,
      selfRating: 3.5,
      preferredHand: PreferredHand.RIGHT,
      phoneNumber: '0901234567',
      address: '123 Nguyen Van Linh, District 7, Ho Chi Minh City',
      city: 'Hồ Chí Minh',
      district: 'Quận 7',
      latitude: 10.7294,
      longitude: 106.7029,
    },
    {
      id: OWNER_USER_ID,
      fullName: 'Picklehub Seed Owner',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
      bio: 'Owner of multiple pickleball centers in HCMC. Contact me for business inquiries.',
      gender: Gender.MALE,
      selfRating: 4.0,
      preferredHand: PreferredHand.RIGHT,
      phoneNumber: '0907654321',
      address: '456 Le Loi, District 1, Ho Chi Minh City',
      city: 'Hồ Chí Minh',
      district: 'Quận 1',
      latitude: 10.7760,
      longitude: 106.6990,
    },
    {
      id: REFEREE_ID,
      fullName: 'Picklehub Seed Referee',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
      bio: 'Professional referee for tournament matches.',
      gender: Gender.MALE,
      selfRating: 4.0,
      preferredHand: PreferredHand.RIGHT,
      phoneNumber: '0901122334',
      address: '100 Nguyen Hue, District 1, Ho Chi Minh City',
      city: 'Hồ Chí Minh',
      district: 'Quận 1',
      latitude: 10.7740,
      longitude: 106.7035,
    },
    {
      id: BOOKER_1_ID,
      fullName: 'Picklehub Booker 01',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200',
      bio: 'Intermediate player, looking for doubles games on weekends.',
      gender: Gender.FEMALE,
      selfRating: 3.0,
      preferredHand: PreferredHand.RIGHT,
      phoneNumber: '0912345678',
      address: '789 Dien Bien Phu, Binh Thanh District, Ho Chi Minh City',
      city: 'Hồ Chí Minh',
      district: 'Bình Thạnh',
      latitude: 10.7997,
      longitude: 106.7093,
    },
    {
      id: BOOKER_2_ID,
      fullName: 'Picklehub Booker 02',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200',
      bio: 'Beginner looking to improve. Left-handed player.',
      gender: Gender.MALE,
      selfRating: 2.5,
      preferredHand: PreferredHand.LEFT,
      phoneNumber: '0987654321',
      address: '101 Tran Hung Dao, District 5, Ho Chi Minh City',
      city: 'Hồ Chí Minh',
      district: 'Quận 5',
      latitude: 10.7554,
      longitude: 106.6800,
    },
    {
      id: BOOKER_3_ID,
      fullName: 'Picklehub Booker 03',
      avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=200',
      bio: 'Competitive player, always up for singles challenge.',
      gender: Gender.FEMALE,
      selfRating: 4.5,
      preferredHand: PreferredHand.RIGHT,
      phoneNumber: '0933445566',
      address: '202 Vo Thi Sau, District 3, Ho Chi Minh City',
      city: 'Hồ Chí Minh',
      district: 'Quận 3',
      latitude: 10.7852,
      longitude: 106.6872,
    },
    {
      id: SOCIAL_PARTICIPANT_01_ID,
      fullName: 'Social Participant 01',
      avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
      bio: 'Social flow participant, loves community sessions.',
      gender: Gender.FEMALE,
      selfRating: 3.0,
      preferredHand: PreferredHand.RIGHT,
      phoneNumber: '0944556677',
      address: '303 Nguyen Thi Minh Khai, District 1, Ho Chi Minh City',
      city: 'Hồ Chí Minh',
      district: 'Quận 1',
      latitude: 10.7712,
      longitude: 106.6908,
    },
    {
      id: SOCIAL_PARTICIPANT_02_ID,
      fullName: 'Social Participant 02',
      avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&q=80&w=200',
      bio: 'Avid sports enthusiast and regular event attendee.',
      gender: Gender.MALE,
      selfRating: 3.5,
      preferredHand: PreferredHand.AMBIDEXTROUS,
      phoneNumber: '0955667788',
      address: '404 CMT8, District 10, Ho Chi Minh City',
      city: 'Hồ Chí Minh',
      district: 'Quận 10',
      latitude: 10.7836,
      longitude: 106.6715,
    },
    {
      id: SOCIAL_PARTICIPANT_03_ID,
      fullName: 'Social Participant 03',
      avatarUrl: 'https://images.unsplash.com/photo-1554151228-14d9def656e4?auto=format&fit=crop&q=80&w=200',
      bio: 'Always down for recreational matches and fun socials.',
      gender: Gender.FEMALE,
      selfRating: 2.8,
      preferredHand: PreferredHand.RIGHT,
      phoneNumber: '0966778899',
      address: '505 Pham Van Dong, Thu Duc City, Ho Chi Minh City',
      city: 'Hồ Chí Minh',
      district: 'Thủ Đức',
      latitude: 10.8256,
      longitude: 106.6976,
    },
    {
      id: SOCIAL_PARTICIPANT_04_ID,
      fullName: 'Social Participant 04',
      avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
      bio: 'New participant 04 for matchmaking testing.',
      gender: Gender.MALE,
      selfRating: 3.5,
      preferredHand: PreferredHand.RIGHT,
      phoneNumber: '0944556611',
      address: 'Participant 04 Address',
      city: null,
      district: null,
      latitude: null,
      longitude: null,
    },
    {
      id: SOCIAL_PARTICIPANT_05_ID,
      fullName: 'Social Participant 05',
      avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&q=80&w=200',
      bio: 'New participant 05 for matchmaking testing.',
      gender: Gender.FEMALE,
      selfRating: 3.0,
      preferredHand: PreferredHand.LEFT,
      phoneNumber: '0955667711',
      address: 'Participant 05 Address',
      city: null,
      district: null,
      latitude: null,
      longitude: null,
    },
    {
      id: SOCIAL_PARTICIPANT_06_ID,
      fullName: 'Social Participant 06',
      avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
      bio: 'New participant 06 for matchmaking testing.',
      gender: Gender.MALE,
      selfRating: 3.0,
      preferredHand: PreferredHand.RIGHT,
      phoneNumber: '0944556622',
      address: 'Participant 06 Address',
      city: null,
      district: null,
      latitude: null,
      longitude: null,
    },
    {
      id: SOCIAL_PARTICIPANT_07_ID,
      fullName: 'Social Participant 07',
      avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&q=80&w=200',
      bio: 'New participant 07 for matchmaking testing.',
      gender: Gender.FEMALE,
      selfRating: 3.5,
      preferredHand: PreferredHand.LEFT,
      phoneNumber: '0955667722',
      address: 'Participant 07 Address',
      city: null,
      district: null,
      latitude: null,
      longitude: null,
    },
    {
      id: SOCIAL_PARTICIPANT_08_ID,
      fullName: 'Social Participant 08',
      avatarUrl: 'https://images.unsplash.com/photo-1554151228-14d9def656e4?auto=format&fit=crop&q=80&w=200',
      bio: 'New participant 08 for matchmaking testing.',
      gender: Gender.MALE,
      selfRating: 4.0,
      preferredHand: PreferredHand.AMBIDEXTROUS,
      phoneNumber: '0966778822',
      address: 'Participant 08 Address',
      city: null,
      district: null,
      latitude: null,
      longitude: null,
    },
    {
      id: PLAYER_1_ID,
      fullName: SEED_PICKLEHUB_PLAYER_NAMES[1],
      avatarUrl: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&q=80&w=200',
      bio: 'Ready to smash some balls!',
      gender: Gender.MALE,
      selfRating: 3.5,
      preferredHand: PreferredHand.RIGHT,
      phoneNumber: '0977889900',
      address: '111 Le Van Sy, District 3, Ho Chi Minh City',
      city: 'Hồ Chí Minh',
      district: 'Quận 3',
      latitude: 10.7903,
      longitude: 106.6789,
    },
    {
      id: PLAYER_2_ID,
      fullName: SEED_PICKLEHUB_PLAYER_NAMES[2],
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
      bio: 'Looking for a good challenge.',
      gender: Gender.FEMALE,
      selfRating: 4.0,
      preferredHand: PreferredHand.LEFT,
      phoneNumber: '0988990011',
      address: '222 Cach Mang Thang 8, District 10, Ho Chi Minh City',
      city: 'Hồ Chí Minh',
      district: 'Quận 10',
      latitude: 10.7788,
      longitude: 106.6745,
    },
    {
      id: PLAYER_3_ID,
      fullName: SEED_PICKLEHUB_PLAYER_NAMES[3],
      avatarUrl: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&q=80&w=200',
      bio: 'Just here for fun!',
      gender: Gender.MALE,
      selfRating: 2.5,
      preferredHand: PreferredHand.AMBIDEXTROUS,
      phoneNumber: '0999001122',
      address: '333 Nguyen Trai, District 5, Ho Chi Minh City',
      city: 'Hồ Chí Minh',
      district: 'Quận 5',
      latitude: 10.7584,
      longitude: 106.6700,
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        gender: user.gender,
        selfRating: user.selfRating,
        preferredHand: user.preferredHand,
        phoneNumber: user.phoneNumber,
        address: user.address,
        city: user.city ?? null,
        district: user.district ?? null,
        latitude: user.latitude ?? null,
        longitude: user.longitude ?? null,
      },
      create: {
        id: user.id,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        gender: user.gender,
        selfRating: user.selfRating,
        preferredHand: user.preferredHand,
        phoneNumber: user.phoneNumber,
        address: user.address,
        city: user.city ?? null,
        district: user.district ?? null,
        latitude: user.latitude ?? null,
        longitude: user.longitude ?? null,
      },
    });
  }

  // Seed tournament player user accounts
  const TOURNAMENT_PLAYER_IDS = Array.from({ length: 32 }, (_, i) => {
    const hex = (i + 1).toString().padStart(7, '0');
    return `e${hex}-e000-4000-8000-000000000000`;
  });

  for (let i = 0; i < 32; i++) {
    const id = TOURNAMENT_PLAYER_IDS[i];
    const idxStr = (i + 1).toString().padStart(2, '0');
    const gender = i % 2 === 0 ? Gender.MALE : Gender.FEMALE;
    
    await prisma.user.upsert({
      where: { id },
      update: {
        fullName: SEED_TOURNAMENT_PLAYER_NAMES[i] ?? `Tournament Player ${idxStr}`,
        gender,
        selfRating: parseFloat((3.5 + i * 0.03).toFixed(2)),
      },
      create: {
        id,
        fullName: SEED_TOURNAMENT_PLAYER_NAMES[i] ?? `Tournament Player ${idxStr}`,
        gender,
        selfRating: parseFloat((3.5 + i * 0.03).toFixed(2)),
        preferredHand: PreferredHand.RIGHT,
        phoneNumber: `09000000${idxStr}`,
        address: `Address of Player ${idxStr}`,
      }
    });
  }

  // Seed 61 additional player profiles (indexes 4 to 64)
  const locations = [
    { city: 'Hồ Chí Minh', district: 'Quận 3', address: '111 Le Van Sy, District 3, Ho Chi Minh City', lat: 10.7903, lng: 106.6789 },
    { city: 'Hà Nội', district: 'Cầu Giấy', address: '15 Tran Thai Tong, Cau Giay District, Hanoi', lat: 21.0315, lng: 105.7877 },
    { city: 'Đà Nẵng', district: 'Hải Châu', address: '120 Nguyen Van Linh, Hai Chau District, Da Nang', lat: 16.0620, lng: 108.2155 },
    { city: 'Hồ Chí Minh', district: 'Quận 7', address: '25 Nguyen Van Linh, Tan Phong Ward, District 7, HCMC', lat: 10.7310, lng: 106.7020 },
    { city: 'Hà Nội', district: 'Đống Đa', address: '45 Thai Ha, Dong Da District, Hanoi', lat: 21.0125, lng: 105.8202 },
    { city: 'Bình Dương', district: 'Thủ Dầu Một', address: '89 Binh Duong Boulevard, Thu Dau Mot, Binh Duong', lat: 10.9702, lng: 106.6705 },
    { city: 'Hồ Chí Minh', district: 'Thành phố Thủ Đức', address: '200 Mai Chi Tho, Thu Duc City, Ho Chi Minh City', lat: 10.7811, lng: 106.7380 },
    { city: 'Cần Thơ', district: 'Ninh Kiều', address: '88 30/4 Street, Ninh Kieu District, Can Tho', lat: 10.0270, lng: 105.7750 },
    { city: 'Hồ Chí Minh', district: 'Quận 1', address: '15B Le Thanh Ton, Ben Nghe, District 1, HCMC', lat: 10.7798, lng: 106.7042 },
    { city: 'Hà Nội', district: 'Tây Hồ', address: '102 Xuan Dieu, Quang An, Tay Ho District, Hanoi', lat: 21.0665, lng: 105.8235 },
    { city: 'Hồ Chí Minh', district: 'Tân Bình', address: '22 Cong Hoa, Ward 4, Tan Binh District, HCMC', lat: 10.8016, lng: 106.6575 },
    { city: 'Đà Nẵng', district: 'Sơn Trà', address: '50 Vo Nguyen Giap, Phuoc My, Son Tra, Da Nang', lat: 16.0718, lng: 108.2450 },
    { city: 'Hải Phòng', district: 'Ngô Quyền', address: '12 Lach Tray, Ngo Quyen, Hai Phong', lat: 20.8580, lng: 106.6890 },
    { city: 'Khánh Hòa', district: 'Nha Trang', address: '78 Tran Phu, Loc Tho, Nha Trang, Khanh Hoa', lat: 12.2450, lng: 109.1950 },
    { city: 'Bà Rịa - Vũng Tàu', district: 'Vũng Tàu', address: '15 Thuy Van, Thang Tam Ward, Vung Tau', lat: 10.3460, lng: 107.0840 },
    { city: 'Đồng Nai', district: 'Biên Hòa', address: '50 Vo Thi Sau, Quyet Thang, Bien Hoa', lat: 10.9570, lng: 106.8430 },
    { city: 'Thừa Thiên Huế', district: 'Huế', address: '30 Le Loi, Phu Hoi, Hue', lat: 16.4637, lng: 107.5908 },
    { city: 'Bình Định', district: 'Quy Nhơn', address: '02 An Duong Vuong, Nguyen Van Cu, Quy Nhon', lat: 13.7766, lng: 109.2243 },
    { city: 'Lâm Đồng', district: 'Đà Lạt', address: '15 Tran Phu, Ward 3, Da Lat, Lam Dong', lat: 11.9404, lng: 108.4380 },
    { city: 'Đắk Lắk', district: 'Buôn Ma Thuột', address: '10 Le Duan, Tu An, Buon Ma Thuot', lat: 12.6860, lng: 108.0380 },
    { city: 'Bình Thuận', district: 'Phan Thiết', address: '20 Nguyen Tat Thanh, Binh Hung, Phan Thiet', lat: 10.9333, lng: 108.1000 },
    { city: 'Nghệ An', district: 'Vinh', address: '05 Quang Trung, Vinh City, Nghe An', lat: 18.6730, lng: 105.6813 },
    { city: 'Bắc Ninh', district: 'Bắc Ninh', address: '10 Ly Thai To, Ninh Xa, Bac Ninh City', lat: 21.1860, lng: 106.0760 },
    { city: 'An Giang', district: 'Long Xuyên', address: '55 Tran Hung Dao, My Binh, Long Xuyen', lat: 10.3750, lng: 105.4370 }
  ];

  const pickleballBios = [
    'Mới tập chơi, đang luyện bỏ nhỏ (dink) ở khu vực kitchen.',
    'Đam mê Pickleball! Đang tập third-shot drop mỗi ngày.',
    'Chuyên đánh đôi, thích nhịp độ nhanh và những cú volley trên lưới.',
    'Banger chuyển hệ sang đánh chiến thuật. Đang cày điểm DUPR.',
    'Trình độ giải phong trào, cần tìm partner đánh các giải 4.5+.',
    'Tay vọt trái cực xoáy. Vui vẻ, giao lưu mồ hôi là chính!'
  ];

  const duprRatings = [2.5, 3.0, 3.5, 4.0, 4.5, 5.0];
  const genders = [Gender.MALE, Gender.FEMALE, Gender.MALE, Gender.FEMALE, Gender.OTHER, Gender.FEMALE];
  const hands = [PreferredHand.RIGHT, PreferredHand.LEFT, PreferredHand.RIGHT, PreferredHand.RIGHT, PreferredHand.AMBIDEXTROUS, PreferredHand.RIGHT];

  for (let i = 4; i <= 64; i++) {
    const formattedIndex = String(i).padStart(12, '0');
    const userId = `e0000000-0000-4000-8000-${formattedIndex}`;

    const locIndex = (i - 4) % locations.length;
    const bioIndex = (i - 4) % pickleballBios.length;
    const statIndex = (i - 4) % 6;

    await prisma.user.upsert({
      where: { id: userId },
      update: {
        fullName: SEED_PICKLEHUB_PLAYER_NAMES[i] ?? `Picklehub Player ${i}`,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=Picklehub${i}`,
        bio: pickleballBios[bioIndex],
        gender: genders[statIndex],
        selfRating: duprRatings[statIndex],
        preferredHand: hands[statIndex],
        phoneNumber: `0900000${String(i).padStart(3, '0')}`,
        address: locations[locIndex].address,
        city: locations[locIndex].city,
        district: locations[locIndex].district,
        latitude: locations[locIndex].lat,
        longitude: locations[locIndex].lng,
      },
      create: {
        id: userId,
        fullName: SEED_PICKLEHUB_PLAYER_NAMES[i] ?? `Picklehub Player ${i}`,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=Picklehub${i}`,
        bio: pickleballBios[bioIndex],
        gender: genders[statIndex],
        selfRating: duprRatings[statIndex],
        preferredHand: hands[statIndex],
        phoneNumber: `0900000${String(i).padStart(3, '0')}`,
        address: locations[locIndex].address,
        city: locations[locIndex].city,
        district: locations[locIndex].district,
        latitude: locations[locIndex].lat,
        longitude: locations[locIndex].lng,
      },
    });
  }

  console.log('User profiles seed complete.');
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
