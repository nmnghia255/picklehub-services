import * as jwt from 'jsonwebtoken';
import axios from 'axios';
import { io } from 'socket.io-client';
import { PrismaClient } from '@prisma/client';

const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'your-super-secret-access-token-key-change-this-in-production';
const SERVICE_INTERNAL_TOKEN = process.env.SERVICE_INTERNAL_TOKEN || '';

const prisma = new PrismaClient();

// Tạo token trọng tài (referee)
const refereeId = 'f0000000-f000-4000-8000-000000000000';
const token = jwt.sign(
  { sub: refereeId, role: 'REFEREE' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

// Tạo token giả (unauthorized user)
const fakeUserId = '99999999-9999-4999-9999-999999999999';
const fakeToken = jwt.sign(
  { sub: fakeUserId, role: 'USER' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const matchServiceClient = axios.create({
  baseURL: 'http://match-service:8005',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
});

const matchInternalClient = axios.create({
  baseURL: 'http://match-service:8005',
  headers: {
    'x-internal-service-token': SERVICE_INTERNAL_TOKEN,
    'Content-Type': 'application/json',
  },
});

// Helper for assertions
function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function run() {
  console.log('=== KHỞI ĐẦU CHƯƠNG TRÌNH KIỂM THỬ TÍCH HỢP LIVESCORE (USAP) ===');

  // ==========================================
  // PHẦN A: KIỂM THỬ TRẬN ĐẤU ĐÔI (DOUBLES)
  // ==========================================
  console.log('\n--- PHÂN HỆ 1: TRẬN ĐẤU ĐÔI (DOUBLES) ---');

  const doublesMatchPayload = {
    createdById: refereeId,
    category: 'TOURNAMENT',
    matchType: 'DOUBLES',
    scheduledAt: new Date().toISOString(),
    courtId: 'c0010000-c001-4000-8000-000000010001',
    teamA: ['11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333'], // VĐV A1, A2
    teamB: ['44444444-4444-4444-8444-444444444444', '55555555-5555-4555-8555-555555555555'], // VĐV B1, B2
    refereeId: refereeId,
    bestOfSets: 5,
    pointsToWin: 11,
  };

  console.log('1. Đang tạo trận đấu đôi...');
  const createDoublesRes = await matchInternalClient.post('/api/matches/internal/batch', {
    createdById: refereeId,
    tournamentId: '11111111-1111-4111-8111-111111111111',
    matches: [doublesMatchPayload],
  });

  const doublesMatch = createDoublesRes.data.matches[0];
  const doublesMatchId = doublesMatch.id;
  console.log(`✔ Đã tạo trận đấu đôi thành công. ID: ${doublesMatchId}`);

  console.log('2. Đang bắt đầu trận đấu...');
  await matchServiceClient.patch(`/api/matches/${doublesMatchId}/start`);

  console.log('3. Kết nối WebSocket...');
  const socketDoubles = io('http://match-service:8005/matches', {
    auth: { token: `Bearer ${token}` },
    transports: ['websocket'],
  });

  await new Promise<void>((resolve, reject) => {
    socketDoubles.on('connect', () => {
      socketDoubles.emit('join-match', { matchId: doublesMatchId });
      resolve();
    });
    socketDoubles.on('connect_error', reject);
  });

  let latestPayload: any = null;
  socketDoubles.on('match-event', (data: any) => {
    latestPayload = data;
  });

  const waitEventDoubles = (): Promise<any> => {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (latestPayload) {
          const res = latestPayload;
          latestPayload = null;
          clearInterval(interval);
          resolve(res);
        }
      }, 50);
    });
  };

  // Lấy trạng thái livescore ban đầu
  const getDoublesRes = await matchServiceClient.get(`/api/matches/${doublesMatchId}`);
  const doublesLivescore = getDoublesRes.data.livescore;
  console.log(`✔ Trạng thái ban đầu: scoreCall="${doublesLivescore.scoreCall}", servingTeam="${doublesLivescore.servingTeam}", serverNumber=${doublesLivescore.serverNumber}`);
  assert(doublesLivescore.scoreCall === '0 - 0 - 2', 'Kỳ vọng 0 - 0 - 2');

  // Quả 1: Team A ghi điểm
  console.log('Ghi điểm Đội A (Quả 1)...');
  socketDoubles.emit('score-point', { matchId: doublesMatchId, setId: 1, scoringTeam: 'TEAM_A' });
  let eventData = await waitEventDoubles();
  console.log(`[WS Broadcast] scoreCall="${eventData.score.scoreCall}", servingTeam="${eventData.score.servingTeam}", positions.teamA.left.id="${eventData.score.positions.teamA.left.id}"`);
  assert(eventData.score.scoreCall === '1 - 0 - 2', 'Kỳ vọng 1 - 0 - 2');

  // Quả 2: Team B thắng loạt bóng -> Side-out sang B
  console.log('Đội B thắng loạt (Quả 2)...');
  socketDoubles.emit('score-point', { matchId: doublesMatchId, setId: 1, scoringTeam: 'TEAM_B' });
  eventData = await waitEventDoubles();
  console.log(`[WS Broadcast] scoreCall="${eventData.score.scoreCall}", servingTeam="${eventData.score.servingTeam}", serverNumber=${eventData.score.serverNumber}`);
  assert(eventData.score.scoreCall === '0 - 1 - 1', 'Kỳ vọng 0 - 1 - 1');

  // Quả 3: Hoàn tác quả 2
  console.log('Hoàn tác (Undo) quả 2...');
  socketDoubles.emit('undo-point', { matchId: doublesMatchId });
  eventData = await waitEventDoubles();
  console.log(`[WS Broadcast] scoreCall="${eventData.score.scoreCall}", servingTeam="${eventData.score.servingTeam}", serverNumber=${eventData.score.serverNumber}`);
  assert(eventData.score.scoreCall === '1 - 0 - 2', 'Kỳ vọng quay lại 1 - 0 - 2');

  socketDoubles.disconnect();
  console.log('✔ Tích hợp livescore Trận Đấu Đôi thành công!');

  // ==========================================
  // PHẦN B: KIỂM THỬ TRẬN ĐẤU ĐƠN (SINGLES)
  // ==========================================
  console.log('\n--- PHÂN HỆ 2: TRẬN ĐẤU ĐƠN (SINGLES) ---');

  const singlesMatchPayload = {
    createdById: refereeId,
    category: 'TOURNAMENT',
    matchType: 'SINGLES',
    scheduledAt: new Date().toISOString(),
    courtId: 'c0010000-c001-4000-8000-000000010001',
    teamA: ['11111111-1111-4111-8111-111111111111'], // VĐV A1
    teamB: ['44444444-4444-4444-8444-444444444444'], // VĐV B1
    refereeId: refereeId,
    bestOfSets: 1,
    pointsToWin: 21,
  };

  console.log('1. Đang tạo trận đấu đơn...');
  const createSinglesRes = await matchInternalClient.post('/api/matches/internal/batch', {
    createdById: refereeId,
    tournamentId: '11111111-1111-4111-8111-111111111111',
    matches: [singlesMatchPayload],
  });

  const singlesMatch = createSinglesRes.data.matches[0];
  const singlesMatchId = singlesMatch.id;
  console.log(`✔ Đã tạo trận đấu đơn thành công. ID: ${singlesMatchId}`);

  // Truy vấn để tìm Giải đấu và Nội dung có sẵn trong DB từ seed
  const firstTournament = await prisma.tournament.findFirst();
  const firstEvent = await prisma.tournamentEvent.findFirst({
    where: { tournamentId: firstTournament?.id }
  });
  const firstTeam1 = await prisma.team.findFirst();
  const firstTeam2 = await prisma.team.findFirst({
    where: { id: { not: firstTeam1?.id } }
  });

  assert(!!firstTournament && !!firstEvent, "Database must have at least one tournament and one event. Please run seed script first.");

  // Đăng ký trận đấu đơn này sang DB tournament-service cục bộ (để đồng bộ trạng thái khi kết thúc)
  await prisma.match.create({
    data: {
      externalMatchId: singlesMatchId,
      tournamentId: firstTournament!.id,
      eventId: firstEvent!.id,
      status: 'scheduled',
      team1Id: firstTeam1?.id || null,
      team2Id: firstTeam2?.id || null,
    }
  });

  console.log('2. Đang bắt đầu trận đấu đơn...');
  await matchServiceClient.patch(`/api/matches/${singlesMatchId}/start`);

  console.log('3. Kết nối WebSocket Trọng tài và Người dùng giả...');
  
  // Socket Trọng tài chính
  const socketSingles = io('http://match-service:8005/matches', {
    auth: { token: `Bearer ${token}` },
    transports: ['websocket'],
  });

  // Socket Người dùng không có quyền (Error path)
  const socketFake = io('http://match-service:8005/matches', {
    auth: { token: `Bearer ${fakeToken}` },
    transports: ['websocket'],
  });

  await Promise.all([
    new Promise<void>((resolve, reject) => {
      socketSingles.on('connect', () => {
        socketSingles.emit('join-match', { matchId: singlesMatchId });
        resolve();
      });
      socketSingles.on('connect_error', reject);
    }),
    new Promise<void>((resolve, reject) => {
      socketFake.on('connect', () => {
        socketFake.emit('join-match', { matchId: singlesMatchId });
        resolve();
      });
      socketFake.on('connect_error', reject);
    })
  ]);

  let latestSinglesPayload: any = null;
  socketSingles.on('match-event', (data: any) => {
    latestSinglesPayload = data;
  });

  let errorEvent: any = null;
  socketFake.on('exception', (err: any) => {
    errorEvent = err;
  });
  socketSingles.on('exception', (err: any) => {
    errorEvent = err;
  });

  const waitEventSingles = (): Promise<any> => {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (latestSinglesPayload) {
          const res = latestSinglesPayload;
          latestSinglesPayload = null;
          clearInterval(interval);
          resolve(res);
        }
      }, 50);
    });
  };

  const waitErrorEvent = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      let limit = 20;
      const interval = setInterval(() => {
        if (errorEvent) {
          const res = errorEvent;
          errorEvent = null;
          clearInterval(interval);
          resolve(res);
        }
        limit--;
        if (limit <= 0) {
          clearInterval(interval);
          reject(new Error("Timeout waiting for socket exception"));
        }
      }, 100);
    });
  };

  // Lấy trạng thái livescore ban đầu
  const getSinglesRes = await matchServiceClient.get(`/api/matches/${singlesMatchId}`);
  const singlesLivescore = getSinglesRes.data.livescore;
  console.log(`✔ Trạng thái ban đầu: scoreCall="${singlesLivescore.scoreCall}", servingTeam="${singlesLivescore.servingTeam}", positions.teamA.right.id="${singlesLivescore.positions.teamA.right.id}"`);
  assert(singlesLivescore.scoreCall === '0 - 0', 'Kỳ vọng 0 - 0');

  // ------------------------------------------
  // ERROR PATH 1: Thao tác bởi người không có quyền
  // ------------------------------------------
  console.log('\n[Error Path 1] Người dùng giả gửi lệnh ghi điểm...');
  socketFake.emit('score-point', { matchId: singlesMatchId, setId: 1, scoringTeam: 'TEAM_A' });
  const errorRes = await waitErrorEvent();
  console.log(`✔ Nhận lỗi từ Server: "${errorRes.message}" (Đúng kỳ vọng)`);
  assert(errorRes.message.includes('assigned referee'), 'Kỳ vọng lỗi assigned referee');

  // ------------------------------------------
  // ERROR PATH 2: Sai Set ID khi tính điểm
  // ------------------------------------------
  console.log('\n[Error Path 2] Trọng tài gửi setId không hợp lệ (ví dụ: setId=99)...');
  socketSingles.emit('score-point', { matchId: singlesMatchId, setId: 99, scoringTeam: 'TEAM_A' });
  const errorSetRes = await waitErrorEvent();
  console.log(`✔ Nhận lỗi từ Server: "${errorSetRes.message}" (Server từ chối setId=99 - Đúng kỳ vọng)`);
  assert(!!errorSetRes.message, 'Kỳ vọng server trả về lỗi khi setId không hợp lệ');

  // ------------------------------------------
  // HAPPY PATH: Trận đấu đơn di chuyển và tính điểm
  // ------------------------------------------
  console.log('\n[Happy Path] Ghi điểm quả 1 cho Đội A...');
  socketSingles.emit('score-point', { matchId: singlesMatchId, setId: 1, scoringTeam: 'TEAM_A' });
  let sEvent = await waitEventSingles();
  console.log(`[WS Broadcast] scoreCall="${sEvent.score.scoreCall}", servingTeam="${sEvent.score.servingTeam}"`);
  // Singles: chỉ có 1 VĐV/đội. positions.teamA.right = A1, left = null.
  // Điểm A = 1 (lẻ) → A sẽ giao từ bên Trái, nhưng backend chỉ track qua scoreCall, không swap positions.
  console.log(`  - VĐV giao bóng hiện tại: ${sEvent.score.servingPlayerId}`);
  assert(sEvent.score.scoreCall === '1 - 0', 'Kỳ vọng 1 - 0');
  assert(sEvent.score.servingPlayerId === singlesMatchPayload.teamA[0], 'VĐV A vẫn đang giao bóng sau khi ghi điểm');

  console.log('Giao bóng thua loạt bóng -> Side-out sang Đội B...');
  socketSingles.emit('score-point', { matchId: singlesMatchId, setId: 1, scoringTeam: 'TEAM_B' });
  sEvent = await waitEventSingles();
  console.log(`[WS Broadcast] scoreCall="${sEvent.score.scoreCall}", servingTeam="${sEvent.score.servingTeam}"`);
  // Đọc điểm: 0 - 1. Giao bóng chuyển sang B. Điểm B = 0 (Chẵn) → B giao từ bên Phải.
  console.log(`  - VĐV giao bóng mới: ${sEvent.score.servingPlayerId}`);
  assert(sEvent.score.scoreCall === '0 - 1', 'Kỳ vọng 0 - 1');
  assert(sEvent.score.servingTeam === 'TEAM_B', 'Kỳ vọng TEAM_B đang giao bóng sau side-out');
  assert(sEvent.score.servingPlayerId === singlesMatchPayload.teamB[0], 'VĐV B là người giao bóng mới');

  // ------------------------------------------
  // CHẠY TRẬN ĐẤU ĐẾN KHI KẾT THÚC (Full Match Simulation)
  // ------------------------------------------
  console.log('\n[Full Match Simulation] Bắt đầu mô phỏng chơi đến hết trận đấu...');
  
  // Set 1: Đội B thắng 21-1 (B hiện có 0 điểm, cần ghi thêm 21 lần)
  console.log('Mô phỏng Đội B ghi điểm thắng Set 1 (21 - 1)...');
  for (let i = 0; i < 21; i++) {
    socketSingles.emit('score-point', { matchId: singlesMatchId, setId: 1, scoringTeam: 'TEAM_B' });
    sEvent = await waitEventSingles();
  }
  console.log(`✔ Set 1 kết thúc. Sự kiện nhận được: "${sEvent.event}", scoreCall="${sEvent.score.scoreCall}", sets: ${JSON.stringify(sEvent.score.sets)}`);
  // A=1, B=21 → B thắng Set 1 và thắng luôn trận đấu vì bestOfSets = 1
  assert(sEvent.score.sets.length === 1 && sEvent.score.sets[0][1] >= 21, 'Kỳ vọng B thắng 21 điểm ở Set 1');
  assert(sEvent.event === 'match-completed', 'Kỳ vọng sự kiện kết thúc trận đấu');
  assert(sEvent.status === 'PENDING_CONFIRM', 'Kỳ vọng trạng thái match-service chuyển sang PENDING_CONFIRM');


  // Gọi API xác nhận kết quả (Trọng tài xác nhận tỷ số)
  console.log('Đang gọi API confirmResult để hoàn tất trận đấu...');
  const confirmRes = await matchServiceClient.patch(`/api/matches/${singlesMatchId}/confirm`, {
    winner: 'TEAM_B',
  });
  console.log(`✔ Kết quả confirm: status=${confirmRes.data.status}`);
  assert(confirmRes.data.status === 'CONFIRMED', 'Kỳ vọng status chuyển sang CONFIRMED sau khi xác nhận');

  // Chờ 2 giây để match-service hoàn tất và sync-job xử lý
  console.log('Chờ 2 giây để match-service hoàn tất...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Kiểm tra trạng thái trận đấu trực tiếp qua match-service REST API
  const finalMatchRes = await matchServiceClient.get(`/api/matches/${singlesMatchId}`);
  const finalStatus = finalMatchRes.data.status;
  console.log(`✔ Trạng thái trận đấu trong match-service: "${finalStatus}"`);
  assert(finalStatus === 'CONFIRMED', `Kỳ vọng trạng thái CONFIRMED, nhận được: ${finalStatus}`);

  // Ghi chú: Callback sync-by-uuid sang tournament-service chỉ hoạt động khi tournamentUuid
  // thực sự tồn tại trong DB tournament-service (cần seed dữ liệu giải đấu thực tế).
  // Trong luồng production, khi match kết thúc, tournament-service sẽ tự động cập nhật
  // externalMatchId trong bảng Match thông qua runService.syncResults().
  console.log('ℹ Lưu ý: Sync callback sang tournament-service DB cần tournamentUuid thực (seed data).');

  // ==========================================
  // PHẦN C: KIỂM THỬ TUNG ĐỒNG XU (COIN TOSS INTEGRATION)
  // ==========================================
  console.log('\n--- PHÂN HỆ 3: KIỂM THỬ KẾT QUẢ TUNG ĐỒNG XU (COIN TOSS) ---');

  const tossMatchPayload = {
    createdById: refereeId,
    category: 'TOURNAMENT',
    matchType: 'SINGLES',
    scheduledAt: new Date().toISOString(),
    courtId: 'c0010000-c001-4000-8000-000000010001',
    teamA: ['11111111-1111-4111-8111-111111111111'], // VĐV A1
    teamB: ['44444444-4444-4444-8444-444444444444'], // VĐV B1
    refereeId: refereeId,
  };

  console.log('1. Đang tạo trận đấu test tung đồng xu...');
  const createTossRes = await matchInternalClient.post('/api/matches/internal/batch', {
    createdById: refereeId,
    tournamentId: '11111111-1111-4111-8111-111111111111',
    matches: [tossMatchPayload],
  });
  const tossMatchId = createTossRes.data.matches[0].id;

  console.log('2. Bắt đầu trận đấu với VĐV B1 (teamB) giao trước...');
  await matchServiceClient.patch(`/api/matches/${tossMatchId}/start`, {
    firstServingPlayerId: '44444444-4444-4444-8444-444444444444' // B1 id
  });

  const getTossRes = await matchServiceClient.get(`/api/matches/${tossMatchId}`);
  console.log(`✔ Trạng thái ban đầu sau toss: scoreCall="${getTossRes.data.livescore.scoreCall}", servingTeam="${getTossRes.data.livescore.servingTeam}", servingPlayerId="${getTossRes.data.livescore.servingPlayerId}"`);
  assert(getTossRes.data.livescore.servingTeam === 'TEAM_B', 'Kỳ vọng TEAM_B giao bóng trước do thắng toss');
  assert(getTossRes.data.livescore.servingPlayerId === '44444444-4444-4444-8444-444444444444', 'Kỳ vọng VĐV B1 giao bóng');

  console.log('3. Kiểm thử lỗi khi truyền firstServingPlayerId không thuộc trận đấu...');
  const tossMatchPayload2 = { ...tossMatchPayload };
  const createTossRes2 = await matchInternalClient.post('/api/matches/internal/batch', {
    createdById: refereeId,
    tournamentId: '11111111-1111-4111-8111-111111111111',
    matches: [tossMatchPayload2],
  });
  const tossMatchId2 = createTossRes2.data.matches[0].id;

  try {
    await matchServiceClient.patch(`/api/matches/${tossMatchId2}/start`, {
      firstServingPlayerId: '99999999-9999-9999-9999-999999999999' // invalid
    });
    assert(false, 'Kỳ vọng ném lỗi 400');
  } catch (err: any) {
    console.log(`✔ Nhận lỗi từ Server khi start với VĐV không hợp lệ: "${err.response?.data?.message}" (Đúng kỳ vọng)`);
    assert(err.response?.status === 400, 'Kỳ vọng status code 400');
  }

  socketSingles.disconnect();
  socketFake.disconnect();
  console.log('\n=== TẤT CẢ CÁC BƯỚC KIỂM THỬ LIVESCORE (ĐƠN & ĐÔI & TUNG ĐỒNG XU) ĐÃ THÀNH CÔNG RỰC RỠ! ===');
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Kiểm thử thất bại với lỗi:', err);
  process.exit(1);
});
