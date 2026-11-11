# SKYWARD SALVAGE — Final Build

Skyward Salvage là game FPS 3D sinh tồn theo wave, chạy trực tiếp trong trình duyệt. Bản này mở rộng dự án theo hướng **Modern Military Sci‑Fi FPS + Roguelite Survival**, sử dụng Hybrid 3D: model glTF Quaternius CC0 kết hợp gameplay/hitbox/weakpoint procedural, đồng thời giữ nguyên kiến trúc JavaScript thuần.

## Khởi chạy

**Cách 1 — mở trực tiếp:** nhấp đúp `index.html` trong thư mục game. Bản phát hành không dùng CDN, không có build step và không cần tải asset từ Internet.

**Cách 2 — local server (khuyến nghị khi trình duyệt hạn chế `file://`):**

```bash
cd skyward-salvage
python -m http.server 8080
```

Mở `http://localhost:8080`. Trên Windows có thể chạy `start.bat`; file này tự dùng Python local nếu máy đã cài Python.

## Chế độ chơi

| Mission | Nội dung | Mở khóa |
|---|---|---|
| Tín hiệu Beryl | 3 wave tiêu chuẩn | Mặc định |
| Xuyên qua cơn giông | 3 wave, mật độ và HP địch tăng | Mặc định |
| Thử thách bởi gió | Sống sót 120 giây, tối ưu điểm | Mặc định |
| Blackout Offensive | 5 wave, boss ở wave cuối, bản đồ Stormglass Outpost | Level 2 |
| Endless Protocol | Wave vô hạn, boss định kỳ, chọn 1 trong 3 nâng cấp sau mỗi wave | Level 4 |

Các drop hồi máu/đạn, combo multiplier và lựa chọn nâng cấp chỉ hoạt động trong Endless Protocol; ba mission gốc giữ nguyên luật thưởng và nhịp wave.

## Điều khiển PC

| Phím / thao tác | Chức năng |
|---|---|
| `W` `A` `S` `D` | Di chuyển |
| Chuột | Nhìn / ngắm; nhấp chuột trái để khóa chuột |
| Chuột trái | Bắn |
| Chuột phải | Ngắm chính xác |
| `Shift` | Chạy nhanh |
| `Space` | Nhảy |
| `R` | Nạp đạn |
| `X` | Kiểm tra vũ khí |
| `Q` | Dash |
| `E` | Lựu đạn |
| `F` | Không kích 7 điểm |
| `1` `2` `3` | Đổi vũ khí |
| `Esc` / `P` | Tạm dừng |
| `F3` | Bật/tắt bảng hiệu năng |

## Điều khiển cảm ứng

- Joystick bên trái: di chuyển.
- Kéo vùng bên phải: xoay góc nhìn.
- Nút cảm ứng: bắn, ngắm, nhảy, chạy, nạp đạn, Q, E, F, đổi vũ khí và tạm dừng.
- Bố cục tự điều chỉnh cho màn hình dọc và ngang. Cần kiểm tra thêm trên thiết bị thật vì cấu hình phần cứng/trình duyệt khác nhau.

## Hybrid 3D assets

- Enemy: Quaternius EyeDrone, QuadShell và Trilobite; Commander dùng QuadShell phóng lớn kết hợp reactor weakpoint.
- Weapon viewmodel: Rifle, Revolver và Sniper glTF; lựu đạn ném dùng Prop_Grenade.
- Environment/pickups: crate, ammo cache và health pack.
- Asset pack: [Quaternius Sci-Fi Essentials Kit (Standard)](https://quaternius.com/), giấy phép CC0 1.0; license được giữ tại `assets/scifi/LICENSE_CC0.txt`.
- Model buffers được nhúng Base64 để tránh XHR/fetch trên `file://`; texture PNG được đóng gói cục bộ. Nếu model loader lỗi, game dùng procedural fallback.
- Texture maps có hai mức 512×512 (Low/Medium) và 1024×1024 (High); không tải asset từ CDN hoặc Internet khi chơi.

## Vũ khí và kẻ địch

**Vũ khí:** súng trường tự động, súng ngắn hạng nặng, súng trường chính xác. Có viewmodel cánh tay/găng, sway, recoil, hiệu ứng nạp đạn, đổi súng và inspect.

**Kẻ địch:** Drone, Speeder, Brute và Commander boss. Boss có lõi năng lượng làm weakpoint, nhận thêm sát thương khi bắn trúng lõi và chuyển pha hành vi khi HP xuống thấp.

## Tiến trình

- XP, level, số mission, số hạ gục, số chiến thắng và wave cao nhất được lưu bằng `localStorage`.
- Achievement: First Blood, Eliminator, Mission Complete và Wave 10.
- Level mở khóa Blackout, Endless và skin accent cho vũ khí.
- Nâng cấp trong run chỉ tồn tại trong lượt Endless đang chơi; không cộng vĩnh viễn chỉ số chiến đấu.

## Hiệu năng và tùy chọn

- Preset đồ họa Low / Medium / High; thiết bị touch mới mặc định Low nếu chưa có lựa chọn lưu. Thay đổi preset sẽ tải lại trang để tái tạo texture.
- Hỗ trợ `prefers-reduced-motion` và tùy chọn giảm chuyển động trong game.
- Nhấn `F3` để xem FPS ước tính, frame time trung bình/cao nhất, draw calls, triangles, geometry, texture, particle, decal và enemy count.

## Công nghệ và cấu trúc

- Three.js r128 được vendored tại `vendor/three.min.js`.
- JavaScript thuần, classic script; không dùng ES modules, bundler, framework hoặc CDN.
- WebAudio tạo âm thanh; Canvas 2D tạo minimap; enemy/weapon/props dùng glTF cục bộ, còn weakpoint và một số hiệu ứng gameplay vẫn procedural.
- `start.bat` là launcher local; `index.html` vẫn là entry point.

```text
skyward-salvage/
├── index.html
├── css/style.css
├── js/
│   ├── scifi_assets.js
│   ├── scifi_loader.js
│   ├── textures.js
│   ├── decals.js
│   ├── vfx.js
│   ├── audio.js
│   ├── music.js
│   ├── particles.js
│   ├── world.js
│   ├── player.js
│   ├── weapons.js
│   ├── enemies.js
│   ├── ui.js
│   └── main.js
├── assets/scifi/             # Quaternius CC0 local textures + license
├── vendor/three.min.js
├── start.bat
├── README.md
└── PHASE_COMPLETION_REPORT.md
```

## Lưu dữ liệu

Hồ sơ, cài đặt, mission đã chọn và điểm cao được lưu cục bộ trong trình duyệt. Xóa dữ liệu trang sẽ xóa các thông tin này. Bản phát hành không gửi dữ liệu ra máy chủ.
