import {
  PrismaClient,
  SocialStatus,
  SocialFormat,
  SocialHostRole,
  SocialGenderPolicy,
  SocialAgeGroup,
  SocialParticipantStatus,
  PlaySessionStatus,
  PlaySessionParticipantStatus,
  SocialPaymentStatus,
  SocialTransactionType,
  ParticipantPaymentStatus
} from '@prisma/client';

const db = new PrismaClient();

// Helper to get a relative date while preserving the exact time of day
const getRelativeDate = (daysOffset: number, timeString: string) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysOffset);
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return new Date(yyyy + '-' + mm + '-' + dd + 'T' + timeString + 'Z');
};

const getRelativeDateString = (daysOffset: number, timeString: string) => {
  return getRelativeDate(daysOffset, timeString).toISOString();
};



const SOCIAL_HOST_ID = '11111111-1111-4111-8111-111111111111'; // Social Host: seed-user@picklehub.com, name: Picklehub Seed User
const SOCIAL_PARTICIPANT_01_ID = '6e14cbd8-220f-4ebc-9235-b9a1b8fc4f47'; // Social Participant 01: seed-participant-01@picklehub.com, name: Social Participant 01
const SOCIAL_PARTICIPANT_02_ID = 'a1b2c3d4-e5f6-4890-abcd-ef1234567890'; // Social Participant 02: seed-participant-02@picklehub.com, name: Social Participant 02
const SOCIAL_PARTICIPANT_03_ID = 'f31f0529-6c82-43a2-a785-bb3d77f8a34e';
const SOCIAL_PARTICIPANT_04_ID = 'b0123456-7890-abcd-ef01-234567890abc';
const SOCIAL_PARTICIPANT_05_ID = 'c0123456-7890-abcd-ef01-234567890abc'; // Social Participant 03: seed-participant-03@picklehub.com, name: Social Participant 03
const SOCIAL_PARTICIPANT_06_ID = 'd1111111-1111-4111-8111-111111111111';
const SOCIAL_PARTICIPANT_07_ID = 'd2222222-2222-4222-8222-222222222222';
const SOCIAL_PARTICIPANT_08_ID = 'd3333333-3333-4333-8333-333333333333';

const SOCIAL_ID = '3a0c173f-e79c-49a8-b67c-c4260db7ff89';
const SESSION_1_ID = '5e14cbd8-220f-4ebc-9235-b9a1b8fc4f47';
const SESSION_2_ID = 'b2c3d4e5-f6a7-4901-bcde-f12345678901';
const SESSION_3_ID = 'c3d4e5f6-a7b8-4012-adef-012345678902';
const SESSION_IN_PROGRESS_ID = '7e14cbd8-220f-4ebc-9235-b9a1b8fc4f49';
const BOOKING_1_UUID = 'b0040000-b004-4000-8000-000000010010';
const BOOKING_2_UUID = 'b0040000-b004-4000-8000-000000010011';
const BOOKING_3_UUID = 'b0040000-b004-4000-8000-000000010012';
const CENTER_ID = 'c0000000-c000-4000-8000-000000000001';
const CENTER_NAME = 'PickleHub Downtown';

async function main() {
  console.log('Upserting financial flow demo data (socials)...');

  const socialAId = '4a0c173f-e79c-49a8-b67c-c4260db7ff89';
  const socialBId = '5a0c173f-e79c-49a8-b67c-c4260db7ff89';
  const socialCancelledId = '6a0c173f-e79c-49a8-b67c-c4260db7ffa8';
  const socialLiveId = '7a0c173f-e79c-49a8-b67c-c4260db7ffa9';
  const socialMatchmakingDemoId = '8a0c173f-e79c-49a8-b67c-c4260db7ffa0';
  const socialCompletedId = '9a0c173f-e79c-49a8-b67c-c4260db7ffa7';

  const socials = [
    {
      id: SOCIAL_ID,
      title: 'Morning Pickleball Gathering',
      note: 'Friendly mixed-level morning games. Scan QR bank transfer and submit screenshot receipt.',
      format: SocialFormat.SOCIAL,
      status: SocialStatus.PUBLISHED,
      isFree: false,
      autoApproveJoinRequests: true,
      hostRole: SocialHostRole.HOST_AND_PLAY,
      genderPolicy: SocialGenderPolicy.ANY,
      ageGroup: SocialAgeGroup.ANY,
      joinedCount: 6, // Host + 5 Participants
      packageFee: 300000,        // 300,000 VND full package fee
      totalBookingCost: 1050000,  // Session 1: 300k + Session 2: 300k + Session 3: 450k
      totalExpense: 1170000,      // totalBookingCost (1,050k) + ball expense (120k)
      paymentBankName: 'Vietcombank',
      paymentAccountName: 'NGUYEN VAN A',
      paymentAccountNumber: '123456789',
      paymentQrUrl: 'https://img.vietqr.io/image/970436-123456789-print.png',
      paymentNote: 'Chuyen khoan ghi ro ho ten + PH-1234',
      creatorId: SOCIAL_HOST_ID,
      startTime: getRelativeDate(10, '00:00:00.000'), // 07:00 VN (UTC+7)
      endTime: getRelativeDate(17, '02:00:00.000'),   // 09:00 VN ngày 27/06 – Session 3 (UTC+7)
    },
    {
      id: socialAId,
      title: 'Evening Pickleball Advanced',
      note: 'High intensity matches. Please scan VietQR to pay package fee before joining.',
      format: SocialFormat.SOCIAL,
      status: SocialStatus.PUBLISHED,
      isFree: false,
      autoApproveJoinRequests: true,
      hostRole: SocialHostRole.HOST_AND_PLAY,
      genderPolicy: SocialGenderPolicy.ANY,
      ageGroup: SocialAgeGroup.ANY,
      joinedCount: 4, // Host + 3 participants
      packageFee: 250000,
      totalBookingCost: 900000, // 3 sessions * 300k
      totalExpense: 900000,
      paymentBankName: 'Techcombank',
      paymentAccountName: 'PICKLEHUB SEED USER',
      paymentAccountNumber: '0901112222',
      paymentQrUrl: 'https://img.vietqr.io/image/970407-0901112222-print.png',
      paymentNote: 'Chuyen khoan ho ten + ADV-SOCIAL',
      creatorId: SOCIAL_HOST_ID,
      startTime: getRelativeDate(21, '01:00:00.000'), // 08:00 VN
      endTime: getRelativeDate(23, '03:00:00.000'), // 10:00 VN
    },
    {
      id: socialBId,
      title: 'Weekend Free Pickleball Social',
      note: 'All play sessions are completely free of charge. Just bring your paddle!',
      format: SocialFormat.SOCIAL,
      status: SocialStatus.PUBLISHED,
      isFree: true,
      autoApproveJoinRequests: true,
      hostRole: SocialHostRole.HOST_AND_PLAY,
      genderPolicy: SocialGenderPolicy.ANY,
      ageGroup: SocialAgeGroup.ANY,
      joinedCount: 4, // Host + 3 participants
      packageFee: 0,
      totalBookingCost: 900000, // 3 sessions * 300k
      totalExpense: 900000,
      creatorId: SOCIAL_HOST_ID,
      startTime: getRelativeDate(28, '01:00:00.000'), // 08:00 VN
      endTime: getRelativeDate(30, '03:00:00.000'), // 10:00 VN
    },
    {
      id: socialCancelledId,
      title: 'Cancelled Pickleball Social',
      note: 'This social has been cancelled.',
      format: SocialFormat.SOCIAL,
      status: SocialStatus.CANCELLED,
      isFree: true,
      autoApproveJoinRequests: true,
      hostRole: SocialHostRole.HOST_AND_PLAY,
      genderPolicy: SocialGenderPolicy.ANY,
      ageGroup: SocialAgeGroup.ANY,
      joinedCount: 1,
      packageFee: 0,
      totalBookingCost: 0,
      totalExpense: 0,
      creatorId: SOCIAL_HOST_ID,
      startTime: getRelativeDate(5, '00:00:00.000'),
      endTime: getRelativeDate(5, '02:00:00.000'),
    },
    {
      id: socialLiveId,
      title: 'Live Pickleball Social',
      note: 'This social session is currently live!',
      format: SocialFormat.SOCIAL,
      status: SocialStatus.PUBLISHED,
      isFree: true,
      autoApproveJoinRequests: true,
      hostRole: SocialHostRole.HOST_AND_PLAY,
      genderPolicy: SocialGenderPolicy.ANY,
      ageGroup: SocialAgeGroup.ANY,
      joinedCount: 1,
      packageFee: 0,
      totalBookingCost: 0,
      totalExpense: 0,
      creatorId: SOCIAL_HOST_ID,
      startTime: new Date(Date.now() - 30 * 60 * 1000), // 30 mins ago
      endTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours later
    },
    {
      id: socialMatchmakingDemoId,
      title: 'Matchmaking Demo Social',
      note: 'A demo social with 5 sessions and 8 participants to showcase matchmaking.',
      format: SocialFormat.SOCIAL,
      status: SocialStatus.PUBLISHED,
      isFree: true,
      autoApproveJoinRequests: true,
      hostRole: SocialHostRole.HOST_AND_PLAY,
      genderPolicy: SocialGenderPolicy.ANY,
      ageGroup: SocialAgeGroup.ANY,
      joinedCount: 9, // Host + 8 Participants
      packageFee: 0,
      totalBookingCost: 1500000,
      totalExpense: 1500000,
      creatorId: SOCIAL_HOST_ID,
      startTime: getRelativeDate(35, '00:00:00.000'),
      endTime: getRelativeDate(35, '10:00:00.000'),
    },
    {
      id: socialCompletedId,
      title: 'Completed Pickleball Social',
      note: 'Friendly mixed-level morning games that are completed.',
      format: SocialFormat.SOCIAL,
      status: SocialStatus.COMPLETED,
      isFree: true,
      autoApproveJoinRequests: true,
      hostRole: SocialHostRole.HOST_AND_PLAY,
      genderPolicy: SocialGenderPolicy.ANY,
      ageGroup: SocialAgeGroup.ANY,
      joinedCount: 4, // Host + 3 Participants
      packageFee: 0,
      totalBookingCost: 300000,
      totalExpense: 300000,
      creatorId: SOCIAL_HOST_ID,
      startTime: getRelativeDate(-5, '00:00:00.000'),
      endTime: getRelativeDate(-5, '02:00:00.000'),
    }
  ];

  for (const s of socials) {
    await db.social.upsert({
      where: { id: s.id },
      update: s,
      create: s,
    });
  }

  console.log('Upserting play sessions...');

  const sessionA1Id = '5e14cbd8-220f-4ebc-9235-b9a1b8fc4f48';
  const sessionA2Id = 'b2c3d4e5-f6a7-4901-bcde-f12345678902';
  const sessionA3Id = 'c3d4e5f6-a7b8-4012-adef-012345678903';

  const sessionB1Id = '5e14cbd8-220f-4ebc-9235-b9a1b8fc4f51';
  const sessionB2Id = 'b2c3d4e5-f6a7-4901-bcde-f12345678905';
  const sessionB3Id = 'c3d4e5f6-a7b8-4012-adef-012345678906';

  const sessionM1Id = 'e1111111-1111-4111-8111-111111111111';
  const sessionM2Id = 'e2222222-2222-4222-8222-222222222222';
  const sessionM3Id = 'e3333333-3333-4333-8333-333333333333';
  const sessionM4Id = 'e4444444-4444-4444-8444-444444444444';
  const sessionM5Id = 'e5555555-5555-4555-8555-555555555555';

  const playSessions = [
    {
      id: SESSION_IN_PROGRESS_ID,
      socialId: SOCIAL_ID,
      title: 'Phiên chơi đang diễn ra',
      bookingIds: ['b0040000-b004-4000-8000-000000010099'],
      numberOfCourts: 2,
      courtNames: 'Sân 1, Sân 2',
      courtSchedule: [
        { startTime: getRelativeDateString(7, '00:00:00.000'), endTime: getRelativeDateString(7, '02:00:00.000'), activeCourts: 2, courtNames: 'Sân 1, Sân 2' } as any,
      ],
      location: `${CENTER_NAME}, Quận 7`,
      centerId: CENTER_ID,
      centerName: CENTER_NAME,
      sessionFee: 150000,
      startTime: getRelativeDate(7, '00:00:00.000'),
      endTime: getRelativeDate(7, '02:00:00.000'),
      status: PlaySessionStatus.IN_PROGRESS,
      creatorId: SOCIAL_HOST_ID,
      joinedCount: 6,
    },
    {
      id: SESSION_1_ID,
      socialId: SOCIAL_ID,
      title: 'Phiên chơi sáng Thứ Bảy',
      bookingIds: [BOOKING_1_UUID],
      numberOfCourts: 2,
      courtNames: 'Sân 1, Sân 2',
      courtSchedule: [
        { startTime: getRelativeDateString(10, '00:00:00.000'), endTime: getRelativeDateString(10, '02:00:00.000'), activeCourts: 2, courtNames: 'Sân 1, Sân 2' } as any,
      ],
      location: `${CENTER_NAME}, Quận 7`,
      centerId: CENTER_ID,
      centerName: CENTER_NAME,
      sessionFee: 150000,
      startTime: getRelativeDate(10, '00:00:00.000'), // 07:00 VN (UTC+7)
      endTime: getRelativeDate(10, '02:00:00.000'),   // 09:00 VN (UTC+7)
      status: PlaySessionStatus.ACTIVE,
      creatorId: SOCIAL_HOST_ID,
      joinedCount: 3, // Host, Participant 01, Participant 02
    },
    {
      id: SESSION_2_ID,
      socialId: SOCIAL_ID,
      title: 'Phiên chơi sáng Chủ Nhật',
      bookingIds: [BOOKING_2_UUID],
      numberOfCourts: 2,
      courtNames: 'Sân 1, Sân 2',
      courtSchedule: [
        { startTime: getRelativeDateString(11, '00:00:00.000'), endTime: getRelativeDateString(11, '02:00:00.000'), activeCourts: 2, courtNames: 'Sân 1, Sân 2' } as any,
      ],
      location: `${CENTER_NAME}, Quận 7`,
      centerId: CENTER_ID,
      centerName: CENTER_NAME,
      sessionFee: 150000,
      startTime: getRelativeDate(11, '00:00:00.000'), // 07:00 VN (UTC+7)
      endTime: getRelativeDate(11, '02:00:00.000'),   // 09:00 VN (UTC+7)
      status: PlaySessionStatus.ACTIVE,
      creatorId: SOCIAL_HOST_ID,
      joinedCount: 3, // Host, Participant 01, Participant 03
    },
    {
      id: SESSION_3_ID,
      socialId: SOCIAL_ID,
      title: 'Phiên chơi sáng Thứ Bảy tuần sau',
      bookingIds: [BOOKING_3_UUID],
      numberOfCourts: 3,
      courtNames: 'Sân 1, Sân 2, Sân 3',
      courtSchedule: [
        { startTime: getRelativeDateString(17, '00:00:00.000'), endTime: getRelativeDateString(17, '02:00:00.000'), activeCourts: 3, courtNames: 'Sân 1, Sân 2, Sân 3' } as any,
      ],
      location: `${CENTER_NAME}, Quận 7`,
      centerId: CENTER_ID,
      centerName: CENTER_NAME,
      sessionFee: 150000,
      startTime: getRelativeDate(17, '00:00:00.000'), // 07:00 VN (UTC+7)
      endTime: getRelativeDate(17, '02:00:00.000'),   // 09:00 VN (UTC+7)
      status: PlaySessionStatus.ACTIVE,
      creatorId: SOCIAL_HOST_ID,
      joinedCount: 1, // Host only
    },
    {
      id: sessionA1Id,
      socialId: socialAId,
      title: 'Advanced Session 1',
      bookingIds: ['b0040000-b004-4000-8000-000000010016'],
      numberOfCourts: 2,
      courtNames: 'Court A, Court B',
      courtSchedule: [
        { startTime: getRelativeDateString(21, '01:00:00.000'), endTime: getRelativeDateString(21, '03:00:00.000'), activeCourts: 2, courtNames: 'Court A, Court B' } as any,
      ],
      location: `${CENTER_NAME}, Quận 7`,
      centerId: CENTER_ID,
      centerName: CENTER_NAME,
      sessionFee: 100000,
      startTime: getRelativeDate(21, '01:00:00.000'),
      endTime: getRelativeDate(21, '03:00:00.000'),
      status: PlaySessionStatus.ACTIVE,
      creatorId: SOCIAL_HOST_ID,
      joinedCount: 4,
    },
    {
      id: sessionA2Id,
      socialId: socialAId,
      title: 'Advanced Session 2',
      bookingIds: ['b0040000-b004-4000-8000-000000010017'],
      numberOfCourts: 2,
      courtNames: 'Court A, Court B',
      courtSchedule: [
        { startTime: getRelativeDateString(22, '01:00:00.000'), endTime: getRelativeDateString(22, '03:00:00.000'), activeCourts: 2, courtNames: 'Court A, Court B' } as any,
      ],
      location: `${CENTER_NAME}, Quận 7`,
      centerId: CENTER_ID,
      centerName: CENTER_NAME,
      sessionFee: 100000,
      startTime: getRelativeDate(22, '01:00:00.000'),
      endTime: getRelativeDate(22, '03:00:00.000'),
      status: PlaySessionStatus.ACTIVE,
      creatorId: SOCIAL_HOST_ID,
      joinedCount: 4,
    },
    {
      id: sessionA3Id,
      socialId: socialAId,
      title: 'Advanced Session 3',
      bookingIds: ['b0040000-b004-4000-8000-000000010018'],
      numberOfCourts: 2,
      courtNames: 'Court A, Court B',
      courtSchedule: [
        { startTime: getRelativeDateString(23, '01:00:00.000'), endTime: getRelativeDateString(23, '03:00:00.000'), activeCourts: 2, courtNames: 'Court A, Court B' } as any,
      ],
      location: `${CENTER_NAME}, Quận 7`,
      centerId: CENTER_ID,
      centerName: CENTER_NAME,
      sessionFee: 100000,
      startTime: getRelativeDate(23, '01:00:00.000'),
      endTime: getRelativeDate(23, '03:00:00.000'),
      status: PlaySessionStatus.ACTIVE,
      creatorId: SOCIAL_HOST_ID,
      joinedCount: 4,
    },
    {
      id: sessionB1Id,
      socialId: socialBId,
      title: 'Free Session 1',
      bookingIds: ['b0040000-b004-4000-8000-000000010019'],
      numberOfCourts: 2,
      courtNames: 'Court A, Court B',
      courtSchedule: [
        { startTime: getRelativeDateString(28, '01:00:00.000'), endTime: getRelativeDateString(28, '03:00:00.000'), activeCourts: 2, courtNames: 'Court A, Court B' } as any,
      ],
      location: `${CENTER_NAME}, Quận 7`,
      centerId: CENTER_ID,
      centerName: CENTER_NAME,
      sessionFee: 0,
      startTime: getRelativeDate(28, '01:00:00.000'),
      endTime: getRelativeDate(28, '03:00:00.000'),
      status: PlaySessionStatus.ACTIVE,
      creatorId: SOCIAL_HOST_ID,
      joinedCount: 4,
    },
    {
      id: sessionB2Id,
      socialId: socialBId,
      title: 'Free Session 2',
      bookingIds: ['b0040000-b004-4000-8000-000000010020'],
      numberOfCourts: 2,
      courtNames: 'Court A, Court B',
      courtSchedule: [
        { startTime: getRelativeDateString(29, '01:00:00.000'), endTime: getRelativeDateString(29, '03:00:00.000'), activeCourts: 2, courtNames: 'Court A, Court B' } as any,
      ],
      location: `${CENTER_NAME}, Quận 7`,
      centerId: CENTER_ID,
      centerName: CENTER_NAME,
      sessionFee: 0,
      startTime: getRelativeDate(29, '01:00:00.000'),
      endTime: getRelativeDate(29, '03:00:00.000'),
      status: PlaySessionStatus.ACTIVE,
      creatorId: SOCIAL_HOST_ID,
      joinedCount: 4,
    },
    {
      id: sessionB3Id,
      socialId: socialBId,
      title: 'Free Session 3',
      bookingIds: ['b0040000-b004-4000-8000-000000010021'],
      numberOfCourts: 2,
      courtNames: 'Court A, Court B',
      courtSchedule: [
        { startTime: getRelativeDateString(30, '01:00:00.000'), endTime: getRelativeDateString(30, '03:00:00.000'), activeCourts: 2, courtNames: 'Court A, Court B' } as any,
      ],
      location: `${CENTER_NAME}, Quận 7`,
      centerId: CENTER_ID,
      centerName: CENTER_NAME,
      sessionFee: 0,
      startTime: getRelativeDate(30, '01:00:00.000'),
      endTime: getRelativeDate(30, '03:00:00.000'),
      status: PlaySessionStatus.ACTIVE,
      creatorId: SOCIAL_HOST_ID,
      joinedCount: 4,
    },
    {
      id: sessionM1Id,
      socialId: socialMatchmakingDemoId,
      title: 'Matchmaking Session 1',
      bookingIds: ['b0040000-b004-4000-8000-000000010031'],
      numberOfCourts: 4,
      courtNames: 'Court A, Court B, Court C, Court D',
      courtSchedule: [
        { startTime: getRelativeDateString(35, '00:00:00.000'), endTime: getRelativeDateString(35, '02:00:00.000'), activeCourts: 4, courtNames: 'Court A, Court B, Court C, Court D' } as any,
      ],
      location: `${CENTER_NAME}, Quận 7`,
      centerId: CENTER_ID,
      centerName: CENTER_NAME,
      sessionFee: 0,
      startTime: getRelativeDate(35, '00:00:00.000'),
      endTime: getRelativeDate(35, '02:00:00.000'),
      status: PlaySessionStatus.ACTIVE,
      creatorId: SOCIAL_HOST_ID,
      joinedCount: 9,
    },
    {
      id: sessionM2Id,
      socialId: socialMatchmakingDemoId,
      title: 'Matchmaking Session 2',
      bookingIds: ['b0040000-b004-4000-8000-000000010032'],
      numberOfCourts: 4,
      courtNames: 'Court A, Court B, Court C, Court D',
      courtSchedule: [
        { startTime: getRelativeDateString(35, '02:00:00.000'), endTime: getRelativeDateString(35, '04:00:00.000'), activeCourts: 4, courtNames: 'Court A, Court B, Court C, Court D' } as any,
      ],
      location: `${CENTER_NAME}, Quận 7`,
      centerId: CENTER_ID,
      centerName: CENTER_NAME,
      sessionFee: 0,
      startTime: getRelativeDate(35, '02:00:00.000'),
      endTime: getRelativeDate(35, '04:00:00.000'),
      status: PlaySessionStatus.ACTIVE,
      creatorId: SOCIAL_HOST_ID,
      joinedCount: 9,
    },
    {
      id: sessionM3Id,
      socialId: socialMatchmakingDemoId,
      title: 'Matchmaking Session 3',
      bookingIds: ['b0040000-b004-4000-8000-000000010033'],
      numberOfCourts: 4,
      courtNames: 'Court A, Court B, Court C, Court D',
      courtSchedule: [
        { startTime: getRelativeDateString(35, '04:00:00.000'), endTime: getRelativeDateString(35, '06:00:00.000'), activeCourts: 4, courtNames: 'Court A, Court B, Court C, Court D' } as any,
      ],
      location: `${CENTER_NAME}, Quận 7`,
      centerId: CENTER_ID,
      centerName: CENTER_NAME,
      sessionFee: 0,
      startTime: getRelativeDate(35, '04:00:00.000'),
      endTime: getRelativeDate(35, '06:00:00.000'),
      status: PlaySessionStatus.ACTIVE,
      creatorId: SOCIAL_HOST_ID,
      joinedCount: 9,
    },
    {
      id: sessionM4Id,
      socialId: socialMatchmakingDemoId,
      title: 'Matchmaking Session 4',
      bookingIds: ['b0040000-b004-4000-8000-000000010034'],
      numberOfCourts: 4,
      courtNames: 'Court A, Court B, Court C, Court D',
      courtSchedule: [
        { startTime: getRelativeDateString(35, '06:00:00.000'), endTime: getRelativeDateString(35, '08:00:00.000'), activeCourts: 4, courtNames: 'Court A, Court B, Court C, Court D' } as any,
      ],
      location: `${CENTER_NAME}, Quận 7`,
      centerId: CENTER_ID,
      centerName: CENTER_NAME,
      sessionFee: 0,
      startTime: getRelativeDate(35, '06:00:00.000'),
      endTime: getRelativeDate(35, '08:00:00.000'),
      status: PlaySessionStatus.ACTIVE,
      creatorId: SOCIAL_HOST_ID,
      joinedCount: 9,
    },
    {
      id: sessionM5Id,
      socialId: socialMatchmakingDemoId,
      title: 'Matchmaking Session 5',
      bookingIds: ['b0040000-b004-4000-8000-000000010035'],
      numberOfCourts: 4,
      courtNames: 'Court A, Court B, Court C, Court D',
      courtSchedule: [
        { startTime: getRelativeDateString(35, '08:00:00.000'), endTime: getRelativeDateString(35, '10:00:00.000'), activeCourts: 4, courtNames: 'Court A, Court B, Court C, Court D' } as any,
      ],
      location: `${CENTER_NAME}, Quận 7`,
      centerId: CENTER_ID,
      centerName: CENTER_NAME,
      sessionFee: 0,
      startTime: getRelativeDate(35, '08:00:00.000'),
      endTime: getRelativeDate(35, '10:00:00.000'),
      status: PlaySessionStatus.ACTIVE,
      creatorId: SOCIAL_HOST_ID,
      joinedCount: 9,
    },
    {
      id: 'f14cbe8d-220f-4ebc-9235-b9a1b8fc4f47',
      socialId: socialCompletedId,
      title: 'Completed Session',
      bookingIds: ['b0040000-b004-4000-8000-000000010098'],
      numberOfCourts: 2,
      courtNames: 'Sân 1, Sân 2',
      courtSchedule: [
        { startTime: getRelativeDateString(-5, '00:00:00.000'), endTime: getRelativeDateString(-5, '02:00:00.000'), activeCourts: 2, courtNames: 'Sân 1, Sân 2' } as any,
      ],
      location: `${CENTER_NAME}, Quận 7`,
      centerId: CENTER_ID,
      centerName: CENTER_NAME,
      sessionFee: 0,
      startTime: getRelativeDate(-5, '00:00:00.000'),
      endTime: getRelativeDate(-5, '02:00:00.000'),
      status: PlaySessionStatus.COMPLETED,
      creatorId: SOCIAL_HOST_ID,
      joinedCount: 4,
    }
  ];

  for (const ps of playSessions) {
    await db.playSession.upsert({
      where: { id: ps.id },
      update: ps,
      create: ps,
    });
  }

  console.log('Upserting social participants...');

  const socialParticipants = [
    {
      id: '6a0c173f-e79c-49a8-b67c-c4260db7ffb1',
      socialId: socialCancelledId,
      userId: SOCIAL_HOST_ID,
      status: SocialParticipantStatus.CONFIRMED,
      totalFee: 0,
      amountPaid: 0,
      amountRefunded: 0,
      isFullPackage: true,
      paymentStatus: ParticipantPaymentStatus.PAID,
      isHost: true,
    },
    {
      id: '7a0c173f-e79c-49a8-b67c-c4260db7ffb2',
      socialId: socialLiveId,
      userId: SOCIAL_HOST_ID,
      status: SocialParticipantStatus.CONFIRMED,
      totalFee: 0,
      amountPaid: 0,
      amountRefunded: 0,
      isFullPackage: true,
      paymentStatus: ParticipantPaymentStatus.PAID,
      isHost: true,
    },
    // Social 1 Participants
    {
      id: '9a0c173f-e79c-49a8-b67c-c4260db7ff89',
      socialId: SOCIAL_ID,
      userId: SOCIAL_HOST_ID,
      status: SocialParticipantStatus.CONFIRMED,
      totalFee: 0,
      amountPaid: 0,
      amountRefunded: 0,
      isFullPackage: true,
      paymentStatus: ParticipantPaymentStatus.PAID,
      isHost: true,
    },
    {
      id: '8a0c173f-e79c-49a8-b67c-c4260db7ff89',
      socialId: SOCIAL_ID,
      userId: SOCIAL_PARTICIPANT_01_ID,
      status: SocialParticipantStatus.CONFIRMED,
      totalFee: 300000,
      amountPaid: 300000,
      amountRefunded: 0,
      isFullPackage: true,
      paymentStatus: ParticipantPaymentStatus.PAID,
      isHost: false,
    },
    {
      id: '7a0c173f-e79c-49a8-b67c-c4260db7ff89',
      socialId: SOCIAL_ID,
      userId: SOCIAL_PARTICIPANT_02_ID,
      status: SocialParticipantStatus.CONFIRMED,
      totalFee: 150000,
      amountPaid: 0,
      amountRefunded: 0,
      isFullPackage: false,
      paymentStatus: ParticipantPaymentStatus.UNPAID,
      isHost: false,
    },
    {
      id: '6a0c173f-e79c-49a8-b67c-c4260db7ff89',
      socialId: SOCIAL_ID,
      userId: SOCIAL_PARTICIPANT_03_ID,
      status: SocialParticipantStatus.CONFIRMED,
      totalFee: 150000,
      amountPaid: 300000,
      amountRefunded: 0,
      isFullPackage: false,
      paymentStatus: ParticipantPaymentStatus.OVERPAID,
      isHost: false,
    },

    // Social A Participants
    {
      id: '4a0c173f-e79c-49a8-b67c-c4260db7ffa1',
      socialId: socialAId,
      userId: SOCIAL_HOST_ID,
      status: SocialParticipantStatus.CONFIRMED,
      totalFee: 0,
      amountPaid: 0,
      amountRefunded: 0,
      isFullPackage: true,
      paymentStatus: ParticipantPaymentStatus.PAID,
      isHost: true,
    },
    {
      id: '4a0c173f-e79c-49a8-b67c-c4260db7ffa2',
      socialId: socialAId,
      userId: SOCIAL_PARTICIPANT_01_ID,
      status: SocialParticipantStatus.CONFIRMED,
      totalFee: 250000,
      amountPaid: 250000,
      amountRefunded: 0,
      isFullPackage: true,
      paymentStatus: ParticipantPaymentStatus.PAID,
      isHost: false,
    },
    {
      id: '4a0c173f-e79c-49a8-b67c-c4260db7ffa3',
      socialId: socialAId,
      userId: SOCIAL_PARTICIPANT_02_ID,
      status: SocialParticipantStatus.CONFIRMED,
      totalFee: 250000,
      amountPaid: 250000,
      amountRefunded: 0,
      isFullPackage: true,
      paymentStatus: ParticipantPaymentStatus.PAID,
      isHost: false,
    },
    {
      id: '4a0c173f-e79c-49a8-b67c-c4260db7ffa4',
      socialId: socialAId,
      userId: SOCIAL_PARTICIPANT_03_ID,
      status: SocialParticipantStatus.CONFIRMED,
      totalFee: 100000, // Per session (Session 1 only)
      amountPaid: 100000,
      amountRefunded: 0,
      isFullPackage: false,
      paymentStatus: ParticipantPaymentStatus.PAID,
      isHost: false,
    },

    // Social B Participants
    {
      id: '5a0c173f-e79c-49a8-b67c-c4260db7ffa1',
      socialId: socialBId,
      userId: SOCIAL_HOST_ID,
      status: SocialParticipantStatus.CONFIRMED,
      totalFee: 0,
      amountPaid: 0,
      amountRefunded: 0,
      isFullPackage: true,
      paymentStatus: ParticipantPaymentStatus.PAID,
      isHost: true,
    },
    {
      id: '5a0c173f-e79c-49a8-b67c-c4260db7ffa2',
      socialId: socialBId,
      userId: SOCIAL_PARTICIPANT_01_ID,
      status: SocialParticipantStatus.CONFIRMED,
      totalFee: 0,
      amountPaid: 0,
      amountRefunded: 0,
      isFullPackage: true,
      paymentStatus: ParticipantPaymentStatus.PAID,
      isHost: false,
    },
    {
      id: '5a0c173f-e79c-49a8-b67c-c4260db7ffa3',
      socialId: socialBId,
      userId: SOCIAL_PARTICIPANT_02_ID,
      status: SocialParticipantStatus.CONFIRMED,
      totalFee: 0,
      amountPaid: 0,
      amountRefunded: 0,
      isFullPackage: true,
      paymentStatus: ParticipantPaymentStatus.PAID,
      isHost: false,
    },
    {
      id: '5a0c173f-e79c-49a8-b67c-c4260db7ffa4',
      socialId: socialBId,
      userId: SOCIAL_PARTICIPANT_03_ID,
      status: SocialParticipantStatus.CONFIRMED,
      totalFee: 0,
      amountPaid: 0,
      amountRefunded: 0,
      isFullPackage: true,
      paymentStatus: ParticipantPaymentStatus.PAID,
      isHost: false,
    },
    // Matchmaking Demo Participants
    { id: '8a0c173f-e79c-49a8-b67c-c4260db7ffb0', socialId: socialMatchmakingDemoId, userId: SOCIAL_HOST_ID, status: SocialParticipantStatus.CONFIRMED, totalFee: 0, amountPaid: 0, amountRefunded: 0, isFullPackage: true, paymentStatus: ParticipantPaymentStatus.PAID, isHost: true },
    { id: '8a0c173f-e79c-49a8-b67c-c4260db7ffb1', socialId: socialMatchmakingDemoId, userId: SOCIAL_PARTICIPANT_01_ID, status: SocialParticipantStatus.CONFIRMED, totalFee: 0, amountPaid: 0, amountRefunded: 0, isFullPackage: true, paymentStatus: ParticipantPaymentStatus.PAID, isHost: false },
    { id: '8a0c173f-e79c-49a8-b67c-c4260db7ffb2', socialId: socialMatchmakingDemoId, userId: SOCIAL_PARTICIPANT_02_ID, status: SocialParticipantStatus.CONFIRMED, totalFee: 0, amountPaid: 0, amountRefunded: 0, isFullPackage: true, paymentStatus: ParticipantPaymentStatus.PAID, isHost: false },
    { id: '8a0c173f-e79c-49a8-b67c-c4260db7ffb3', socialId: socialMatchmakingDemoId, userId: SOCIAL_PARTICIPANT_03_ID, status: SocialParticipantStatus.CONFIRMED, totalFee: 0, amountPaid: 0, amountRefunded: 0, isFullPackage: true, paymentStatus: ParticipantPaymentStatus.PAID, isHost: false },
    { id: '8a0c173f-e79c-49a8-b67c-c4260db7ffb4', socialId: socialMatchmakingDemoId, userId: SOCIAL_PARTICIPANT_04_ID, status: SocialParticipantStatus.CONFIRMED, totalFee: 0, amountPaid: 0, amountRefunded: 0, isFullPackage: true, paymentStatus: ParticipantPaymentStatus.PAID, isHost: false },
    { id: '8a0c173f-e79c-49a8-b67c-c4260db7ffb5', socialId: socialMatchmakingDemoId, userId: SOCIAL_PARTICIPANT_05_ID, status: SocialParticipantStatus.CONFIRMED, totalFee: 0, amountPaid: 0, amountRefunded: 0, isFullPackage: true, paymentStatus: ParticipantPaymentStatus.PAID, isHost: false },
    { id: '8a0c173f-e79c-49a8-b67c-c4260db7ffb6', socialId: socialMatchmakingDemoId, userId: SOCIAL_PARTICIPANT_06_ID, status: SocialParticipantStatus.CONFIRMED, totalFee: 0, amountPaid: 0, amountRefunded: 0, isFullPackage: true, paymentStatus: ParticipantPaymentStatus.PAID, isHost: false },
    { id: '8a0c173f-e79c-49a8-b67c-c4260db7ffb7', socialId: socialMatchmakingDemoId, userId: SOCIAL_PARTICIPANT_07_ID, status: SocialParticipantStatus.CONFIRMED, totalFee: 0, amountPaid: 0, amountRefunded: 0, isFullPackage: true, paymentStatus: ParticipantPaymentStatus.PAID, isHost: false },
    { id: '8a0c173f-e79c-49a8-b67c-c4260db7ffb8', socialId: socialMatchmakingDemoId, userId: SOCIAL_PARTICIPANT_08_ID, status: SocialParticipantStatus.CONFIRMED, totalFee: 0, amountPaid: 0, amountRefunded: 0, isFullPackage: true, paymentStatus: ParticipantPaymentStatus.PAID, isHost: false },
    // Completed Social Participants
    {
      id: '9a0c173f-e79c-49a8-b67c-c4260db7ffa8',
      socialId: socialCompletedId,
      userId: SOCIAL_HOST_ID,
      status: SocialParticipantStatus.CONFIRMED,
      totalFee: 0,
      amountPaid: 0,
      amountRefunded: 0,
      isFullPackage: true,
      paymentStatus: ParticipantPaymentStatus.PAID,
      isHost: true,
    },
    {
      id: '9a0c173f-e79c-49a8-b67c-c4260db7ffa9',
      socialId: socialCompletedId,
      userId: SOCIAL_PARTICIPANT_01_ID,
      status: SocialParticipantStatus.CONFIRMED,
      totalFee: 0,
      amountPaid: 0,
      amountRefunded: 0,
      isFullPackage: true,
      paymentStatus: ParticipantPaymentStatus.PAID,
      isHost: false,
    },
    {
      id: '9a0c173f-e79c-49a8-b67c-c4260db7ffb9',
      socialId: socialCompletedId,
      userId: SOCIAL_PARTICIPANT_02_ID,
      status: SocialParticipantStatus.CONFIRMED,
      totalFee: 0,
      amountPaid: 0,
      amountRefunded: 0,
      isFullPackage: true,
      paymentStatus: ParticipantPaymentStatus.PAID,
      isHost: false,
    },
    {
      id: '9a0c173f-e79c-49a8-b67c-c4260db7ffba',
      socialId: socialCompletedId,
      userId: SOCIAL_PARTICIPANT_03_ID,
      status: SocialParticipantStatus.CONFIRMED,
      totalFee: 0,
      amountPaid: 0,
      amountRefunded: 0,
      isFullPackage: true,
      paymentStatus: ParticipantPaymentStatus.PAID,
      isHost: false,
    }
  ];

  for (const sp of socialParticipants) {
    await db.socialParticipant.upsert({
      where: { id: sp.id },
      update: sp,
      create: sp,
    });
  }

  console.log('Upserting play session attendance roster...');

  const playSessionParticipants = [
    // Social 1: In Progress Session
    { playSessionId: SESSION_IN_PROGRESS_ID, userId: SOCIAL_HOST_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: SESSION_IN_PROGRESS_ID, userId: SOCIAL_PARTICIPANT_01_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: SESSION_IN_PROGRESS_ID, userId: SOCIAL_PARTICIPANT_02_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: SESSION_IN_PROGRESS_ID, userId: SOCIAL_PARTICIPANT_03_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: SESSION_IN_PROGRESS_ID, userId: SOCIAL_PARTICIPANT_04_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: SESSION_IN_PROGRESS_ID, userId: SOCIAL_PARTICIPANT_05_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    // Social 1: Session 1
    { playSessionId: SESSION_1_ID, userId: SOCIAL_HOST_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: SESSION_1_ID, userId: SOCIAL_PARTICIPANT_01_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: SESSION_1_ID, userId: SOCIAL_PARTICIPANT_02_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    // Social 1: Session 2
    { playSessionId: SESSION_2_ID, userId: SOCIAL_HOST_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: SESSION_2_ID, userId: SOCIAL_PARTICIPANT_01_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: SESSION_2_ID, userId: SOCIAL_PARTICIPANT_03_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    // Social 1: Session 3
    { playSessionId: SESSION_3_ID, userId: SOCIAL_HOST_ID, status: PlaySessionParticipantStatus.CONFIRMED },

    // Social A: Session A1
    { playSessionId: sessionA1Id, userId: SOCIAL_HOST_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionA1Id, userId: SOCIAL_PARTICIPANT_01_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionA1Id, userId: SOCIAL_PARTICIPANT_02_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionA1Id, userId: SOCIAL_PARTICIPANT_03_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    // Social A: Session A2
    { playSessionId: sessionA2Id, userId: SOCIAL_HOST_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionA2Id, userId: SOCIAL_PARTICIPANT_01_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionA2Id, userId: SOCIAL_PARTICIPANT_02_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    // Social A: Session A3
    { playSessionId: sessionA3Id, userId: SOCIAL_HOST_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionA3Id, userId: SOCIAL_PARTICIPANT_01_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionA3Id, userId: SOCIAL_PARTICIPANT_02_ID, status: PlaySessionParticipantStatus.CONFIRMED },

    // Social B: Session B1
    { playSessionId: sessionB1Id, userId: SOCIAL_HOST_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionB1Id, userId: SOCIAL_PARTICIPANT_01_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionB1Id, userId: SOCIAL_PARTICIPANT_02_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionB1Id, userId: SOCIAL_PARTICIPANT_03_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    // Social B: Session B2
    { playSessionId: sessionB2Id, userId: SOCIAL_HOST_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionB2Id, userId: SOCIAL_PARTICIPANT_01_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionB2Id, userId: SOCIAL_PARTICIPANT_02_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionB2Id, userId: SOCIAL_PARTICIPANT_03_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    // Social B: Session B3
    { playSessionId: sessionB3Id, userId: SOCIAL_HOST_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionB3Id, userId: SOCIAL_PARTICIPANT_01_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionB3Id, userId: SOCIAL_PARTICIPANT_02_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionB3Id, userId: SOCIAL_PARTICIPANT_03_ID, status: PlaySessionParticipantStatus.CONFIRMED },

    // Matchmaking Demo: Session 1
    { playSessionId: sessionM1Id, userId: SOCIAL_HOST_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionM1Id, userId: SOCIAL_PARTICIPANT_01_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionM1Id, userId: SOCIAL_PARTICIPANT_02_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionM1Id, userId: SOCIAL_PARTICIPANT_03_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionM1Id, userId: SOCIAL_PARTICIPANT_04_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionM1Id, userId: SOCIAL_PARTICIPANT_05_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionM1Id, userId: SOCIAL_PARTICIPANT_06_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionM1Id, userId: SOCIAL_PARTICIPANT_07_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionM1Id, userId: SOCIAL_PARTICIPANT_08_ID, status: PlaySessionParticipantStatus.CONFIRMED },

    // Matchmaking Demo: Session 2
    { playSessionId: sessionM2Id, userId: SOCIAL_HOST_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionM2Id, userId: SOCIAL_PARTICIPANT_01_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionM2Id, userId: SOCIAL_PARTICIPANT_02_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionM2Id, userId: SOCIAL_PARTICIPANT_03_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionM2Id, userId: SOCIAL_PARTICIPANT_04_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionM2Id, userId: SOCIAL_PARTICIPANT_05_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionM2Id, userId: SOCIAL_PARTICIPANT_06_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionM2Id, userId: SOCIAL_PARTICIPANT_07_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionM2Id, userId: SOCIAL_PARTICIPANT_08_ID, status: PlaySessionParticipantStatus.CONFIRMED },

    // Matchmaking Demo: Session 3
    { playSessionId: sessionM3Id, userId: SOCIAL_HOST_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionM3Id, userId: SOCIAL_PARTICIPANT_01_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionM3Id, userId: SOCIAL_PARTICIPANT_02_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionM3Id, userId: SOCIAL_PARTICIPANT_03_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionM3Id, userId: SOCIAL_PARTICIPANT_04_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionM3Id, userId: SOCIAL_PARTICIPANT_05_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionM3Id, userId: SOCIAL_PARTICIPANT_06_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionM3Id, userId: SOCIAL_PARTICIPANT_07_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionM3Id, userId: SOCIAL_PARTICIPANT_08_ID, status: PlaySessionParticipantStatus.CONFIRMED },

    // Matchmaking Demo: Session 4
    { playSessionId: sessionM4Id, userId: SOCIAL_HOST_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionM4Id, userId: SOCIAL_PARTICIPANT_01_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionM4Id, userId: SOCIAL_PARTICIPANT_02_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionM4Id, userId: SOCIAL_PARTICIPANT_03_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionM4Id, userId: SOCIAL_PARTICIPANT_04_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionM4Id, userId: SOCIAL_PARTICIPANT_05_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionM4Id, userId: SOCIAL_PARTICIPANT_06_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionM4Id, userId: SOCIAL_PARTICIPANT_07_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionM4Id, userId: SOCIAL_PARTICIPANT_08_ID, status: PlaySessionParticipantStatus.CONFIRMED },

    // Matchmaking Demo: Session 5
    { playSessionId: sessionM5Id, userId: SOCIAL_HOST_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionM5Id, userId: SOCIAL_PARTICIPANT_01_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionM5Id, userId: SOCIAL_PARTICIPANT_02_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionM5Id, userId: SOCIAL_PARTICIPANT_03_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionM5Id, userId: SOCIAL_PARTICIPANT_04_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionM5Id, userId: SOCIAL_PARTICIPANT_05_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionM5Id, userId: SOCIAL_PARTICIPANT_06_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionM5Id, userId: SOCIAL_PARTICIPANT_07_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: sessionM5Id, userId: SOCIAL_PARTICIPANT_08_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    // Completed Social: Session 1
    { playSessionId: 'f14cbe8d-220f-4ebc-9235-b9a1b8fc4f47', userId: SOCIAL_HOST_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: 'f14cbe8d-220f-4ebc-9235-b9a1b8fc4f47', userId: SOCIAL_PARTICIPANT_01_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: 'f14cbe8d-220f-4ebc-9235-b9a1b8fc4f47', userId: SOCIAL_PARTICIPANT_02_ID, status: PlaySessionParticipantStatus.CONFIRMED },
    { playSessionId: 'f14cbe8d-220f-4ebc-9235-b9a1b8fc4f47', userId: SOCIAL_PARTICIPANT_03_ID, status: PlaySessionParticipantStatus.CONFIRMED }
  ];

  for (const psp of playSessionParticipants) {
    await db.playSessionParticipant.upsert({
      where: {
        playSessionId_userId: {
          playSessionId: psp.playSessionId,
          userId: psp.userId,
        },
      },
      update: { status: psp.status },
      create: psp,
    });
  }

  console.log('Upserting social expenses...');

  const expenses = [
    {
      id: '1a0c173f-e79c-49a8-b67c-c4260db7ff89',
      socialId: SOCIAL_ID,
      title: 'Tiền mua bóng thi đấu',
      description: 'Hộp 4 quả bóng Pickleball Franklin X-40',
      amount: 120000,
      createdById: SOCIAL_HOST_ID,
    }
  ];

  for (const e of expenses) {
    await db.socialExpense.upsert({
      where: { id: e.id },
      update: e,
      create: e,
    });
  }

  console.log('Upserting social payments...');

  const socialPayments = [
    // Social 1 Payments
    {
      id: '9a0c173f-e79c-49a8-b67c-c4260db7ff91',
      socialParticipantId: '8a0c173f-e79c-49a8-b67c-c4260db7ff89', // Part 01
      amount: 300000,
      status: SocialPaymentStatus.CONFIRMED,
      transactionType: SocialTransactionType.PAYMENT,
      createdById: SOCIAL_PARTICIPANT_01_ID,
      verifiedById: SOCIAL_HOST_ID,
    },
    {
      id: '9a0c173f-e79c-49a8-b67c-c4260db7ff92',
      socialParticipantId: '7a0c173f-e79c-49a8-b67c-c4260db7ff89', // Part 02
      amount: 150000,
      receiptUrl: 'https://example.com/receipt-bob.jpg',
      status: SocialPaymentStatus.PENDING_REVIEW,
      transactionType: SocialTransactionType.PAYMENT,
      createdById: SOCIAL_PARTICIPANT_02_ID,
    },
    {
      id: '9a0c173f-e79c-49a8-b67c-c4260db7ff93',
      socialParticipantId: '6a0c173f-e79c-49a8-b67c-c4260db7ff89', // Part 03
      amount: 300000,
      status: SocialPaymentStatus.CONFIRMED,
      transactionType: SocialTransactionType.PAYMENT,
      createdById: SOCIAL_PARTICIPANT_03_ID,
      verifiedById: SOCIAL_HOST_ID,
    },

    // Social A Payments
    {
      id: '4a0c173f-e79c-49a8-b67c-c4260db7ff91',
      socialParticipantId: '4a0c173f-e79c-49a8-b67c-c4260db7ffa2', // Part 01
      amount: 250000,
      status: SocialPaymentStatus.CONFIRMED,
      transactionType: SocialTransactionType.PAYMENT,
      createdById: SOCIAL_PARTICIPANT_01_ID,
      verifiedById: SOCIAL_HOST_ID,
    },
    {
      id: '4a0c173f-e79c-49a8-b67c-c4260db7ff92',
      socialParticipantId: '4a0c173f-e79c-49a8-b67c-c4260db7ffa3', // Part 02
      amount: 250000,
      status: SocialPaymentStatus.CONFIRMED,
      transactionType: SocialTransactionType.PAYMENT,
      createdById: SOCIAL_PARTICIPANT_02_ID,
      verifiedById: SOCIAL_HOST_ID,
    },
    {
      id: '4a0c173f-e79c-49a8-b67c-c4260db7ff93',
      socialParticipantId: '4a0c173f-e79c-49a8-b67c-c4260db7ffa4', // Part 03
      amount: 100000,
      status: SocialPaymentStatus.CONFIRMED,
      transactionType: SocialTransactionType.PAYMENT,
      createdById: SOCIAL_PARTICIPANT_03_ID,
      verifiedById: SOCIAL_HOST_ID,
    }
  ];

  for (const sp of socialPayments) {
    await db.socialPayment.upsert({
      where: { id: sp.id },
      update: sp,
      create: sp,
    });
  }

  console.log('Upserting social stats...');
  const socialStats = [
    {
      id: '8f14cbe8-220f-4ebc-9235-b9a1b8fc4f47',
      socialId: socialCompletedId,
      totalMatches: 8,
      activePlayers: 4,
      courtHours: 2.0,
      playerStats: [
        {
          userId: SOCIAL_HOST_ID,
          name: 'Picklehub Seed User',
          avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
          skillLevel: 4.0,
          matchesPlayed: 4,
          wins: 3,
          losses: 1,
          draws: 0
        },
        {
          userId: SOCIAL_PARTICIPANT_01_ID,
          name: 'Social Participant 01',
          avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200',
          skillLevel: 3.5,
          matchesPlayed: 4,
          wins: 2,
          losses: 2,
          draws: 0
        },
        {
          userId: SOCIAL_PARTICIPANT_02_ID,
          name: 'Social Participant 02',
          avatarUrl: null,
          skillLevel: 3.0,
          matchesPlayed: 4,
          wins: 2,
          losses: 2,
          draws: 0
        },
        {
          userId: SOCIAL_PARTICIPANT_03_ID,
          name: 'Social Participant 03',
          avatarUrl: null,
          skillLevel: 3.0,
          matchesPlayed: 4,
          wins: 1,
          losses: 3,
          draws: 0
        }
      ]
    }
  ];

  for (const ss of socialStats) {
    await db.socialStats.upsert({
      where: { socialId: ss.socialId },
      update: {
        totalMatches: ss.totalMatches,
        activePlayers: ss.activePlayers,
        courtHours: ss.courtHours,
        playerStats: ss.playerStats as any,
      },
      create: {
        id: ss.id,
        socialId: ss.socialId,
        totalMatches: ss.totalMatches,
        activePlayers: ss.activePlayers,
        courtHours: ss.courtHours,
        playerStats: ss.playerStats as any,
      }
    });
  }

  console.log('Upserting social feedbacks...');
  const socialFeedbacks = [
    {
      id: '7f14cbe8-220f-4ebc-9235-b9a1b8fc4f47',
      socialId: socialCompletedId,
      userId: SOCIAL_PARTICIPANT_01_ID,
      ratingOverall: 5,
      ratingOrganization: 4,
      ratingVenue: 5,
      comment: 'Very friendly matches, well organized!',
    },
    {
      id: '6f14cbe8-220f-4ebc-9235-b9a1b8fc4f47',
      socialId: socialCompletedId,
      userId: SOCIAL_PARTICIPANT_02_ID,
      ratingOverall: 4,
      ratingOrganization: 4,
      ratingVenue: 4,
      comment: 'Nice venue, host was great.',
    }
  ];

  for (const sf of socialFeedbacks) {
    await db.socialFeedback.upsert({
      where: {
        socialId_userId: {
          socialId: sf.socialId,
          userId: sf.userId,
        }
      },
      update: sf,
      create: sf,
    });
  }

  console.log('Seeding complete! Financial demonstration data is ready.');
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error('Failed to seed play sessions', error);
    await db.$disconnect();
    process.exit(1);
  });