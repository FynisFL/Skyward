# Skyward Salvage

**Skyward Salvage** là game FPS 3D sinh tồn theo wave, chạy trên trình duyệt và Android WebView. Dự án theo hướng **Military Sci-Fi FPS + Roguelite Survival**, dùng Three.js r128, JavaScript thuần và asset đóng gói cục bộ.

- **Chơi trên web:** https://fynisfl.github.io/Skyward/
- **Mã nguồn:** https://github.com/FynisFL/Skyward
- **Android APK:** xem [hướng dẫn build](ANDROID_BUILD.md) hoặc tải artifact từ tab [GitHub Actions](https://github.com/FynisFL/Skyward/actions).

## Tính năng

### Chế độ chơi

| Mission | Nội dung | Mở khóa |
|---|---|---|
| Tín hiệu Beryl | 3 wave tiêu chuẩn | Mặc định |
| Xuyên qua cơn giông | 3 wave, mật độ và HP địch tăng | Mặc định |
| Thử thách bởi gió | Sống sót 120 giây, tối ưu điểm | Mặc định |
| Blackout Offensive | 5 wave, Commander ở wave cuối, bản đồ Stormglass Outpost | Level 2 |
| Endless Protocol | Wave vô hạn, boss định kỳ, chọn 1 trong 3 nâng cấp sau mỗi wave | Level 4 |

Các drop hồi máu/đạn, combo multiplier và lựa chọn nâng cấp chỉ hoạt động trong Endless Protocol. Ba mission gốc giữ nguyên luật thưởng và nhịp wave.

### Combat và progression

- Ba vũ khí: Rifle, Revolver và Sniper.
- Các loại địch Drone, Speeder, Brute và Commander boss; Commander có reactor weakpoint và các pha hành vi.
- Viewmodel vũ khí có sway, recoil, inspect, đổi súng và hiệu ứng nạp đạn.
- XP, level, achievement và hồ sơ người chơi được lưu bằng `localStorage`.
- Nâng cấp chiến đấu trong run chỉ tồn tại trong lượt Endless; progression không cộng vĩnh viễn combat stats.

### Hỗ trợ thiết bị

- PC: bàn phím và chuột, Pointer Lock.
- Touch: joystick di chuyển, vuốt để xoay góc nhìn và các nút hành động.
- Android: native WebView wrapper, asset game được đóng gói offline.
- Preset đồ họa Low / Medium / High, giảm chuyển động và adaptive render resolution.
- Nhấn `F3` để mở bảng chẩn đoán hiệu năng.

## Chạy local

Không cần `npm install`, bundler hoặc build step cho phiên bản web.

**Khuyến nghị: chạy local server**

Yêu cầu Python 3:

```bash
python -m http.server 8080
```

Mở http://localhost:8080. Trên Windows có thể chạy `start.bat`.

Game cũng có thể mở trực tiếp bằng `index.html`; local server được khuyến nghị để tránh giới hạn `file://` của một số trình duyệt.

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
- Các nút cảm ứng: bắn, ngắm, nhảy, chạy, nạp đạn, dash, lựu đạn, không kích, đổi vũ khí và tạm dừng.
- Bố cục điều khiển thích ứng với màn hình nhỏ. Android wrapper hiện khóa hướng landscape.

## Công nghệ và kiến trúc

- **Three.js r128** được lưu cục bộ tại `vendor/three.min.js`.
- Vanilla JavaScript, HTML và CSS; dùng classic script, không dùng ES modules, React, bundler hoặc CDN.
- WebAudio tạo âm thanh; Canvas 2D tạo minimap.
- Runtime không tải model, texture hoặc thư viện từ Internet.
- Model Quaternius Sci-Fi Essentials Kit được đóng gói trong `js/scifi_assets.js`; texture PNG nằm trong `assets/scifi/`.
- Asset pack Quaternius được sử dụng theo giấy phép CC0 1.0; bản license được lưu tại `assets/scifi/LICENSE_CC0.txt`.
- Texture maps có mức 512×512 và 1024×1024 theo preset đồ họa; model loader có procedural fallback khi asset không tải được.

## Cấu trúc repository

```text
Skyward/
├── index.html                 # Web entry point
├── css/style.css              # Game UI và layout
├── js/                        # Gameplay, UI, AI, audio, VFX, replay, RNG
├── assets/scifi/              # Texture và license
├── vendor/three.min.js        # Three.js r128
├── app/                       # Android WebView wrapper và game asset mirror
├── tools/qa/                  # Validator và unit tests
├── .github/workflows/         # CI, Android APK, GitHub Pages deploy
├── start.bat                  # Local launcher cho Windows
├── ANDROID_BUILD.md           # Hướng dẫn build APK
└── PHASE_*.md                 # QA checklist và phase reports
```

Các file runtime trong `app/src/main/assets/game/` là bản mirror của `index.html`, `css/`, `js/`, `assets/` và `vendor/` dành cho Android WebView. Không xóa hoặc chỉnh riêng bản mirror; mọi thay đổi runtime phải được đồng bộ và kiểm tra parity.

## Kiểm tra chất lượng

Yêu cầu Node.js 20 trở lên. Chạy từ thư mục gốc repository:

```bash
node tools/qa/phase7.test.mjs
node tools/qa/phase8.test.mjs
node tools/qa/phase9.test.mjs
node tools/qa/validate.mjs
find js -type f -name '*.js' -print0 | xargs -0 -n1 node --check
```

CI chạy validation, deterministic tests, adaptive-rendering tests và Android APK build. Xem trạng thái tại [GitHub Actions](https://github.com/FynisFL/Skyward/actions).

### Trạng thái xác minh

- Phase 7/8/9 tests, JavaScript syntax, repository validator và Web/Android mirror parity: PASS trên runtime commit `5469040`.
- Web deploy, GitHub Pages và Android debug APK build/artifact upload: PASS. Xem [Phase 9 CI evidence](PHASE_9_COMPLETION_REPORT.md#ci-evidence).
- Gameplay/replay trên trình duyệt thật và kiểm thử trên thiết bị Android: vẫn cần manual testing.
- FPS/GPU improvement thực tế chưa được đo trên thiết bị mục tiêu; dùng F3 để thu thập benchmark.
- Replay hiện ghi nhận keyboard/mouse; touch input và platform lifecycle chưa được bao phủ đầy đủ.
- Khi WebGL context được khôi phục, runtime hiện reload trang thay vì khôi phục scene tại chỗ.

## Phase documentation

| Tài liệu | Phạm vi |
|---|---|
| [PHASE_COMPLETION_REPORT.md](PHASE_COMPLETION_REPORT.md) | Tổng hợp implementation Phase 0–5 |
| [PHASE_6_QA.md](PHASE_6_QA.md) | QA, regression và benchmark |
| [PHASE_7_QA.md](PHASE_7_QA.md) | Deterministic RNG, event bus và replay QA |
| [PHASE_7_COMPLETION_REPORT.md](PHASE_7_COMPLETION_REPORT.md) | Kết quả triển khai Phase 7 |
| [PHASE_8_QA.md](PHASE_8_QA.md) | Adaptive rendering và cross-platform QA |
| [PHASE_8_COMPLETION_REPORT.md](PHASE_8_COMPLETION_REPORT.md) | Kết quả triển khai Phase 8 |
| [PHASE_9_QA.md](PHASE_9_QA.md) | Runtime regression và benchmark matrix |
| [PHASE_9_COMPLETION_REPORT.md](PHASE_9_COMPLETION_REPORT.md) | Kết quả triển khai Phase 9 và CI evidence |


## Phase 9 — Runtime QA & Benchmark

Phase 9 adds a browser-console benchmark recorder. After the game initializes, use:

```js
window.__SKYWARD__.benchmark.start({ scenario: 'typical-combat', trial: 1 });
```

After at least 30–60 seconds:

```js
copy(window.__SKYWARD__.benchmark.export());
```

The recorder exports FPS/frame-time percentiles, draw calls, triangles, geometry/texture counts, particles, decals, enemies, render scale and adaptive FPS. See [PHASE_9_QA.md](PHASE_9_QA.md) for the benchmark matrix and manual regression checklist. Automated CI does not replace physical browser/Android testing.

## Lưu dữ liệu

Hồ sơ, cài đặt, mission đã chọn và điểm cao được lưu cục bộ trong trình duyệt. Xóa dữ liệu trang sẽ xóa các thông tin này. Bản game không gửi dữ liệu người chơi lên máy chủ.
