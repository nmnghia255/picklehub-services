export type ActivityType =
  | 'BOOKING'            // Đặt sân tự do
  | 'SOCIAL_SESSION'     // Buổi chơi giao lưu
  | 'LEARNING_SESSION'   // Buổi học từ coach-service (class hoặc private booking)
  | 'MATCH_PRACTICE'     // Trận đấu tập tự do (match-service)
  | 'MATCH_TOURNAMENT'   // Trận đấu giải (tournament-service)
  | 'TOURNAMENT'         // Giải đấu đã đăng ký tham gia
  | 'COACHING_SESSION';  // Buổi dạy của coach (class hoặc private booking)

export type ActivityStatus =
  | 'UPCOMING'
  | 'LIVE'
  | 'PENDING_CONFIRM'
  | 'COMPLETED'
  | 'CANCELLED';

export interface UnifiedCalendarItem {
  id: string;               // ID gốc của hoạt động
  type: ActivityType;
  title: string;            // Tiêu đề hiển thị (Ví dụ: "Đấu tập đơn nam với Huy", "Đặt sân 2 - Kỳ Hòa")
  description?: string;     // Ghi chú hoặc mô tả chi tiết
  startTime: string;        // Định dạng ISO 8601 (UTC)
  endTime: string;          // Định dạng ISO 8601 (UTC)
  location: {
    name: string;           // Tên địa điểm
    address?: string;       // Địa chỉ cụ thể
    centerId?: string;      // ID trung tâm thể thao (nếu có)
  };
  status: ActivityStatus;   // Trạng thái đã được quy đổi thống nhất
  role: 'HOST' | 'PLAYER' | 'LEARNER' | 'REFEREE' | 'ORGANIZER' | 'COACH'; // Vai trò của User trong hoạt động
  metadata: {               // Các thông tin tùy biến riêng cho từng loại hoạt động
    bookingId?: string;
    socialId?: string;
    matchId?: string;
    tournamentId?: string;
    classId?: string;
    coachProfileId?: string;
    learnerProfileId?: string;
    sourceType?: 'class' | 'booking';
    score?: string;         // Tỷ số trận đấu (nếu là MATCH)
    opponentNames?: string[]; // Tên đối thủ
    partnerName?: string;   // Tên đồng đội (đấu đôi)
    paymentStatus?: string; // Trạng thái thanh toán
  };
}
