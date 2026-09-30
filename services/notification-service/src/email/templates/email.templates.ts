/**
 * Simple template engine for email templates
 * Replaces {{variable}} placeholders with actual values
 */
export class TemplateEngine {
    /**
     * Renders a template by replacing placeholders with context values
     * @param template - Template string with {{placeholders}}
     * @param context - Object with values to replace placeholders
     * @returns Rendered template
     */
    static render(template: string, context: Record<string, any>): string {
        return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return context[key] !== undefined ? String(context[key]) : match;
        });
    }
}

/**
 * Email template structure
 */
export interface EmailTemplate {
    subject: string;
    html: string;
}

/**
 * Email template types
 */
export type EmailTemplateType = 'verification' | 'welcome_email' | 'reset_password' | 'invitation' | 'referee_invitation' | 'magic_link_invitation' | 'booking_confirmed' | 'booking_cancelled' | 'debt_reminder' | 'tournament_registration_approved' | 'tournament_registration_rejected' | 'tournament_match_reminder' | 'tournament_court_change' | 'tournament_announcement' | 'tournament_groups_drawn' | 'tournament_schedule_ready' | 'tournament_advance_knockout' | 'tournament_completed';

/**
 * Email templates
 */
export const EmailTemplates: Record<EmailTemplateType, EmailTemplate> = {
    verification: {
        subject: 'Xác thực email của bạn - PickleHub',
        html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .button { display: inline-block; padding: 12px 30px; background: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Chào mừng đến với PickleHub!</h1>
        </div>
        <div class="content">
            <p>Xin chào {{name}},</p>
            <p>Cảm ơn bạn đã đăng ký tài khoản tại PickleHub. Vui lòng xác thực địa chỉ email của bạn bằng cách nhấn vào nút dưới đây:</p>
            <p style="text-align: center;">
                <a href="{{verificationLink}}" class="button">Xác thực Email</a>
            </p>
            <p>Nếu bạn không thể nhấn vào nút xác thực, hãy sao chép và dán liên kết dưới đây vào thanh địa chỉ của trình duyệt:</p>
            <p><a href="{{verificationLink}}">{{verificationLink}}</a></p>
            <p>Liên kết này sẽ hết hạn trong 24 giờ.</p>
            <p>Nếu bạn không tạo tài khoản, vui lòng bỏ qua email này.</p>
        </div>
        <div class="footer">
            <p>&copy; 2026 PickleHub. Đã đăng ký Bản quyền.</p>
        </div>
    </div>
</body>
</html>
        `,
    },

    welcome_email: {
        subject: 'Chào mừng đến với PickleHub!',
        html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Chào mừng đến với PickleHub!</h1>
        </div>
        <div class="content">
            <p>Xin chào {{name}},</p>
            <p>Tài khoản của bạn đã được xác thực thành công. Bây giờ bạn có thể trải nghiệm tất cả các tính năng của PickleHub!</p>
            <p>Nếu bạn có bất kỳ câu hỏi nào, đừng ngần ngại liên hệ với đội ngũ hỗ trợ của chúng tôi.</p>
        </div>
        <div class="footer">
            <p>&copy; 2026 PickleHub. Đã đăng ký Bản quyền.</p>
        </div>
    </div>
</body>
</html>
        `,
    },

    invitation: {
        subject: 'Bạn đã được mời tham gia {{groupName}} trên PickleHub!',
        html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2196F3; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .button { display: inline-block; padding: 12px 30px; background: #2196F3; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Bạn Có Một Lời Mời!</h1>
        </div>
        <div class="content">
            <p>Xin chào,</p>
            <p><strong>{{inviterName}}</strong> đã mời bạn tham gia PickleHub{{groupSuffix}}.</p>
            <p style="text-align: center;">
                <a href="{{invitationLink}}" class="button">Chấp Nhận Lời Mời</a>
            </p>
            <p>Nếu bạn không thể nhấn vào nút chấp nhận lời mời, hãy sao chép và dán liên kết dưới đây vào thanh địa chỉ của trình duyệt:</p>
            <p><a href="{{invitationLink}}">{{invitationLink}}</a></p>
            <p>Liên kết mời này sẽ hết hạn trong 7 ngày.</p>
            <p>Nếu bạn không mong đợi lời mời này, bạn có thể bỏ qua email này một cách an toàn.</p>
        </div>
        <div class="footer">
            <p>&copy; 2026 PickleHub. Đã đăng ký Bản quyền.</p>
        </div>
    </div>
</body>
</html>
        `,
    },

    referee_invitation: {
        subject: 'Lời mời làm trọng tài cho giải đấu {{tournamentName}} trên PickleHub!',
        html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2196F3; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .button { display: inline-block; padding: 12px 30px; background: #2196F3; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Bạn Có Một Lời Mời Trọng Tài!</h1>
        </div>
        <div class="content">
            <p>Xin chào,</p>
            <p>Bạn đã được mời làm trọng tài cho giải đấu <strong>{{tournamentName}}</strong> trên PickleHub.</p>
            <p style="text-align: center;">
                <a href="{{invitationUrl}}" class="button">Chấp Nhận Lời Mời</a>
            </p>
            <p>Nếu bạn không thể nhấn vào nút chấp nhận lời mời, hãy sao chép và dán liên kết dưới đây vào thanh địa chỉ của trình duyệt:</p>
            <p><a href="{{invitationUrl}}">{{invitationUrl}}</a></p>
            <p>Liên kết mời này sẽ hết hạn trong 7 ngày.</p>
            <p>Nếu bạn không mong đợi lời mời này, bạn có thể bỏ qua email này một cách an toàn.</p>
        </div>
        <div class="footer">
            <p>&copy; 2026 PickleHub. Đã đăng ký Bản quyền.</p>
        </div>
    </div>
</body>
</html>
        `,
    },

    reset_password: {
        subject: 'Đặt lại mật khẩu của bạn - PickleHub',
        html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #FF5722; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .button { display: inline-block; padding: 12px 30px; background: #FF5722; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Yêu Cầu Đặt Lại Mật Khẩu</h1>
        </div>
        <div class="content">
            <p>Xin chào {{name}},</p>
            <p>Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu của bạn. Nhấn vào nút dưới đây để tạo mật khẩu mới:</p>
            <p style="text-align: center;">
                <a href="{{resetLink}}" class="button">Đặt Lại Mật Khẩu</a>
            </p>
            <p>Nếu bạn không thể nhấn vào nút đặt lại mật khẩu, hãy sao chép và dán liên kết dưới đây vào thanh địa chỉ của trình duyệt:</p>
            <p><a href="{{resetLink}}">{{resetLink}}</a></p>
            <p>Liên kết này sẽ hết hạn trong 1 giờ.</p>
            <p>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này hoặc liên hệ hỗ trợ nếu bạn có thắc mắc.</p>
        </div>
        <div class="footer">
            <p>&copy; 2026 PickleHub. Đã đăng ký Bản quyền.</p>
        </div>
    </div>
</body>
</html>
        `,
    },

    magic_link_invitation: {
        subject: 'Tham gia {{groupName}} trên PickleHub!',
        html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2196F3; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .highlight { background: #fff; padding: 15px; border-left: 4px solid #2196F3; margin: 20px 0; }
        .button { display: inline-block; padding: 12px 30px; background: #2196F3; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎾 Bạn Có Một Lời Mời Chơi!</h1>
        </div>
        <div class="content">
            <p>Xin chào,</p>
            <div class="highlight">
                <p><strong>Bạn đã được mời tham gia nhóm "{{groupName}}" trên PickleHub.</strong></p>
            </div>
            <p>Để tham gia nhóm và bắt đầu chơi, chỉ cần nhấn vào nút dưới đây:</p>
            <p style="text-align: center;">
                <a href="{{magicLink}}" class="button">Tham gia {{groupName}}</a>
            </p>
            <p>Nếu bạn không thể nhấn vào nút tham gia, hãy sao chép và dán liên kết dưới đây vào thanh địa chỉ của trình duyệt:</p>
            <p><a href="{{magicLink}}">{{magicLink}}</a></p>
            <p>Liên kết này sẽ hết hạn trong 1 giờ vì lý do bảo mật.</p>
            <p><strong>Điều gì tiếp theo?</strong></p>
            <ul>
                <li>Nhấn vào nút phía trên để truy cập lời mời của bạn</li>
                <li>Bạn sẽ tự động được thêm vào nhóm</li>
                <li>Bắt đầu kết nối với những người chơi pickleball khác!</li>
            </ul>
            <p>Nếu bạn không mong đợi lời mời này, bạn có thể bỏ qua email này một cách an toàn.</p>
        </div>
        <div class="footer">
            <p>&copy; 2026 PickleHub. Đã đăng ký Bản quyền.</p>
        </div>
    </div>
</body>
</html>
        `,
    },
    booking_confirmed: {
        subject: 'Xác nhận đặt sân - {{courtName}} - PickleHub',
        html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .highlight { background: #fff; padding: 15px; border-left: 4px solid #4CAF50; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ Đặt Sân Thành Công!</h1>
        </div>
        <div class="content">
            <p>Xin chào {{playerName}},</p>
            <p>Yêu cầu đặt sân của bạn tại <strong>{{centerName}}</strong> đã được chủ sân xác nhận.</p>
            <div class="highlight">
                <p><strong>Chi tiết đặt sân:</strong></p>
                <ul>
                    <li><strong>Ngày:</strong> {{date}}</li>
                    {{bookingDetailsHtml}}
                </ul>
            </div>
            <p>Chúc bạn có những giây phút chơi pickleball thật vui vẻ!</p>
            <p>Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ trực tiếp với sân qua ứng dụng PickleHub.</p>
        </div>
        <div class="footer">
            <p>&copy; 2026 PickleHub. Đã đăng ký Bản quyền.</p>
        </div>
    </div>
</body>
</html>
        `,
    },
    booking_cancelled: {
        subject: 'Thông báo hủy đặt sân - {{courtName}} - PickleHub',
        html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #F44336; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .highlight { background: #fff; padding: 15px; border-left: 4px solid #F44336; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>❌ Đặt Sân Đã Bị Hủy</h1>
        </div>
        <div class="content">
            <p>Xin chào {{playerName}},</p>
            <p>Rất tiếc, đơn đặt sân của bạn tại <strong>{{centerName}}</strong> đã bị hủy.</p>
            <div class="highlight">
                <p><strong>Chi tiết đặt sân đã hủy:</strong></p>
                <ul>
                    <li><strong>Ngày:</strong> {{date}}</li>
                    {{bookingDetailsHtml}}
                    <li><strong>Lý do:</strong> {{reason}}</li>
                </ul>
            </div>
            <p>Nếu bạn đã thanh toán, số tiền sẽ được hoàn trả theo chính sách của sân. Vui lòng liên hệ trực tiếp với sân nếu bạn cần hỗ trợ thêm.</p>
            <p>Hy vọng sẽ được phục vụ bạn vào dịp khác!</p>
        </div>
        <div class="footer">
            <p>&copy; 2026 PickleHub. Đã đăng ký Bản quyền.</p>
        </div>
    </div>
</body>
</html>
        `,
    },
    debt_reminder: {
        subject: 'Thông báo nhắc đóng phí nhóm {{groupName}} - PickleHub',
        html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #FF9800; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .highlight { background: #fff; padding: 15px; border-left: 4px solid #FF9800; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Thông Báo Nhắc Đóng Phí Nhóm</h1>
        </div>
        <div class="content">
            <p>Xin chào {{name}},</p>
            <p>Admin nhóm <strong>{{groupName}}</strong> vừa gửi thông báo nhắc bạn hoàn thành đóng phí sinh hoạt nhóm.</p>
            <div class="highlight">
                <p><strong>Thông tin nợ hiện tại:</strong></p>
                <ul>
                    <li><strong>Nhóm:</strong> {{groupName}}</li>
                    <li><strong>Số tiền cần đóng:</strong> <span style="color: #E53935; font-weight: bold;">{{debtAmount}} VND</span></li>
                </ul>
            </div>
            <p>Vui lòng đăng nhập vào ứng dụng PickleHub để kiểm tra chi tiết các khoản phí và hoàn thành thanh toán sớm nhất có thể.</p>
            <p>Cảm ơn sự đóng góp và hợp tác của bạn!</p>
        </div>
        <div class="footer">
            <p>&copy; 2026 PickleHub. Đã đăng ký Bản quyền.</p>
        </div>
    </div>
</body>
</html>
        `,
    },
    tournament_registration_approved: {
        subject: '🎉 Đăng ký giải đấu của bạn đã được duyệt - {{tournamentName}}',
        html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; text-align: center; }
        .button { display: inline-block; background-color: #4CAF50; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 Đăng Ký Được Duyệt!</h1>
        </div>
        <div class="content">
            <p>Xin chào {{playerName}},</p>
            <p>Chúc mừng bạn! Yêu cầu đăng ký tham gia nội dung <strong>{{eventName}}</strong> tại giải đấu <strong>{{tournamentName}}</strong> của bạn đã được Ban tổ chức phê duyệt.</p>
            <p>Vui lòng nhấn vào nút bên dưới để truy cập vào hệ thống xem thông tin chi tiết giải đấu và thanh toán lệ phí (nếu có).</p>
            <a href="{{actionUrl}}" class="button" style="color: white !important;">Xem chi tiết giải đấu</a>
            <p>Hẹn gặp lại bạn tại giải đấu!</p>
        </div>
        <div class="footer">
            <p>&copy; 2026 PickleHub. Đã đăng ký Bản quyền.</p>
        </div>
    </div>
</body>
</html>
        `,
    },
    tournament_registration_rejected: {
        subject: '❌ Đăng ký giải đấu của bạn đã bị từ chối - {{tournamentName}}',
        html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #F44336; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; text-align: center; }
        .button { display: inline-block; background-color: #F44336; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>❌ Đăng Ký Bị Từ Chối</h1>
        </div>
        <div class="content">
            <p>Xin chào {{playerName}},</p>
            <p>Yêu cầu đăng ký tham gia nội dung <strong>{{eventName}}</strong> tại giải đấu <strong>{{tournamentName}}</strong> của bạn đã bị từ chối do lý do: <em>{{reason}}</em>.</p>
            <p>Vui lòng nhấn vào nút bên dưới để liên hệ Ban tổ chức hoặc tiến hành đăng ký lại.</p>
            <a href="{{actionUrl}}" class="button" style="color: white !important;">Xem chi tiết giải đấu</a>
        </div>
        <div class="footer">
            <p>&copy; 2026 PickleHub. Đã đăng ký Bản quyền.</p>
        </div>
    </div>
</body>
</html>
        `,
    },
    tournament_match_reminder: {
        subject: '🎾 Nhắc lịch thi đấu sắp diễn ra - {{tournamentName}}',
        html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2196F3; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; text-align: center; }
        .button { display: inline-block; background-color: #2196F3; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎾 Nhắc Lịch Thi Đấu!</h1>
        </div>
        <div class="content">
            <p>Xin chào {{playerName}},</p>
            <p>Bạn có một trận đấu sắp diễn ra tại giải đấu <strong>{{tournamentName}}</strong>.</p>
            <p>Vui lòng nhấn vào nút bên dưới để kiểm tra chi tiết giờ thi đấu, đối thủ và sân đấu của bạn.</p>
            <a href="{{actionUrl}}" class="button" style="color: white !important;">Xem lịch thi đấu của tôi</a>
            <p>Hãy chuẩn bị sẵn sàng và có mặt trước giờ thi đấu ít nhất 15 phút. Chúc bạn thi đấu tốt!</p>
        </div>
        <div class="footer">
            <p>&copy; 2026 PickleHub. Đã đăng ký Bản quyền.</p>
        </div>
    </div>
</body>
</html>
        `,
    },
    tournament_court_change: {
        subject: '⚠️ Thay đổi thông tin lịch/sân đấu - {{tournamentName}}',
        html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #FF9800; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; text-align: center; }
        .button { display: inline-block; background-color: #FF9800; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚠️ Thay Đổi Sân/Giờ Thi Đấu</h1>
        </div>
        <div class="content">
            <p>Xin chào {{playerName}},</p>
            <p>Ban tổ chức giải đấu <strong>{{tournamentName}}</strong> xin thông báo có sự thay đổi về lịch thi đấu hoặc sân đấu cho trận đấu tiếp theo của bạn.</p>
            <p>Vui lòng nhấn vào nút bên dưới để kiểm tra thông tin sân đấu và giờ thi đấu mới cập nhật.</p>
            <a href="{{actionUrl}}" class="button" style="color: white !important;">Xem lịch đấu mới cập nhật</a>
            <p>Chúng tôi rất tiếc vì sự thay đổi này. Hãy di chuyển đến khu vực sân mới kịp thời.</p>
        </div>
        <div class="footer">
            <p>&copy; 2026 PickleHub. Đã đăng ký Bản quyền.</p>
        </div>
    </div>
</body>
</html>
        `,
    },
    tournament_announcement: {
        subject: '📢 Thông báo giải đấu - {{tournamentName}}',
        html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #607D8B; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .highlight { background: #fff; padding: 15px; border-left: 4px solid #607D8B; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📢 Thông Báo Từ Ban Tổ Chức</h1>
        </div>
        <div class="content">
            <p>Xin chào {{playerName}},</p>
            <p>Ban tổ chức giải đấu <strong>{{tournamentName}}</strong> vừa gửi thông báo mới:</p>
            <div class="highlight">
                <p>{{message}}</p>
            </div>
            <p>Mọi thắc mắc xin vui lòng phản hồi lại email này hoặc liên hệ trực tiếp qua hotline hỗ trợ của giải đấu.</p>
        </div>
        <div class="footer">
            <p>&copy; 2026 PickleHub. Đã đăng ký Bản quyền.</p>
        </div>
    </div>
</body>
</html>
        `,
    },
    tournament_groups_drawn: {
        subject: '🎲 Kết quả bốc thăm chia bảng - {{tournamentName}}',
        html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #9C27B0; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; text-align: center; }
        .button { display: inline-block; background-color: #9C27B0; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎲 Đã Có Kết Quả Chia Bảng!</h1>
        </div>
        <div class="content">
            <p>Xin chào {{playerName}},</p>
            <p>Ban tổ chức giải đấu <strong>{{tournamentName}}</strong> đã hoàn thành việc bốc thăm chia bảng thi đấu cho nội dung <strong>{{eventName}}</strong>.</p>
            <p>Vui lòng nhấn vào nút bên dưới để xem bảng đấu của bạn và các đối thủ chung bảng.</p>
            <a href="{{actionUrl}}" class="button" style="color: white !important;">Xem bảng đấu của tôi</a>
        </div>
        <div class="footer">
            <p>&copy; 2026 PickleHub. Đã đăng ký Bản quyền.</p>
        </div>
    </div>
</body>
</html>
        `,
    },
    tournament_schedule_ready: {
        subject: '📅 Lịch thi đấu vòng bảng đã sẵn sàng - {{tournamentName}}',
        html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #00BCD4; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; text-align: center; }
        .button { display: inline-block; background-color: #00BCD4; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📅 Đã Có Lịch Thi Đấu!</h1>
        </div>
        <div class="content">
            <p>Xin chào {{playerName}},</p>
            <p>Ban tổ chức đã chính thức sắp xếp xong lịch thi đấu vòng bảng cho bạn tại giải đấu <strong>{{tournamentName}}</strong>.</p>
            <p>Vui lòng nhấn vào nút bên dưới để theo dõi chi tiết lịch thi đấu cá nhân của bạn (sân đấu, ngày giờ thi đấu).</p>
            <a href="{{actionUrl}}" class="button" style="color: white !important;">Xem lịch thi đấu cá nhân</a>
        </div>
        <div class="footer">
            <p>&copy; 2026 PickleHub. Đã đăng ký Bản quyền.</p>
        </div>
    </div>
</body>
</html>
        `,
    },
    tournament_advance_knockout: {
        subject: '🎉 Chúc mừng bạn đã tiến cấp vào vòng loại trực tiếp - {{tournamentName}}',
        html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #E91E63; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; text-align: center; }
        .button { display: inline-block; background-color: #E91E63; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 Tiến Cấp Thành Công!</h1>
        </div>
        <div class="content">
            <p>Xin chào {{playerName}},</p>
            <p>Chúc mừng bạn và đồng đội đã xuất sắc vượt qua vòng bảng và tiến cấp vào vòng Knockout (loại trực tiếp) nội dung <strong>{{eventName}}</strong> tại giải đấu <strong>{{tournamentName}}</strong>!</p>
            <p>Nhấn vào nút bên dưới để theo dõi ngay nhánh đấu và lịch thi đấu vòng loại trực tiếp.</p>
            <a href="{{actionUrl}}" class="button" style="color: white !important;">Xem nhánh đấu Knockout</a>
        </div>
        <div class="footer">
            <p>&copy; 2026 PickleHub. Đã đăng ký Bản quyền.</p>
        </div>
    </div>
</body>
</html>
        `,
    },
    tournament_completed: {
        subject: '🏆 Giải đấu đã chính thức bế mạc - {{tournamentName}}',
        html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #3F51B5; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; text-align: center; }
        .button { display: inline-block; background-color: #3F51B5; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏆 Bế Mạc Giải Đấu</h1>
        </div>
        <div class="content">
            <p>Xin chào {{playerName}},</p>
            <p>Giải đấu <strong>{{tournamentName}}</strong> đã chính thức khép lại tốt đẹp. Ban tổ chức xin chân thành cảm ơn sự tham gia và cống hiến hết mình của bạn.</p>
            <p>Vui lòng nhấn vào nút bên dưới để xem bảng xếp hạng chung cuộc và các hình ảnh lưu niệm của giải đấu.</p>
            <a href="{{actionUrl}}" class="button" style="color: white !important;">Xem kết quả chung cuộc</a>
            <p>Hẹn gặp lại bạn ở các giải đấu tiếp theo của PickleHub!</p>
        </div>
        <div class="footer">
            <p>&copy; 2026 PickleHub. Đã đăng ký Bản quyền.</p>
        </div>
    </div>
</body>
</html>
        `,
    },
};
