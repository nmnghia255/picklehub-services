import { PrismaClient, PlanType, BillingCycle } from '@prisma/client';

const prisma = new PrismaClient();

const plans = [
  // ── SPORT CENTER MANAGER ──────────────────────────────────────────
  {
    type: PlanType.SPORT_CENTER_MANAGER,
    billingCycle: BillingCycle.MONTHLY,
    name: 'Gói Quản lý Sân Thể thao - Tháng',
    description:
      'Dành cho chủ sân pickleball. Hệ thống quản lý toàn diện giúp tự động hóa vận hành.',
    features: [
      'Quản lý toàn diện hồ sơ và danh sách sân (hình ảnh, đánh giá)',
      'Hệ thống lịch và nhận đặt sân trực tuyến, offline, danh sách chờ',
      'Quản lý thanh toán, thống kê doanh thu và báo cáo sử dụng sân',
      'Trí tuệ nhân tạo (AI) dự đoán nhu cầu sân theo thời gian',
    ],
    priceVnd: 399000,
    durationInDays: 30,
    sortOrder: 10,
  },
  {
    type: PlanType.SPORT_CENTER_MANAGER,
    billingCycle: BillingCycle.QUARTERLY,
    name: 'Gói Quản lý Sân Thể thao - Quý',
    description:
      'Quản lý sân hiệu quả trong 3 tháng, tối ưu hóa chi phí vận hành.',
    features: [
      'Tất cả tính năng gói tháng',
      'Tiết kiệm ~10% so với thanh toán từng tháng',
    ],
    priceVnd: 1079000,
    durationInDays: 90,
    sortOrder: 11,
  },
  {
    type: PlanType.SPORT_CENTER_MANAGER,
    billingCycle: BillingCycle.YEARLY,
    name: 'Gói Quản lý Sân Thể thao - Năm',
    description:
      'Tiết kiệm tối đa cho việc vận hành kinh doanh sân bãi lâu dài.',
    features: [
      'Tất cả tính năng gói tháng',
      'Tiết kiệm ~16% (tương đương 2 tháng miễn phí)',
    ],
    priceVnd: 3990000,
    durationInDays: 365,
    sortOrder: 12,
  },

  // ── GROUP OWNER ───────────────────────────────────────────────────
  {
    type: PlanType.GROUP_OWNER,
    billingCycle: BillingCycle.MONTHLY,
    name: 'Gói Quản lý Hội nhóm - Tháng',
    description:
      'Giải pháp hoàn hảo để xây dựng và phát triển cộng đồng người chơi Pickleball.',
    features: [
      'Khởi tạo và quản lý hồ sơ, danh sách thành viên nhóm (Invite email)',
      'Hệ thống lịch chơi chung và thông báo đẩy tới toàn bộ nhóm',
      'Theo dõi quỹ nhóm, thống kê hoạt động và thu chi minh bạch',
      'Bảng xếp hạng (Leaderboard) nội bộ và phân quyền quản trị viên',
    ],
    priceVnd: 149000,
    durationInDays: 30,
    sortOrder: 20,
  },
  {
    type: PlanType.GROUP_OWNER,
    billingCycle: BillingCycle.QUARTERLY,
    name: 'Gói Quản lý Hội nhóm - Quý',
    description: 'Duy trì kết nối cộng đồng liên tục trong 3 tháng.',
    features: [
      'Tất cả tính năng gói tháng',
      'Tiết kiệm ~10% so với thanh toán từng tháng',
    ],
    priceVnd: 399000,
    durationInDays: 90,
    sortOrder: 21,
  },
  {
    type: PlanType.GROUP_OWNER,
    billingCycle: BillingCycle.YEARLY,
    name: 'Gói Quản lý Hội nhóm - Năm',
    description: 'Đồng hành cùng sự phát triển bền vững của cộng đồng.',
    features: [
      'Tất cả tính năng gói tháng',
      'Tiết kiệm ~16% (tương đương 2 tháng miễn phí)',
    ],
    priceVnd: 1490000,
    durationInDays: 365,
    sortOrder: 22,
  },

  // ── SOCIAL HOST ───────────────────────────────────────────────────
  {
    type: PlanType.SOCIAL_HOST,
    billingCycle: BillingCycle.MONTHLY,
    name: 'Gói Tổ chức Giao lưu - Tháng',
    description:
      'Công cụ đắc lực để tổ chức các buổi chơi giao lưu, ghép đôi tự động và mượt mà.',
    features: [
      'Khởi tạo và quản lý danh sách người chơi cho buổi giao lưu',
      'Thuật toán ghép đôi (Matchmaking) tự động theo trình độ',
      'Lên lịch thi đấu linh hoạt cho nhiều vòng (Multi-round)',
      'Công cụ nhập, xác nhận kết quả và xếp hạng nội bộ',
    ],
    priceVnd: 99000,
    durationInDays: 30,
    sortOrder: 30,
  },
  {
    type: PlanType.SOCIAL_HOST,
    billingCycle: BillingCycle.QUARTERLY,
    name: 'Gói Tổ chức Giao lưu - Quý',
    description:
      'Lựa chọn lý tưởng cho các host tổ chức hoạt động thường xuyên.',
    features: [
      'Tất cả tính năng gói tháng',
      'Tiết kiệm ~10% so với thanh toán từng tháng',
    ],
    priceVnd: 269000,
    durationInDays: 90,
    sortOrder: 31,
  },
  {
    type: PlanType.SOCIAL_HOST,
    billingCycle: BillingCycle.YEARLY,
    name: 'Gói Tổ chức Giao lưu - Năm',
    description: 'Tổ chức giao lưu chuyên nghiệp, xuyên suốt cả năm.',
    features: [
      'Tất cả tính năng gói tháng',
      'Tiết kiệm ~16% (tương đương 2 tháng miễn phí)',
    ],
    priceVnd: 990000,
    durationInDays: 365,
    sortOrder: 32,
  },

  // ── TOURNAMENT ORGANIZER ──────────────────────────────────────────
  {
    type: PlanType.TOURNAMENT_ORGANIZER,
    billingCycle: BillingCycle.MONTHLY,
    name: 'Gói Tổ chức Giải đấu - Tháng',
    description:
      'Bộ công cụ toàn diện dành cho ban tổ chức giải Pickleball chuyên nghiệp.',
    features: [
      'Tạo giải đấu chuyên nghiệp, quản lý cổng đăng ký cá nhân & đội',
      'Tạo sơ đồ thi đấu tự động (Bracket), ghép team thông minh (AI)',
      'Cập nhật và hiển thị tỉ số trực tiếp (Live Scoring) thời gian thực',
      'Quản lý tài chính giải thưởng và hệ thống trọng tài ghi điểm',
    ],
    priceVnd: 599000,
    durationInDays: 30,
    sortOrder: 40,
  },
  {
    type: PlanType.TOURNAMENT_ORGANIZER,
    billingCycle: BillingCycle.QUARTERLY,
    name: 'Gói Tổ chức Giải đấu - Quý',
    description:
      'Xây dựng chuỗi giải đấu trong một mùa giải (season) chuyên nghiệp.',
    features: [
      'Tất cả tính năng gói tháng',
      'Tiết kiệm ~10% so với thanh toán từng tháng',
    ],
    priceVnd: 1599000,
    durationInDays: 90,
    sortOrder: 41,
  },
  {
    type: PlanType.TOURNAMENT_ORGANIZER,
    billingCycle: BillingCycle.YEARLY,
    name: 'Gói Tổ chức Giải đấu - Năm',
    description:
      'Dành cho các đơn vị tổ chức chuỗi giải đấu quy mô quốc gia.',
    features: [
      'Tất cả tính năng gói tháng',
      'Tiết kiệm ~16% (tương đương 2 tháng miễn phí)',
    ],
    priceVnd: 5990000,
    durationInDays: 365,
    sortOrder: 42,
  },

  // -- COACH ---------------------------------------------------------
  {
    type: PlanType.COACH,
    billingCycle: BillingCycle.MONTHLY,
    name: 'Gói Huấn luyện viên - Tháng',
    description:
      'Dành cho huấn luyện viên muốn xây dựng hồ sơ chuyên nghiệp, mở lớp, quản lý lịch dạy và nhận đặt buổi học từ học viên.',
    features: [
      'Tạo và công khai hồ sơ huấn luyện viên',
      'Quản lý chứng chỉ, chuyên môn, học phí theo giờ và thông tin thanh toán',
      'Tạo lớp học nhóm và lịch dạy định kỳ',
      'Nhận đặt lịch học riêng và theo dõi thanh toán của học viên',
    ],
    priceVnd: 199000,
    durationInDays: 30,
    sortOrder: 50,
  },
  {
    type: PlanType.COACH,
    billingCycle: BillingCycle.QUARTERLY,
    name: 'Gói Huấn luyện viên - Quý',
    description:
      'Phù hợp cho huấn luyện viên hoạt động thường xuyên, duy trì lớp học và lịch dạy cá nhân trong cả mùa.',
    features: [
      'Tất cả tính năng gói tháng',
      'Tiết kiệm ~10% so với thanh toán từng tháng',
    ],
    priceVnd: 539000,
    durationInDays: 90,
    sortOrder: 51,
  },
  {
    type: PlanType.COACH,
    billingCycle: BillingCycle.YEARLY,
    name: 'Gói Huấn luyện viên - Năm',
    description:
      'Lựa chọn tối ưu cho huấn luyện viên chuyên nghiệp muốn phát triển thương hiệu cá nhân lâu dài trên PickleHub.',
    features: [
      'Tất cả tính năng gói tháng',
      'Tiết kiệm ~16% so với thanh toán từng tháng',
    ],
    priceVnd: 1990000,
    durationInDays: 365,
    sortOrder: 52,
  },
];

async function main() {
  console.log('Seeding subscription service plans...');

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: {
        plans_type_cycle_uidx: {
          type: plan.type,
          billingCycle: plan.billingCycle,
        },
      },
      update: {
        name: plan.name,
        description: plan.description,
        features: plan.features,
        priceVnd: plan.priceVnd,
        durationInDays: plan.durationInDays,
        sortOrder: plan.sortOrder,
        isActive: true,
      },
      create: plan,
    });
  }

  console.log(`Successfully seeded ${plans.length} plans.`);

  // Seed subscription for seed-user@picklehub.com (11111111-1111-4111-8111-111111111111)
  // Seed all YEARLY subscriptions for seed-user@picklehub.com
  const seedUserId = '11111111-1111-4111-8111-111111111111';

  const yearlyPlans = await prisma.plan.findMany({
    where: {
      billingCycle: BillingCycle.YEARLY,
      isActive: true,
    },
  });

  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setFullYear(endDate.getFullYear() + 1);

  for (const plan of yearlyPlans) {
    const existingSub = await prisma.subscription.findFirst({
      where: {
        userId: seedUserId,
        planId: plan.id,
      },
    });

    if (existingSub) {
      await prisma.subscription.update({
        where: {
          id: existingSub.id,
        },
        data: {
          status: 'ACTIVE',
          startDate,
          endDate,
          autoRenew: true,
        },
      });

      console.log(`Updated subscription: ${plan.name}`);
    } else {
      const sub = await prisma.subscription.create({
        data: {
          userId: seedUserId,
          planId: plan.id,
          status: 'ACTIVE',
          startDate,
          endDate,
          autoRenew: true,
        },
      });

      await prisma.payment.create({
        data: {
          subscriptionId: sub.id,
          userId: seedUserId,
          amountVnd: plan.priceVnd,
          status: 'SUCCESS',
          vnpTxnRef: `SEED_TXN_${plan.type}_${Date.now()}`,
          vnpTransactionNo: `SEED_${plan.type}`,
          paidAt: startDate,
        },
      });

      console.log(`Created subscription: ${plan.name}`);
    }
  }
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
