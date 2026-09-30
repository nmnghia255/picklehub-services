"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const getRelativeDate = (daysOffset, timeString) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + daysOffset);
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    return new Date(yyyy + '-' + mm + '-' + dd + 'T' + timeString + 'Z');
};
const getRelativeDateString = (daysOffset, timeString) => {
    return getRelativeDate(daysOffset, timeString).toISOString();
};
const MAIN_USER_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_USER_ID = '22222222-2222-4222-8222-222222222222';
const BOOKER_1_ID = 'b0000001-b000-4000-8000-000000000000';
const BOOKER_2_ID = 'b0000002-b000-4000-8000-000000000000';
const BOOKER_3_ID = 'b0000003-b000-4000-8000-000000000000';
const GROUP_ID = '5f2f3b7c-2c2f-4f9b-9d5e-1b4f6b9d2c11';
const EXPENSE_1_ID = 'e0000001-e000-4000-8000-000000000000';
const EXPENSE_2_ID = 'e0000002-e000-4000-8000-000000000000';
const EQUIP_BALL_ID = 'e4000001-e000-4000-8000-000000000000';
const EQUIP_PADDLE_ID = 'e4000002-e000-4000-8000-000000000000';
const EXPENSE_EQUIP_ID = 'e0000003-e000-4000-8000-000000000000';
async function main() {
    console.log('Upserting group-service data safely...');
    console.log('Seeding groups...');
    await prisma.group.upsert({
        where: { id: GROUP_ID },
        update: {
            name: 'PickleHub Elite Club',
            description: 'The elite community of Pickleball players in PickleHub. All financial tracking starts here.',
            createdById: MAIN_USER_ID,
        },
        create: {
            id: GROUP_ID,
            name: 'PickleHub Elite Club',
            description: 'The elite community of Pickleball players in PickleHub. All financial tracking starts here.',
            createdById: MAIN_USER_ID,
        },
    });
    console.log('Seeding group members...');
    const membersData = [
        { userId: MAIN_USER_ID, groupId: GROUP_ID, role: client_1.GroupMemberRole.OWNER, creditBalance: 0 },
        { userId: OWNER_USER_ID, groupId: GROUP_ID, role: client_1.GroupMemberRole.MEMBER, creditBalance: 0 },
        { userId: BOOKER_1_ID, groupId: GROUP_ID, role: client_1.GroupMemberRole.MEMBER, creditBalance: 150000 },
        { userId: BOOKER_2_ID, groupId: GROUP_ID, role: client_1.GroupMemberRole.MEMBER, creditBalance: 0 },
        { userId: BOOKER_3_ID, groupId: GROUP_ID, role: client_1.GroupMemberRole.MEMBER, creditBalance: 50000 },
    ];
    for (const m of membersData) {
        await prisma.groupMember.upsert({
            where: { userId_groupId: { userId: m.userId, groupId: m.groupId } },
            update: { role: m.role, creditBalance: m.creditBalance },
            create: m,
        });
    }
    console.log('Seeding group expenses...');
    const expense1 = await prisma.groupExpense.upsert({
        where: { id: EXPENSE_1_ID },
        update: {
            title: 'Sân Pickleball tháng 5',
            description: 'Chi phí thuê cụm sân Pickleball 4 buổi tối thứ 7 trong tháng 5.',
            totalAmount: 1200000,
            receiptUrl: 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=500',
            expenseDate: getRelativeDate(-16, '00:00:00.000'),
            createdById: MAIN_USER_ID,
        },
        create: {
            id: EXPENSE_1_ID,
            groupId: GROUP_ID,
            title: 'Sân Pickleball tháng 5',
            description: 'Chi phí thuê cụm sân Pickleball 4 buổi tối thứ 7 trong tháng 5.',
            totalAmount: 1200000,
            receiptUrl: 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=500',
            expenseDate: getRelativeDate(-16, '00:00:00.000'),
            createdById: MAIN_USER_ID,
        },
    });
    const expense2 = await prisma.groupExpense.upsert({
        where: { id: EXPENSE_2_ID },
        update: {
            title: 'Bóng thi đấu Franklin X-40',
            description: 'Mua 1 hộp bóng 12 quả phục vụ giải đấu nội bộ.',
            totalAmount: 300000,
            receiptUrl: 'https://images.unsplash.com/photo-1595257841889-ecea66b466e9?w=500',
            expenseDate: getRelativeDate(-13, '00:00:00.000'),
            createdById: OWNER_USER_ID,
        },
        create: {
            id: EXPENSE_2_ID,
            groupId: GROUP_ID,
            title: 'Bóng thi đấu Franklin X-40',
            description: 'Mua 1 hộp bóng 12 quả phục vụ giải đấu nội bộ.',
            totalAmount: 300000,
            receiptUrl: 'https://images.unsplash.com/photo-1595257841889-ecea66b466e9?w=500',
            expenseDate: getRelativeDate(-13, '00:00:00.000'),
            createdById: OWNER_USER_ID,
        },
    });
    console.log('Seeding group payments...');
    const paymentsData = [
        { expenseId: expense1.id, userId: BOOKER_1_ID, requiredFee: 300000, amountPaid: 300000, status: client_1.PaymentStatus.PAID, paidAt: getRelativeDate(-15, '10:00:00.000'), verifiedById: MAIN_USER_ID },
        { expenseId: expense1.id, userId: BOOKER_2_ID, requiredFee: 300000, amountPaid: 150000, status: client_1.PaymentStatus.PARTIALLY_PAID, paidAt: null, verifiedById: null },
        { expenseId: expense1.id, userId: BOOKER_3_ID, requiredFee: 300000, amountPaid: 0, status: client_1.PaymentStatus.UNPAID, paidAt: null, verifiedById: null },
        { expenseId: expense1.id, userId: MAIN_USER_ID, requiredFee: 300000, amountPaid: 300000, status: client_1.PaymentStatus.PAID, paidAt: getRelativeDate(-16, '00:00:00.000'), verifiedById: MAIN_USER_ID },
        { expenseId: expense2.id, userId: BOOKER_2_ID, requiredFee: 100000, amountPaid: 0, status: client_1.PaymentStatus.UNPAID, paidAt: null, verifiedById: null },
        { expenseId: expense2.id, userId: BOOKER_3_ID, requiredFee: 100000, amountPaid: 0, status: client_1.PaymentStatus.UNPAID, paidAt: null, verifiedById: null },
        { expenseId: expense2.id, userId: MAIN_USER_ID, requiredFee: 100000, amountPaid: 100000, status: client_1.PaymentStatus.PAID, paidAt: getRelativeDate(-13, '00:00:00.000'), verifiedById: OWNER_USER_ID },
    ];
    for (const p of paymentsData) {
        await prisma.groupPayment.upsert({
            where: { expenseId_userId: { expenseId: p.expenseId, userId: p.userId } },
            update: p,
            create: p,
        });
    }
    console.log('Seeding transactions...');
    const transactionsData = [
        { id: 'd185e35e-c151-419b-90f7-6bc1f82f2c81', groupId: GROUP_ID, userId: BOOKER_1_ID, amount: 450000, receiptUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=500', status: client_1.TransactionStatus.VERIFIED, verifiedById: MAIN_USER_ID, createdAt: getRelativeDate(-15, '09:45:00.000') },
        { id: 'd185e35e-c151-419b-90f7-6bc1f82f2c82', groupId: GROUP_ID, userId: BOOKER_2_ID, amount: 150000, receiptUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=500', status: client_1.TransactionStatus.VERIFIED, verifiedById: MAIN_USER_ID, createdAt: getRelativeDate(-14, '14:20:00.000') },
        { id: 'd185e35e-c151-419b-90f7-6bc1f82f2c83', groupId: GROUP_ID, userId: BOOKER_3_ID, amount: 50000, receiptUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=500', status: client_1.TransactionStatus.VERIFIED, verifiedById: MAIN_USER_ID, createdAt: getRelativeDate(-14, '16:10:00.000') },
        { id: 'd185e35e-c151-419b-90f7-6bc1f82f2c84', groupId: GROUP_ID, userId: BOOKER_2_ID, amount: 250000, receiptUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=500', status: client_1.TransactionStatus.PENDING_REVIEW, verifiedById: null, createdAt: getRelativeDate(-5, '08:00:00.000') },
        { id: 'd185e35e-c151-419b-90f7-6bc1f82f2c85', groupId: GROUP_ID, userId: BOOKER_3_ID, amount: 400000, receiptUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=500', status: client_1.TransactionStatus.PENDING_REVIEW, verifiedById: null, createdAt: getRelativeDate(-5, '09:30:00.000') },
    ];
    for (const t of transactionsData) {
        await prisma.groupTransaction.upsert({
            where: { id: t.id },
            update: { amount: t.amount, receiptUrl: t.receiptUrl, status: t.status, verifiedById: t.verifiedById },
            create: t,
        });
    }
    console.log('Seeding activities...');
    const activitiesData = [
        {
            id: 'a0000001-a000-4000-8000-000000000001',
            groupId: GROUP_ID,
            title: 'Giao lưu Pickleball cuối tuần',
            description: 'Mọi người tập trung tại sân Vòm để đánh giao lưu nhé.',
            location: 'Sân Pickleball Vòm',
            activityType: client_1.GroupActivityType.MEETUP,
            startAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
            endAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
            remindAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 - 60 * 60 * 1000),
            status: client_1.GroupActivityStatus.SCHEDULED,
            isReminderSent: false,
            createdById: MAIN_USER_ID,
        },
        {
            id: 'a0000002-a000-4000-8000-000000000002',
            groupId: GROUP_ID,
            title: 'Tập luyện nâng cao kỹ thuật',
            description: 'Buổi tập luyện với HLV chuyên nghiệp.',
            location: 'Sân K34',
            activityType: client_1.GroupActivityType.PRACTICE,
            startAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            endAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
            remindAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000),
            status: client_1.GroupActivityStatus.SCHEDULED,
            isReminderSent: false,
            createdById: MAIN_USER_ID,
        },
        {
            id: 'a0000003-a000-4000-8000-000000000003',
            groupId: GROUP_ID,
            title: 'Họp mặt ban quản trị nhóm',
            description: 'Họp bàn về kinh phí và giải đấu nội bộ sắp tới.',
            location: 'Quán Cafe Highlands gần sân',
            activityType: client_1.GroupActivityType.MEETING,
            startAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            endAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000),
            remindAt: null,
            status: client_1.GroupActivityStatus.COMPLETED,
            isReminderSent: true,
            createdById: OWNER_USER_ID,
        }
    ];
    for (const a of activitiesData) {
        await prisma.groupActivity.upsert({
            where: { id: a.id },
            update: a,
            create: a,
        });
    }
    console.log('Seeding equipment...');
    const expenseEquip = await prisma.groupExpense.upsert({
        where: { id: EXPENSE_EQUIP_ID },
        update: {
            title: 'Mua vật dụng: Bóng Dura 40+',
            description: 'Mua 1 hộp bóng 12 quả phục vụ luyện tập hàng tuần.',
            totalAmount: 180000,
            expenseDate: getRelativeDate(-10, '00:00:00.000'),
            createdById: MAIN_USER_ID,
        },
        create: {
            id: EXPENSE_EQUIP_ID,
            groupId: GROUP_ID,
            title: 'Mua vật dụng: Bóng Dura 40+',
            description: 'Mua 1 hộp bóng 12 quả phục vụ luyện tập hàng tuần.',
            totalAmount: 180000,
            expenseDate: getRelativeDate(-10, '00:00:00.000'),
            createdById: MAIN_USER_ID,
        },
    });
    const equipPaymentsData = [
        { expenseId: expenseEquip.id, userId: MAIN_USER_ID, requiredFee: 36000, amountPaid: 36000, status: client_1.PaymentStatus.PAID, paidAt: getRelativeDate(-10, '08:00:00.000'), verifiedById: MAIN_USER_ID },
        { expenseId: expenseEquip.id, userId: OWNER_USER_ID, requiredFee: 36000, amountPaid: 36000, status: client_1.PaymentStatus.PAID, paidAt: getRelativeDate(-9, '09:00:00.000'), verifiedById: MAIN_USER_ID },
        { expenseId: expenseEquip.id, userId: BOOKER_1_ID, requiredFee: 36000, amountPaid: 36000, status: client_1.PaymentStatus.PAID, paidAt: getRelativeDate(-9, '10:00:00.000'), verifiedById: MAIN_USER_ID },
        { expenseId: expenseEquip.id, userId: BOOKER_2_ID, requiredFee: 36000, amountPaid: 0, status: client_1.PaymentStatus.UNPAID, paidAt: null, verifiedById: null },
        { expenseId: expenseEquip.id, userId: BOOKER_3_ID, requiredFee: 36000, amountPaid: 18000, status: client_1.PaymentStatus.PARTIALLY_PAID, paidAt: null, verifiedById: null },
    ];
    for (const p of equipPaymentsData) {
        await prisma.groupPayment.upsert({
            where: { expenseId_userId: { expenseId: p.expenseId, userId: p.userId } },
            update: p,
            create: p,
        });
    }
    await prisma.groupEquipment.upsert({
        where: { id: EQUIP_BALL_ID },
        update: {
            name: 'Bóng Dura 40+',
            description: 'Hộp 12 quả dùng cho buổi luyện tập hàng tuần. Tổng chi phí hộp: 180 000 ₫.',
            quantity: 12,
            condition: client_1.EquipmentCondition.WORN,
            purchaseCost: 180000,
            purchasedAt: getRelativeDate(-10, '08:00:00.000'),
            expenseId: expenseEquip.id,
            createdById: MAIN_USER_ID,
        },
        create: {
            id: EQUIP_BALL_ID,
            groupId: GROUP_ID,
            name: 'Bóng Dura 40+',
            description: 'Hộp 12 quả dùng cho buổi luyện tập hàng tuần. Tổng chi phí hộp: 180 000 ₫.',
            quantity: 12,
            condition: client_1.EquipmentCondition.WORN,
            purchaseCost: 180000,
            purchasedAt: getRelativeDate(-10, '08:00:00.000'),
            expenseId: expenseEquip.id,
            createdById: MAIN_USER_ID,
        },
    });
    await prisma.groupEquipment.upsert({
        where: { id: EQUIP_PADDLE_ID },
        update: {
            name: 'Vợt tập luyện Joola Ben Johns',
            description: 'Bộ 2 vợt dự phòng cho thành viên mới chưa có vợt riêng. Không chia phí.',
            quantity: 2,
            condition: client_1.EquipmentCondition.GOOD,
            purchaseCost: 1400000,
            purchasedAt: getRelativeDate(-30, '08:00:00.000'),
            expenseId: null,
            createdById: MAIN_USER_ID,
        },
        create: {
            id: EQUIP_PADDLE_ID,
            groupId: GROUP_ID,
            name: 'Vợt tập luyện Joola Ben Johns',
            description: 'Bộ 2 vợt dự phòng cho thành viên mới chưa có vợt riêng. Không chia phí.',
            quantity: 2,
            condition: client_1.EquipmentCondition.GOOD,
            purchaseCost: 1400000,
            purchasedAt: getRelativeDate(-30, '08:00:00.000'),
            expenseId: null,
            createdById: MAIN_USER_ID,
        },
    });
    console.log('Seeding equipment usage logs...');
    const usageLogsData = [
        {
            id: 'a1000001-a100-4000-8000-000000000001',
            groupId: GROUP_ID,
            equipmentId: EQUIP_BALL_ID,
            quantityUsed: 4,
            note: 'Buổi luyện tập thứ 7 — 2 quả bị nứt sau khi đánh mạnh.',
            usedAt: getRelativeDate(-8, '08:30:00.000'),
            loggedById: MAIN_USER_ID,
        },
        {
            id: 'a1000002-a100-4000-8000-000000000002',
            groupId: GROUP_ID,
            equipmentId: EQUIP_BALL_ID,
            quantityUsed: 3,
            note: 'Buổi giao lưu cuối tuần. Bóng còn ổn.',
            usedAt: getRelativeDate(-3, '09:00:00.000'),
            loggedById: MAIN_USER_ID,
        },
        {
            id: 'a1000003-a100-4000-8000-000000000003',
            groupId: GROUP_ID,
            equipmentId: EQUIP_BALL_ID,
            quantityUsed: 5,
            note: 'Thi đấu nội bộ — 1 quả thất lạc, 2 quả bị móp. Cần mua thêm hộp mới.',
            usedAt: getRelativeDate(-1, '15:00:00.000'),
            loggedById: MAIN_USER_ID,
        },
    ];
    for (const ul of usageLogsData) {
        await prisma.groupEquipmentUsageLog.upsert({
            where: { id: ul.id },
            update: { quantityUsed: ul.quantityUsed, note: ul.note, usedAt: ul.usedAt },
            create: ul,
        });
    }
    console.log('Seeding guests...');
    const mainMember = await prisma.groupMember.findUnique({
        where: { userId_groupId: { userId: MAIN_USER_ID, groupId: GROUP_ID } }
    });
    const booker1Member = await prisma.groupMember.findUnique({
        where: { userId_groupId: { userId: BOOKER_1_ID, groupId: GROUP_ID } }
    });
    const guest1 = await prisma.groupGuest.upsert({
        where: { id: '8f000001-8000-4000-8000-000000000000' },
        update: {
            name: 'Nguyen Van Khach A',
            email: 'khach.a@example.com',
            skillLevel: 'INTERMEDIATE',
            phone: '0987654321',
            gender: 'MALE',
            invitedById: mainMember.id,
            status: 'ACTIVE',
        },
        create: {
            id: '8f000001-8000-4000-8000-000000000000',
            groupId: GROUP_ID,
            name: 'Nguyen Van Khach A',
            email: 'khach.a@example.com',
            skillLevel: 'INTERMEDIATE',
            phone: '0987654321',
            gender: 'MALE',
            invitedById: mainMember.id,
            status: 'ACTIVE',
        }
    });
    const guest2 = await prisma.groupGuest.upsert({
        where: { id: '8f000002-8000-4000-8000-000000000000' },
        update: {
            name: 'Tran Khach B',
            email: 'khach.b@example.com',
            skillLevel: 'BEGINNER',
            phone: '0912345678',
            gender: 'FEMALE',
            invitedById: booker1Member.id,
            status: 'INACTIVE',
        },
        create: {
            id: '8f000002-8000-4000-8000-000000000000',
            groupId: GROUP_ID,
            name: 'Tran Khach B',
            email: 'khach.b@example.com',
            skillLevel: 'BEGINNER',
            phone: '0912345678',
            gender: 'FEMALE',
            invitedById: booker1Member.id,
            status: 'INACTIVE',
        }
    });
    const guest3 = await prisma.groupGuest.upsert({
        where: { id: '8f000003-8000-4000-8000-000000000000' },
        update: {
            name: 'Le Khach C',
            email: 'khach.c@example.com',
            skillLevel: 'ADVANCED',
            phone: '0977665544',
            gender: 'MALE',
            invitedById: booker1Member.id,
            status: 'PENDING_APPROVAL',
        },
        create: {
            id: '8f000003-8000-4000-8000-000000000000',
            groupId: GROUP_ID,
            name: 'Le Khach C',
            email: 'khach.c@example.com',
            skillLevel: 'ADVANCED',
            phone: '0977665544',
            gender: 'MALE',
            invitedById: booker1Member.id,
            status: 'PENDING_APPROVAL',
        }
    });
    console.log('Seeding guest payments...');
    await prisma.groupGuestPayment.upsert({
        where: { expenseId_guestId: { expenseId: EXPENSE_1_ID, guestId: guest1.id } },
        update: {
            billedToId: mainMember.id,
            requiredFee: 100000,
            amountPaid: 100000,
            status: client_1.PaymentStatus.PAID,
            paidAt: getRelativeDate(-16, '00:00:00.000'),
        },
        create: {
            expenseId: EXPENSE_1_ID,
            guestId: guest1.id,
            billedToId: mainMember.id,
            requiredFee: 100000,
            amountPaid: 100000,
            status: client_1.PaymentStatus.PAID,
            paidAt: getRelativeDate(-16, '00:00:00.000'),
        }
    });
    console.log('Group-service seed completed successfully.');
}
main()
    .then(async () => {
    await prisma.$disconnect();
})
    .catch(async (error) => {
    console.error('Failed to seed group-service:', error);
    await prisma.$disconnect();
    process.exit(1);
});
//# sourceMappingURL=seed.js.map