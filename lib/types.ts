export type Employee = {
  /** CCCD — số căn cước công dân (12 số) */
  cccd: string;
  /** Họ tên đầy đủ */
  fullName: string;
  /** Chức danh, vd: GIÁM ĐỐC PTĐT */
  title: string;
  /** Ngày gia nhập (ISO: yyyy-mm-dd) */
  joinDate: string;
  /** Cấp bậc, vd: TINH ANH */
  rank: string;
  /** Số liệu thành tích — 4 ô trên poster */
  stats: {
    calls: string;    // 5.000+  (cuộc gọi tư vấn)
    meetings: string; // 500+    (cuộc gặp khách hàng)
    deals: string;    // 50+     (cơ hội giúp khách tìm tổ ấm)
    hours: string;    // 33.456  (giờ học hỏi & phát triển)
  };
  /** Ghi đè số ngày đồng hành. Nếu bỏ trống → tự tính từ joinDate */
  days?: number;
};
