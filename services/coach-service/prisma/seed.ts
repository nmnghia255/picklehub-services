import { PrismaClient, CoachStatus, VerificationStatus } from '@prisma/client';

const prisma = new PrismaClient();
const SEED_BASE_DATE = new Date();
SEED_BASE_DATE.setUTCHours(0, 0, 0, 0);

const dateFromSeed = (daysOffset: number, hours = 0, minutes = 0) => {
  const date = new Date(SEED_BASE_DATE);
  date.setUTCDate(date.getUTCDate() + daysOffset);
  date.setUTCHours(hours, minutes, 0, 0);
  return date;
};

const yearsAgo = (yearsOffset: number, month: number, day: number) => {
  const date = new Date(SEED_BASE_DATE);
  date.setUTCFullYear(date.getUTCFullYear() - yearsOffset);
  date.setUTCMonth(month, day);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

// ─── Deterministic IDs ────────────────────────────────────────────────────────
// These IDs must match the coach user IDs seeded in auth-service.

// Coach profile IDs (coachProfile.id, NOT userId)
const PROFILE_1_ID = 'c0000001-c000-4000-8000-000000000001';
const PROFILE_2_ID = 'c0000002-c000-4000-8000-000000000002';
const PROFILE_3_ID = 'c0000003-c000-4000-8000-000000000003';

// auth-service user IDs (coachProfile.userId)
const COACH_USER_1 = 'c0000001-c000-4000-8000-000000000000';
const COACH_USER_2 = 'c0000002-c000-4000-8000-000000000000';
const COACH_USER_3 = 'c0000003-c000-4000-8000-000000000000';

// A seeded learner user ID (from auth-service seed)
const LEARNER_USER_ID = 'a0000010-a000-4000-8000-000000000010';
const LEARNER_2_USER_ID = 'a0000011-a000-4000-8000-000000000011';
const LEARNER_3_USER_ID = 'a0000012-a000-4000-8000-000000000012';
const LEARNER_4_USER_ID = 'a0000013-a000-4000-8000-000000000013';
const SEED_USER_ID = '11111111-1111-4111-8111-111111111111';

// Certification IDs
const CERT_1_ID = 'ce000001-ce00-4000-8000-000000000001';
const CERT_2_ID = 'ce000002-ce00-4000-8000-000000000002';
const CERT_3_ID = 'ce000003-ce00-4000-8000-000000000003';
const CERT_4_ID = 'ce000004-ce00-4000-8000-000000000004';
const CERT_5_ID = 'ce000005-ce00-4000-8000-000000000005';

// Class IDs
const CLASS_1A_ID = 'f0000001-f000-4000-8000-000000000001'; // Coach 1 — OPEN
const CLASS_1B_ID = 'f0000002-f000-4000-8000-000000000002'; // Coach 1 — DRAFT
const CLASS_2A_ID = 'f0000003-f000-4000-8000-000000000003'; // Coach 2 — OPEN
const CLASS_2B_ID = 'f0000004-f000-4000-8000-000000000004'; // Coach 2 — DRAFT
const CLASS_3A_ID = 'f0000005-f000-4000-8000-000000000005'; // Coach 3 — OPEN

// Schedule IDs
const SCHED_1A_1 = 'e0000001-e000-4000-8000-000000000001';
const SCHED_1A_2 = 'e0000002-e000-4000-8000-000000000002';
const SCHED_1A_3 = 'e0000003-e000-4000-8000-000000000003';
const SCHED_1A_4 = 'e0000004-e000-4000-8000-000000000004';
const SCHED_2A_1 = 'e0000005-e000-4000-8000-000000000005';
const SCHED_2A_2 = 'e0000006-e000-4000-8000-000000000006';
const SCHED_3A_1 = 'e0000007-e000-4000-8000-000000000007';
const SCHED_3A_2 = 'e0000008-e000-4000-8000-000000000008';

// Enrollment IDs
const ENROLL_1 = 'b0000001-b000-4000-8000-000000000001'; // Learner in Class 1A — SETTLED
const ENROLL_2 = 'b0000002-b000-4000-8000-000000000002'; // Learner in Class 1A — PENDING_REVIEW
const ENROLL_3 = 'b0000003-b000-4000-8000-000000000003'; // Learner in Class 2A — PENDING_PROOF
const ENROLL_4 = 'b0000004-b000-4000-8000-000000000004'; // Learner in Class 1A — SETTLED
const ENROLL_5 = 'b0000005-b000-4000-8000-000000000005'; // Learner in Class 1A — PENDING_PROOF
const ENROLL_6 = 'b0000006-b000-4000-8000-000000000006'; // Seed user in Class 3A — SETTLED

// Private Booking IDs
const BOOKING_1 = 'a1000001-a100-4000-8000-000000000001'; // CONFIRMED + payment SETTLED
const BOOKING_2 = 'a1000002-a100-4000-8000-000000000002'; // PENDING_CONFIRMATION
const BOOKING_3 = 'a1000003-a100-4000-8000-000000000003'; // COMPLETED
const BOOKING_4 = 'a1000004-a100-4000-8000-000000000004'; // CONFIRMED + payment SETTLED
const BOOKING_5 = 'a1000005-a100-4000-8000-000000000005'; // PENDING_CONFIRMATION
const BOOKING_6 = 'a1000006-a100-4000-8000-000000000006'; // Seed user private session

// Coach Review IDs
const REVIEW_1 = '90000001-9000-4000-8000-000000000001';
const REVIEW_2 = '90000002-9000-4000-8000-000000000002';
const REVIEW_3 = '90000003-9000-4000-8000-000000000003';

async function main() {
  console.log('Seeding coach service...');

  // ─── 1. Coach Profiles ──────────────────────────────────────────────────────

  const coach1 = await prisma.coachProfile.upsert({
    where: { userId: COACH_USER_1 },
    update: {},
    create: {
      id: PROFILE_1_ID,
      userId: COACH_USER_1,
      displayName: 'Nguyễn Văn Hùng',
      bio: 'Huấn luyện viên Pickleball chuyên nghiệp với 10 năm kinh nghiệm. Tôi chuyên huấn luyện những người mới bắt đầu và người chơi trình độ trung bình.',
      avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&q=80&w=200',
      level: 'Pro',
      yearsExperience: 10,
      specialties: ['Người mới bắt đầu', 'Chiến thuật đánh đơn', 'Di chuyển bước chân'],
      languages: ['Tiếng Việt', 'Tiếng Anh'],
      locationCity: 'Hồ Chí Minh',
      hourlyRateVnd: 500000,
      paymentAccountName: 'NGUYEN VAN HUNG',
      paymentAccountNumber: '0123456789',
      paymentBankName: 'Vietcombank',
      paymentQrUrl: 'https://cdn.picklehub.vn/qr/coach1.png',
      status: CoachStatus.ACTIVE,
      verificationStatus: VerificationStatus.VERIFIED,
    },
  });

  const coach2 = await prisma.coachProfile.upsert({
    where: { userId: COACH_USER_2 },
    update: {},
    create: {
      id: PROFILE_2_ID,
      userId: COACH_USER_2,
      displayName: 'Trần Thị Lan',
      bio: 'Cựu vận động viên quần vợt quốc gia chuyển hướng sang Pickleball. Tôi tập trung vào các kỹ thuật nâng cao và chuẩn bị cho các giải đấu.',
      avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
      level: 'Advanced',
      yearsExperience: 5,
      specialties: ['Kỹ thuật nâng cao', 'Chiến thuật đánh đôi', 'Chuẩn bị thi đấu'],
      languages: ['Tiếng Việt'],
      locationCity: 'Hà Nội',
      hourlyRateVnd: 750000,
      paymentAccountName: 'TRAN THI LAN',
      paymentAccountNumber: '9876543210',
      paymentBankName: 'Techcombank',
      paymentQrUrl: 'https://cdn.picklehub.vn/qr/coach2.png',
      status: CoachStatus.ACTIVE,
      verificationStatus: VerificationStatus.VERIFIED,
    },
  });

  const coach3 = await prisma.coachProfile.upsert({
    where: { userId: COACH_USER_3 },
    update: {},
    create: {
      id: PROFILE_3_ID,
      userId: COACH_USER_3,
      displayName: 'Lê Bảo Long',
      bio: 'Huấn luyện viên nhiệt huyết, thích đưa những người mới đến với bộ môn này. Rất thân thiện với trẻ em và các gia đình!',
      avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=200',
      level: 'Intermediate',
      yearsExperience: 2,
      specialties: ['Trẻ em', 'Gia đình', 'Vui chơi & Rèn luyện sức khỏe'],
      languages: ['Tiếng Việt'],
      locationCity: 'Đà Nẵng',
      hourlyRateVnd: 300000,
      paymentAccountName: 'LE BAO LONG',
      paymentAccountNumber: '1122334455',
      paymentBankName: 'MB Bank',
      paymentQrUrl: null,
      status: CoachStatus.ACTIVE,
      verificationStatus: VerificationStatus.PENDING,
    },
  });

  console.log(`✓ Upserted 3 coach profiles`);

  // ─── 2. Certifications ─────────────────────────────────────────────────────

  const certs = [
    {
      id: CERT_1_ID,
      coachProfileId: coach1.id,
      name: 'Chứng chỉ Huấn luyện viên USAPA Cấp độ 2',
      issuingOrganization: 'USA Pickleball',
      issuedAt: yearsAgo(6, 0, 15),
      documentUrl: 'https://example.com/cert1.pdf',
      verificationStatus: VerificationStatus.VERIFIED,
    },
    {
      id: CERT_2_ID,
      coachProfileId: coach1.id,
      name: 'PPR Certified Professional',
      issuingOrganization: 'Professional Pickleball Registry',
      issuedAt: yearsAgo(4, 4, 20),
      documentUrl: 'https://example.com/cert2.pdf',
      verificationStatus: VerificationStatus.VERIFIED,
    },
    {
      id: CERT_3_ID,
      coachProfileId: coach2.id,
      name: 'PPR Certified Professional',
      issuingOrganization: 'Professional Pickleball Registry',
      issuedAt: yearsAgo(5, 5, 10),
      documentUrl: 'https://example.com/cert3.pdf',
      verificationStatus: VerificationStatus.VERIFIED,
    },
    {
      id: CERT_4_ID,
      coachProfileId: coach2.id,
      name: 'IPTPA Certified Instructor',
      issuingOrganization: 'International Pickleball Teaching Professional Association',
      issuedAt: yearsAgo(3, 1, 1),
      documentUrl: 'https://example.com/cert4.pdf',
      verificationStatus: VerificationStatus.PENDING,
    },
    {
      id: CERT_5_ID,
      coachProfileId: coach3.id,
      name: 'Chứng chỉ Huấn luyện viên Địa phương',
      issuingOrganization: 'Liên đoàn Pickleball Việt Nam',
      issuedAt: yearsAgo(3, 2, 20),
      documentUrl: 'https://example.com/cert5.pdf',
      verificationStatus: VerificationStatus.PENDING,
    },
  ];

  for (const cert of certs) {
    await prisma.coachCertification.upsert({
      where: { id: cert.id },
      update: cert,
      create: cert,
    });
  }

  console.log(`✓ Upserted 5 certifications`);

  // ─── 3. Coach Classes ──────────────────────────────────────────────────────

  const classes = [
    {
      id: CLASS_1A_ID,
      coachProfileId: coach1.id,
      title: 'Khóa Học Pickleball Cho Người Mới Bắt Đầu',
      description: 'Khóa học nhóm 4 tuần dành cho người hoàn toàn mới. Bao gồm: quy tắc cơ bản, kỹ thuật cầm vợt, serve, return, và dinking.\n\nLớp học diễn ra mỗi Thứ Bảy 7-9h sáng. Tối đa 10 học viên.',
      level: 'Beginner',
      capacity: 10,
      enrolledCount: 4,
      priceVnd: 1500000,
      locationDescription: 'Sân Pickleball 360, 123 Lê Văn Lương, Q. Gò Vấp, TP. HCM',
      coverImageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&q=80&w=800',
      status: 'OPEN' as const,
      startDate: dateFromSeed(18),
      endDate: dateFromSeed(39),
    },
    {
      id: CLASS_1B_ID,
      coachProfileId: coach1.id,
      title: 'Workshop Chiến Thuật Đánh Đơn Nâng Cao',
      description: 'Workshop 2 buổi chuyên sâu về chiến thuật đánh đơn: kiểm soát bóng, di chuyển, tấn công và phòng thủ. Yêu cầu đã có kinh nghiệm cơ bản.',
      level: 'Advanced',
      capacity: 6,
      enrolledCount: 0,
      priceVnd: 2000000,
      locationDescription: 'Sân trong nhà Thể thao Quận 3, TP. HCM',
      coverImageUrl: null,
      status: 'DRAFT' as const,
      startDate: null,
      endDate: null,
    },
    {
      id: CLASS_2A_ID,
      coachProfileId: coach2.id,
      title: 'Kỹ Thuật Doubles Chuyên Nghiệp',
      description: 'Khóa học chuyên sâu về kỹ thuật và chiến thuật đánh đôi. Phù hợp cho người chơi trình độ trung bình đến nâng cao muốn cải thiện khả năng thi đấu đôi.',
      level: 'Intermediate',
      capacity: 8,
      enrolledCount: 1,
      priceVnd: 1800000,
      locationDescription: 'Pickleball Club Hà Nội, 456 Nguyễn Trãi, Thanh Xuân, Hà Nội',
      coverImageUrl: 'https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?auto=format&fit=crop&q=80&w=800',
      status: 'OPEN' as const,
      startDate: dateFromSeed(19),
      endDate: dateFromSeed(47),
    },
    {
      id: CLASS_2B_ID,
      coachProfileId: coach2.id,
      title: 'Dinking & Kitchen Game Mastery',
      description: 'Khóa học tập trung vào kỹ năng "kitchen game" — phần quan trọng nhất trong Pickleball nâng cao.',
      level: 'Advanced',
      capacity: 6,
      enrolledCount: 0,
      priceVnd: 2500000,
      locationDescription: 'Pickleball Club Hà Nội, 456 Nguyễn Trãi, Thanh Xuân, Hà Nội',
      coverImageUrl: null,
      status: 'DRAFT' as const,
      startDate: null,
      endDate: null,
    },
    {
      id: CLASS_3A_ID,
      coachProfileId: coach3.id,
      title: 'Pickleball Vui Vẻ Cho Gia Đình',
      description: 'Khóa học thân thiện dành cho gia đình và trẻ em từ 8 tuổi. Trọng tâm là vui vẻ, an toàn và rèn luyện sức khỏe.',
      level: 'Beginner',
      capacity: 12,
      enrolledCount: 1,
      priceVnd: 800000,
      locationDescription: 'Công viên Thể thao Biển Mỹ Khê, Đà Nẵng',
      coverImageUrl: 'https://images.unsplash.com/photo-1547347298-4074fc3086f0?auto=format&fit=crop&q=80&w=800',
      status: 'OPEN' as const,
      startDate: dateFromSeed(25),
      endDate: dateFromSeed(53),
    },
  ];

  for (const cls of classes) {
    await prisma.coachClass.upsert({
      where: { id: cls.id },
      update: cls,
      create: cls,
    });
  }

  console.log(`✓ Upserted 5 classes`);

  // ─── 4. Class Schedules ─────────────────────────────────────────────────────

  const schedules = [
    // Coach 1 — Class 1A: 4 Saturday sessions
    { id: SCHED_1A_1, classId: CLASS_1A_ID, scheduledAt: dateFromSeed(18, 2), durationMinutes: 120, topic: 'Giới thiệu môn Pickleball và quy tắc cơ bản', note: 'Mang giày thể thao. Vợt sẽ được cho mượn.' },
    { id: SCHED_1A_2, classId: CLASS_1A_ID, scheduledAt: dateFromSeed(25, 2), durationMinutes: 120, topic: 'Kỹ thuật serve và return', note: 'Mang vợt riêng nếu có. Sân số 2.' },
    { id: SCHED_1A_3, classId: CLASS_1A_ID, scheduledAt: dateFromSeed(32, 2), durationMinutes: 120, topic: 'Dinking và kitchen game', note: null },
    { id: SCHED_1A_4, classId: CLASS_1A_ID, scheduledAt: dateFromSeed(39, 2), durationMinutes: 120, topic: 'Thi đấu nội bộ và tổng kết khóa học', note: 'Buổi cuối — có ảnh kỷ niệm nhóm.' },
    // Coach 2 — Class 2A: 2 Sunday sessions
    { id: SCHED_2A_1, classId: CLASS_2A_ID, scheduledAt: dateFromSeed(19, 3), durationMinutes: 120, topic: 'Vị trí sân đôi và giao tiếp với đối tác', note: null },
    { id: SCHED_2A_2, classId: CLASS_2A_ID, scheduledAt: dateFromSeed(26, 3), durationMinutes: 120, topic: 'Stacking và poaching', note: 'Sân số 1. Đến trước 10 phút để khởi động.' },
    // Coach 3 — Class 3A: Weekend sessions
    { id: SCHED_3A_1, classId: CLASS_3A_ID, scheduledAt: dateFromSeed(25, 4), durationMinutes: 90, topic: 'Làm quen với Pickleball và luật chơi cơ bản', note: 'Phụ huynh có thể tham gia xem.' },
    { id: SCHED_3A_2, classId: CLASS_3A_ID, scheduledAt: dateFromSeed(32, 4), durationMinutes: 90, topic: 'Kỹ thuật đánh cơ bản và trò chơi nhóm', note: null },
  ];

  for (const sched of schedules) {
    await prisma.classSchedule.upsert({
      where: { id: sched.id },
      update: sched,
      create: sched,
    });
  }

  console.log(`✓ Upserted 8 class schedules`);

  // ─── 5. Class Enrollments ──────────────────────────────────────────────────
  // Using LEARNER_USER_ID as the test learner

  const enrollments = [
    {
      id: ENROLL_1,
      classId: CLASS_1A_ID,
      learnerId: LEARNER_USER_ID,
      status: 'ACTIVE' as const,
      paymentStatus: 'SETTLED' as const,
      amountVnd: 1500000,
      paymentProofUrl: 'https://cdn.picklehub.vn/payment-proofs/txn-enroll1-proof.jpg',
      proofUploadedAt: dateFromSeed(5, 8, 30),
      settledAt: dateFromSeed(6, 10),
      enrolledAt: dateFromSeed(4, 10),
      cancelledAt: null,
    },
    // A second enrollment from a different learner in class 1A with payment pending review
    {
      id: ENROLL_2,
      classId: CLASS_1A_ID,
      learnerId: LEARNER_2_USER_ID,
      status: 'ACTIVE' as const,
      paymentStatus: 'PENDING_REVIEW' as const,
      amountVnd: 1500000,
      paymentProofUrl: 'https://cdn.picklehub.vn/payment-proofs/txn-enroll2-proof.jpg',
      proofUploadedAt: dateFromSeed(8, 14),
      settledAt: null,
      enrolledAt: dateFromSeed(7, 9),
      cancelledAt: null,
    },
    {
      id: ENROLL_4,
      classId: CLASS_1A_ID,
      learnerId: LEARNER_3_USER_ID,
      status: 'ACTIVE' as const,
      paymentStatus: 'SETTLED' as const,
      amountVnd: 1500000,
      paymentProofUrl: 'https://cdn.picklehub.vn/payment-proofs/txn-enroll4-proof.jpg',
      proofUploadedAt: dateFromSeed(9, 8, 45),
      settledAt: dateFromSeed(10, 9, 30),
      enrolledAt: dateFromSeed(8, 8, 15),
      cancelledAt: null,
    },
    {
      id: ENROLL_5,
      classId: CLASS_1A_ID,
      learnerId: LEARNER_4_USER_ID,
      status: 'ACTIVE' as const,
      paymentStatus: 'PENDING_PROOF' as const,
      amountVnd: 1500000,
      paymentProofUrl: null,
      proofUploadedAt: null,
      settledAt: null,
      enrolledAt: dateFromSeed(10, 11, 20),
      cancelledAt: null,
    },
    {
      id: ENROLL_3,
      classId: CLASS_2A_ID,
      learnerId: LEARNER_USER_ID,
      status: 'ACTIVE' as const,
      paymentStatus: 'PENDING_PROOF' as const,
      amountVnd: 1800000,
      paymentProofUrl: null,
      proofUploadedAt: null,
      settledAt: null,
      enrolledAt: dateFromSeed(9, 11),
      cancelledAt: null,
    },
    {
      id: ENROLL_6,
      classId: CLASS_3A_ID,
      learnerId: SEED_USER_ID,
      status: 'ACTIVE' as const,
      paymentStatus: 'SETTLED' as const,
      amountVnd: 800000,
      paymentProofUrl: 'https://cdn.picklehub.vn/payment-proofs/txn-enroll6-proof.jpg',
      proofUploadedAt: dateFromSeed(12, 7, 30),
      settledAt: dateFromSeed(13, 8, 10),
      enrolledAt: dateFromSeed(11, 9, 0),
      cancelledAt: null,
    },
  ];

  for (const enroll of enrollments) {
    await prisma.classEnrollment.upsert({
      where: {
        classId_learnerId: {
          classId: enroll.classId,
          learnerId: enroll.learnerId,
        }
      },
      update: enroll,
      create: enroll,
    });
  }

  console.log(`✓ Upserted 5 class enrollments`);

  // ─── 6. Private Bookings ───────────────────────────────────────────────────

  const bookings = [
    {
      id: BOOKING_1,
      coachProfileId: coach1.id,
      learnerId: LEARNER_USER_ID,
      sessionAt: dateFromSeed(24, 9),
      durationMinutes: 60,
      priceVnd: 500000, // snapshot of coach1.hourlyRateVnd at creation
      status: 'CONFIRMED' as const,
      paymentStatus: 'SETTLED' as const,
      learnerNote: 'Tôi muốn cải thiện kỹ thuật serve và dinking.',
      coachNote: 'Xác nhận buổi tập lúc 9h sáng. Sân số 3. Vui lòng đến trước 5 phút.',
      cancelReason: null,
      paymentProofUrl: 'https://cdn.picklehub.vn/payment-proofs/booking-txn-b1.jpg',
      proofUploadedAt: dateFromSeed(10, 10),
      settledAt: dateFromSeed(11, 9),
      completedAt: null,
    },
    {
      id: BOOKING_2,
      coachProfileId: coach1.id,
      learnerId: LEARNER_2_USER_ID,
      sessionAt: dateFromSeed(27, 14),
      durationMinutes: 90,
      priceVnd: 750000, // 1.5h * 500000
      status: 'PENDING_CONFIRMATION' as const,
      paymentStatus: null, // null until coach confirms
      learnerNote: 'Mình muốn tập doubles. Mang theo bạn cùng tập được không?',
      coachNote: null,
      cancelReason: null,
      paymentProofUrl: null,
      proofUploadedAt: null,
      settledAt: null,
      completedAt: null,
    },
    {
      id: BOOKING_4,
      coachProfileId: coach1.id,
      learnerId: LEARNER_3_USER_ID,
      sessionAt: dateFromSeed(21, 13),
      durationMinutes: 90,
      priceVnd: 750000,
      status: 'CONFIRMED' as const,
      paymentStatus: 'SETTLED' as const,
      learnerNote: 'Muốn tập phản xạ ở lưới và chiến thuật đôi.',
      coachNote: 'Khung giờ chiều thứ Ba. Mang giày sân cứng.',
      cancelReason: null,
      paymentProofUrl: 'https://cdn.picklehub.vn/payment-proofs/booking-txn-b4.jpg',
      proofUploadedAt: dateFromSeed(12, 13, 10),
      settledAt: dateFromSeed(13, 10),
      completedAt: null,
    },
    {
      id: BOOKING_5,
      coachProfileId: coach1.id,
      learnerId: LEARNER_4_USER_ID,
      sessionAt: dateFromSeed(29, 8),
      durationMinutes: 60,
      priceVnd: 500000,
      status: 'PENDING_CONFIRMATION' as const,
      paymentStatus: null,
      learnerNote: 'Tôi muốn đặt buổi tập đầu tiên để đánh giá trình độ.',
      coachNote: null,
      cancelReason: null,
      paymentProofUrl: null,
      proofUploadedAt: null,
      settledAt: null,
      completedAt: null,
    },
    {
      id: BOOKING_3,
      coachProfileId: coach2.id,
      learnerId: LEARNER_USER_ID,
      sessionAt: dateFromSeed(14, 8),
      durationMinutes: 60,
      priceVnd: 750000, // coach2.hourlyRateVnd
      status: 'COMPLETED' as const,
      paymentStatus: 'SETTLED' as const,
      learnerNote: 'Muốn tập chiến thuật net game.',
      coachNote: 'Đã xác nhận. Gặp nhau tại sân A.',
      cancelReason: null,
      paymentProofUrl: 'https://cdn.picklehub.vn/payment-proofs/booking-txn-b3.jpg',
      proofUploadedAt: dateFromSeed(6, 9),
      settledAt: dateFromSeed(7, 10),
      completedAt: dateFromSeed(14, 9, 15),
    },
    {
      id: BOOKING_6,
      coachProfileId: coach1.id,
      learnerId: SEED_USER_ID,
      sessionAt: dateFromSeed(20, 9),
      durationMinutes: 60,
      priceVnd: 500000,
      status: 'CONFIRMED' as const,
      paymentStatus: 'PENDING_PROOF' as const,
      learnerNote: 'Mình muốn có lịch cá nhân cho việc rèn kỹ thuật volley và phản xạ.',
      coachNote: 'Giữ khung giờ buổi sáng. Hẹn ở sân số 2.',
      cancelReason: null,
      paymentProofUrl: null,
      proofUploadedAt: null,
      settledAt: null,
      completedAt: null,
    },
  ];

  for (const booking of bookings) {
    await prisma.privateBooking.upsert({
      where: { id: booking.id },
      update: booking,
      create: booking,
    });
  }

  console.log('✓ Upserted 5 private bookings');

  // ─── 7. Coach Reviews ──────────────────────────────────────────────────────

  const reviews = [
    {
      id: REVIEW_1,
      coachProfileId: coach1.id,
      reviewerId: LEARNER_USER_ID,
      rating: 5,
      comment: 'Thầy Hùng dạy rất nhiệt tình, giải thích dễ hiểu. Kỹ thuật serve của tôi cải thiện rõ rệt!',
      createdAt: dateFromSeed(-16, 8),
    },
    {
      id: REVIEW_2,
      coachProfileId: coach1.id,
      reviewerId: LEARNER_2_USER_ID,
      rating: 4,
      comment: 'Lớp học vui, thầy chuyên môn cao nhưng đôi khi lớp hơi đông.',
      createdAt: dateFromSeed(-11, 10, 30),
    },
    {
      id: REVIEW_3,
      coachProfileId: coach1.id,
      reviewerId: LEARNER_3_USER_ID,
      rating: 5,
      comment: 'Khóa dinking cực kỳ hữu ích! Khuyên mọi người nên học thầy Hùng.',
      createdAt: dateFromSeed(-6, 14, 15),
    },
  ];

  for (const review of reviews) {
    await prisma.coachReview.upsert({
      where: {
        coachProfileId_reviewerId: {
          coachProfileId: review.coachProfileId,
          reviewerId: review.reviewerId,
        }
      },
      update: review,
      create: review,
    });
  }

  console.log('✓ Upserted 3 coach reviews');
  console.log('✅ Coach service seeded: 3 coaches, 5 certs, 5 classes, 8 schedules, 6 enrollments, 6 bookings, 3 reviews.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('Failed to seed coach service:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
