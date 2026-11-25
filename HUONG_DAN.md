# YT Việt – Xem YouTube không quảng cáo + phụ đề dịch Anh → Việt

Web app (PWA) cài được lên màn hình chính điện thoại, không cần App Store / CH Play.

## Nó hoạt động thế nào

| Tính năng | Cách làm |
|---|---|
| **Không quảng cáo** | App không dùng trình phát của YouTube. Nó lấy luồng video trực tiếp qua API của **Piped** (một bộ “giao diện thay thế” mã nguồn mở cho YouTube) rồi phát bằng thẻ `<video>` thường → hệ thống quảng cáo của YouTube không bao giờ được tải. |
| **Phụ đề dịch Anh → Việt** | App tải track phụ đề (CC) của video, dịch từng câu sang tiếng Việt bằng Google Dịch (dự phòng MyMemory), rồi vẽ đè lên video — kể cả khi xem toàn màn hình. Có sẵn phụ đề tiếng Việt thì dùng luôn, không cần dịch. |
| **Cài như app** | PWA: có icon, chạy toàn màn hình, nhận link từ nút “Chia sẻ” của app YouTube (Android). |

---

## Phần 1 – Đưa app lên mạng (làm 1 lần, miễn phí, chỉ cần điện thoại)

PWA **bắt buộc chạy trên HTTPS**, nên cần đưa các file lên một dịch vụ hosting tĩnh miễn phí. Cách dưới đây làm 100% trên điện thoại.

### Bước 1 – Giải nén file zip
- **Android:** mở ứng dụng **Files (Tệp)** → vào thư mục Tải xuống → chạm giữ `yt-viet.zip` → **Giải nén / Extract**.
- **iPhone:** mở ứng dụng **Tệp (Files)** → chạm vào `yt-viet.zip` là tự giải nén ra thư mục `yt-viet`.

Bên trong có 9 file nằm cùng một cấp: `index.html`, `app.js`, `style.css`, `sw.js`, `manifest.webmanifest`, `HUONG_DAN.md` và 4 ảnh `icon-*.png`, `maskable-512.png`.

### Bước 2 – Tạo kho trên GitHub (mở bằng Chrome/Safari)
1. Vào <https://github.com> → **Sign up** tạo tài khoản (bỏ qua nếu đã có).
2. Bấm dấu **+** → **New repository** → đặt tên `yt-viet`, chọn **Public** → **Create repository**.
3. Trong trang kho vừa tạo, bấm **uploading an existing file** (hoặc **Add file → Upload files**).
4. Bấm **choose your files**, vào thư mục `yt-viet` đã giải nén và **chọn tất cả 9 file** (chạm giữ một file rồi chạm thêm các file còn lại). Nếu điện thoại chỉ cho chọn từng lần, cứ tải nhiều lượt.
   > Nếu trình duyệt không cho chọn từ Tệp, hãy bật chế độ **“Trang web cho máy tính” (Desktop site)** trong menu trình duyệt rồi thử lại.
5. Chờ tải xong, kéo xuống bấm **Commit changes**.

### Bước 3 – Bật GitHub Pages
1. Trong kho, vào **Settings → Pages**.
2. **Source:** chọn **Deploy from a branch**. **Branch:** chọn `main`, thư mục `/ (root)` → **Save**.
3. Đợi 1–2 phút, tải lại trang sẽ thấy link dạng `https://TEN-CUA-BAN.github.io/yt-viet/`. Đó là địa chỉ app của bạn.

---

## Phần 2 – Cài lên điện thoại

### Android (Chrome)
1. Mở link app của bạn bằng **Chrome**.
2. Bấm menu **⋮** → **Cài đặt ứng dụng** (hoặc **Thêm vào Màn hình chính**) → **Cài đặt**.
   *Hoặc:* bấm biểu tượng ⚙ trong app → nút **Cài ứng dụng**.
3. Icon **YT Việt** xuất hiện ở màn hình chính. Mở lên là chạy toàn màn hình như app thật.

### iPhone / iPad (Safari)
1. Mở link app bằng **Safari** (không dùng Chrome/Zalo/Facebook trình duyệt trong app).
2. Bấm nút **Chia sẻ** (ô vuông có mũi tên lên) → kéo xuống chọn **Thêm vào MH chính** (Add to Home Screen) → **Thêm**.

---

## Phần 3 – Cách dùng

- **Xem video:** gõ từ khoá vào ô tìm kiếm, **hoặc dán link YouTube** (youtu.be, watch?v=, shorts…) rồi Enter. Trang chủ hiển thị video thịnh hành tại Việt Nam.
- **Mở từ app YouTube (Android, sau khi đã cài):** trong app YouTube bấm **Chia sẻ → YT Việt**, video sẽ mở ngay trong app, không quảng cáo.
- **Phụ đề tiếng Việt:** nút **VI** ở thanh điều khiển để bật/tắt. Bấm biểu tượng thanh trượt (⚙ nhỏ) để:
  - chọn **chất lượng** (360p / 720p), **tốc độ** phát;
  - đổi **cỡ chữ**, **độ đậm nền** phụ đề;
  - bật **hiện thêm dòng tiếng Anh gốc** (học tiếng Anh rất tiện);
  - **lệch giờ phụ đề** ±0,5 giây nếu bị chậm/sớm;
  - đổi track phụ đề gốc (ví dụ phụ đề tự động hay phụ đề do người làm video).
- **Toàn màn hình:** nút ⛶. Trên Android phụ đề vẫn hiển thị đè lên video. Trên iPhone app dùng khung toàn màn hình “giả” — hãy xoay ngang điện thoại.
- **Thao tác nhanh:** chạm 2 lần vào mép trái/phải video để tua ±10 giây; chạm 1 lần để ẩn/hiện nút.

---

## Phần 4 – Xử lý sự cố

| Triệu chứng | Cách xử lý |
|---|---|
| Trang chủ trống / “Không kết nối được máy chủ” | Máy chủ Piped công cộng đôi khi sập hoặc bị YouTube chặn. Mở ⚙ (góc trên phải) → **Kiểm tra** để app chọn máy chủ khác. Có thể dán máy chủ riêng, danh sách tại <https://piped-instances.kavin.rocks/> (dùng địa chỉ cột **API URL**, dạng `https://pipedapi.…`). |
| Video xoay mãi / báo lỗi | Bấm **Thử máy chủ khác**; hoặc đổi chất lượng xuống 360p; hoặc **YouTube gốc** (có quảng cáo) để xem tạm. |
| Hiện “Video này không có phụ đề” | Video không có CC nào để dịch. App dịch phụ đề có sẵn, **không** nhận giọng nói. |
| Phụ đề hiện tiếng Anh in nghiêng (chưa dịch) | Đang chờ dịch; thường xong sau 1–2 giây. Nếu mãi vậy: kiểm tra mạng, hoặc dịch đang bị giới hạn lượt — chờ vài phút. |
| Phụ đề lệch giờ | Mở menu thanh trượt → **Lệch giờ phụ đề**. |
| Tối đa chỉ 720p | Luồng 1080p+ của YouTube tách riêng hình/tiếng nên app chưa ghép; 360p/720p là bản có cả tiếng. |
| Muốn cập nhật app | Upload đè các file mới lên GitHub/Netlify. Trong `sw.js`, đổi `ytviet-v1` thành `ytviet-v2` để điện thoại nhận bản mới. |

---

## Phần 5 – Giới hạn & lưu ý (đọc để biết trước)

- **Không có “cam kết chạy mãi mãi”.** App phụ thuộc vào các máy chủ Piped công cộng do cộng đồng vận hành. YouTube thường xuyên thay đổi để chặn các dịch vụ này nên lúc có lúc không. Nếu cần ổn định, bạn có thể tự dựng Piped của riêng mình (xem <https://docs.piped.video/>) rồi dán địa chỉ vào ⚙ Cài đặt.
- **Về quảng cáo & điều khoản:** chặn quảng cáo là hợp pháp với người dùng, nhưng việc này trái điều khoản dịch vụ của YouTube và làm người làm video mất thu nhập từ lượt xem của bạn. Nếu bạn xem nhiều, **YouTube Premium** là cách ủng hộ họ và vẫn không quảng cáo.
- **Quyền riêng tư:** nội dung phụ đề được gửi tới Google Dịch (và MyMemory khi dự phòng) để dịch. Nếu máy chủ phụ đề không cho phép truy cập trực tiếp, app dự phòng qua proxy công cộng `corsproxy.io` / `allorigins.win` — các dịch vụ này chỉ thấy địa chỉ file phụ đề.
- **Chất lượng dịch** là dịch máy (nghĩa chính đúng, câu đôi khi gượng); phụ đề tự động của YouTube vốn đã có lỗi sẵn nên dịch có thể sai theo.
- Đây là dự án cá nhân, không liên kết với YouTube/Google.
