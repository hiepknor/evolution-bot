# UI/UX Refactor Checklist

## Goals
- Đồng bộ visual hierarchy, spacing, typography, trạng thái tương tác.
- Giảm mật độ thông tin ở vùng thao tác dày (`operations`, `groups`).
- Nhất quán ngôn ngữ (không trộn Việt/Anh trong cùng UI).
- Nâng độ chuyên nghiệp bằng token hóa + chuẩn hóa primitives.

## Current Pain Points (from code)
- Cỡ chữ bị ép nhỏ toàn bộ panel trái qua selector tổng quát ở `src/pages/dashboard-page.tsx`.
- Nhiều thành phần dùng `text-[11px]`/`text-[10px]` ở table/chip/button -> giảm khả năng đọc.
- Trộn nhãn song ngữ: `Groups`, `Clear Cache`, `Admin only`, `Chưa gửi`, `Đã gửi`, ...
- CTA và secondary actions đặt gần nhau, chưa rõ ưu tiên hành động.
- Card/border xuất hiện dày đặc, chưa tạo nhịp thị giác giữa section chính và phụ.

## Refactor Plan by Phase

### Phase 1: Foundation (high impact, low risk)
1. Tạo design tokens rõ cấp bậc trong `src/styles/globals.css`.
- Tách thêm token semantic: `--panel`, `--panel-2`, `--text-strong`, `--text-muted-2`, `--border-soft`.
- Chuẩn lại `--radius` + màu `warning/success/destructive` để badge/button thống nhất.

2. Bỏ ép font-size toàn cục ở panel trái trong `src/pages/dashboard-page.tsx`.
- Xóa đoạn: `[&_.text-sm]:text-xs [&_button]:text-[11px] ...`.
- Để mỗi primitive/panel tự quyết định cỡ chữ theo context.

3. Chuẩn hóa primitives:
- `src/components/ui/button.tsx`
  - `sm` tăng lên tối thiểu `text-xs`.
  - Tăng tương phản `outline/secondary`, tăng rõ focus ring.
- `src/components/ui/badge.tsx`
  - Base từ `text-[10px]` -> `text-[11px]` hoặc `text-xs`.
  - Thêm biến thể trạng thái trung tính rõ hơn cho metadata.
- `src/components/ui/card.tsx`
  - Giảm nhiễu: border mềm hơn, shadow nhất quán.
- `src/components/ui/input.tsx`
  - Placeholder và input text contrast cao hơn.

### Phase 2: Information Architecture & Layout
4. Làm rõ hierarchy ở `src/pages/dashboard-page.tsx`.
- Tăng `gap` theo scale cố định (12/16).
- Tab trái dùng component map thay vì 4 button lặp để giữ đồng nhất style.

5. Tối ưu header/footer:
- `src/components/layout/app-header.tsx`
  - Giảm nhiễu badge, tăng phân cấp title/subtitle.
  - Chuẩn hóa trạng thái kết nối bằng label thân thiện (ví dụ: `Đã kết nối`, `Đang kiểm tra`, `Mất kết nối`).
- `src/components/layout/footer-status.tsx`
  - Gom số liệu theo nhóm và label ngắn, rõ nghĩa.
  - Làm nổi `progress` và campaign hiện tại.

### Phase 3: Panel-Level UX
6. `src/components/groups/groups-panel.tsx`
- Tách rõ 3 dải điều khiển:
  - Sync actions (`Tải danh sách`, `Xóa cache`).
  - Search + filters.
  - Selection actions (`Chọn tất cả`, `Bỏ chọn`, `Đảo`).
- Chuẩn hóa ngôn ngữ chip/filter (chọn Việt hoặc Anh, không trộn).
- Giảm số badge cùng hàng, chỉ giữ metrics thiết yếu.
- Tăng row height nhẹ để dễ quét bảng.

7. `src/components/composer/operations-panel.tsx`
- Chia section thành `Cơ bản` và `Nâng cao`:
  - Cơ bản: readiness, campaign id, profile, execute.
  - Nâng cao (collapsible): delay/pause/attempts, filter IDs.
- Làm rõ CTA:
  - `Send Broadcast` là primary duy nhất.
  - `Dry Run` và `Export CSV` dùng secondary/outline.
  - `Emergency Stop` tách xa CTA chính.
- Viết lại label mơ hồ (`Pause Every N`, `Max Attempts`, `Effective`) thành nhãn tác vụ rõ nghĩa.

8. `src/components/preview/preview-panel.tsx`
- Tăng chất lượng empty state (`Chưa có nội dung xem trước`, hướng dẫn ngắn).
- Nâng hierarchy giữa vùng ảnh và vùng text preview.

9. `src/components/logs/activity-log-panel.tsx`
- Chuẩn hóa severity: icon + badge + màu nhất quán.
- Log item có nhịp tốt hơn (title/time/message) để debug nhanh.

## Language Consistency Pass
- Chọn 1 ngôn ngữ chính cho toàn bộ UI (khuyến nghị: tiếng Việt).
- Tập trung sửa strings ở:
  - `src/components/layout/app-header.tsx`
  - `src/components/layout/footer-status.tsx`
  - `src/components/groups/groups-panel.tsx`
  - `src/components/composer/operations-panel.tsx`
  - `src/components/preview/preview-panel.tsx`
  - `src/components/logs/activity-log-panel.tsx`

## Suggested Commit Sequence
1. `chore(ui): normalize base tokens and primitive contrast`
2. `refactor(ui): remove global downscale typography in dashboard`
3. `refactor(groups): separate action bars and standardize labels`
4. `refactor(operations): split basic/advanced and clarify CTA hierarchy`
5. `refactor(header-footer): unify status labels and stats readability`
6. `refactor(preview-log): improve empty states and scanability`
7. `chore(i18n): unify language across primary screens`

## QA Checklist
- Desktop 1366x768 và 1440p: không bị dồn chữ, không tràn control.
- Keyboard focus: tab qua button/input/checkbox thấy ring rõ.
- Contrast: metadata vẫn đọc tốt trong môi trường ánh sáng mạnh.
- Hành động rủi ro (`Emergency Stop`) không đặt gần CTA chính.
- Không còn text trộn Việt/Anh trong cùng vùng điều khiển.
