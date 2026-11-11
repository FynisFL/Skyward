# SKYWARD SALVAGE — Báo cáo hoàn thành các Phase

**Bản phát hành:** Final Build
**Ngày đóng gói:** 11/11/2026
**Kiến trúc được giữ lại:** Three.js r128 local + Vanilla JavaScript + HTML/CSS + Canvas/WebAudio.

## 1. Tổng quan

Đã triển khai các hạng mục thuộc Phase 0–5 trên source hiện tại, đồng thời giữ nguyên định hướng chạy offline và không yêu cầu build step. Các hệ thống mới được tích hợp vào kiến trúc script cổ điển đang có; không chuyển sang React/Vite, không dùng ES modules, không thêm CDN hoặc dependency mạng.

**Phạm vi tương thích được giữ:** ba vũ khí, ba class kỹ sư, các phím Q/E/F, ba mission ban đầu, wave/timer, menu, HUD, minimap, hitmarker, pause, settings, game-over, rank và local save. Các mechanic Roguelite (drop, multiplier, upgrade giữa wave) được giới hạn trong Endless Protocol để không thay đổi luật của ba mission gốc.


## 1A. Rà soát bổ sung Phase 0–2

Ngày rà soát bổ sung: 11/11/2026.

- **Phase 0:** Đã kiểm tra lại luồng projectile pool theo vòng đời spawn → fire → recycle → death → dispose. Pool thu hồi projectile khi enemy chết; resource dùng chung được ref-count và chỉ giải phóng khi enemy cuối cùng cùng loại được dispose. Reset trận dọn enemy, projectile, grenade, airstrike state, pickup và VFX.
- **Phase 1:** Đã kiểm tra marker, damage number, hit feedback và damage direction. Phát hiện một lỗi định hướng nhỏ: marker của enemy ở sau camera có thể bị đảo hướng do tọa độ phép chiếu. Đã sửa bằng cách đảo tọa độ quanh tâm viewport trước khi ghim marker vào mép màn hình.
- **Phase 2:** Đã kiểm tra 10 glTF definitions, texture URI và bản 512px; toàn bộ file được tham chiếu đều tồn tại. Ba enemy model có skin/skeleton và animation clips; ba weapon model và bốn prop model được tạo bằng factory. Commander reactor được raycast trúng từ hướng nhìn chính diện trong harness Three.js r128.
- Không phát hiện lỗi cú pháp, thiếu asset, URL ngoài, duplicate HTML ID hoặc lỗi ZIP trong bản rà soát này.
- **Giới hạn:** Đây vẫn là source/harness audit; chưa xác nhận cảm quan hình ảnh, animation timing, reload feel, mobile gestures hoặc hiệu năng trên trình duyệt/thiết bị thật.

## 2. Chi tiết theo Phase

### Phase 0 — Foundation & Bug Fixes

**Trạng thái triển khai: Hoàn thành ở mức source + kiểm tra tĩnh.**

- Sửa vòng đời projectile của enemy: projectile đang bay được thu hồi khi enemy chết hoặc bị dọn; tránh để đạn của enemy đã chết tiếp tục tồn tại trong scene.
- Bổ sung projectile pool theo từng enemy. Geometry/material projectile được chia sẻ theo loại enemy bằng bộ đếm tham chiếu; mỗi enemy có pool mesh riêng, projectile hết hạn hoặc va chạm được đưa về pool và tái sử dụng thay vì tạo/hủy mesh liên tục.
- Tách loại nguồn sát thương trong callback. `shotsFired`/`shotsHit` chỉ tính hit từ firearm; grenade và airstrike không làm sai tỷ lệ accuracy. Điểm hit và điểm hạ gục vẫn được ghi nhận riêng.
- Giới hạn raycast vào các bề mặt gameplay có nhãn `surface` hoặc `blocksBullets`; bỏ sky/cloud/mesh trang trí khỏi đường đạn.
- Raycast kiểm tra trạng thái hiển thị của toàn bộ chuỗi parent. Vật cản của Stormglass Outpost không chặn đạn khi map này đang ẩn.
- Bổ sung dọn projectile, grenade, strike và VFX khi reset/rời trận; pickup được xóa và geometry được giải phóng khi nhặt, hết hạn hoặc kết thúc lượt.
- Gộp phần giải phóng resource của enemy vào `dispose()` để tránh nhánh death animation và cleanup cùng tự giải phóng một resource hai lần.
- Bảng debug `F3` hiển thị FPS ước tính, frame time trung bình/cao nhất (đo theo frame thực, không dùng delta đã giới hạn cho simulation), draw calls, triangles, geometry, texture, particle, decal và số enemy đang sống.
- Reset trạng thái bắn/ngắm/di chuyển khi pause, end-round hoặc về menu; camera không còn chuyển sang góc quay menu khi trận đang tạm dừng.

### Phase 1 — Tactical HUD & Combat Feedback

**Trạng thái triển khai: Hoàn thành ở mức source + kiểm tra tĩnh.**

- Thêm damage number nổi trên mục tiêu; kill được nhấn mạnh bằng style riêng.
- Thêm marker enemy với thanh máu và tên loại địch; marker ngoài màn hình được ghim về mép viewport.
- Boss dùng marker lớn và màu riêng, giúp nhận biết mục tiêu ưu tiên.
- Thêm chỉ báo hướng nhận sát thương, damage vignette, low-health vignette và giữ hitmarker cho phản hồi trúng đạn.
- Thêm combo display; combo multiplier chỉ hoạt động trong Endless Protocol.
- HUD được bố trí lại cho màn hình nhỏ; minimap, ammo, ability, health và wave indicator tiếp tục dùng chung layout responsive.

### Phase 2 — Hybrid 3D Model Overhaul

**Trạng thái triển khai: Đã tích hợp asset thực tế + kiểm tra parser/skeleton/animation/raycast bằng Three.js r128. Chưa thay thế playtest trình duyệt thật.**

- Tích hợp **Quaternius — Sci-Fi Essentials Kit (Standard)** theo giấy phép **CC0 1.0**. Đã đưa giấy phép gốc vào `assets/scifi/LICENSE_CC0.txt`.
- 10 model glTF thực tế đã được đóng gói: `Enemy_EyeDrone`, `Enemy_QuadShell`, `Enemy_Trilobite`, `Gun_Rifle`, `Gun_Revolver`, `Gun_Sniper`, `Prop_Crate`, `Prop_HealthPack`, `Prop_Ammo`, `Prop_Grenade`.
- Mapping gameplay: Drone → EyeDrone; Speeder → QuadShell; Brute → Trilobite; Commander → QuadShell phóng lớn + reactor weakpoint procedural. Vũ khí Auto/Handcannon/Scout lần lượt dùng Rifle/Revolver/Sniper. World props dùng crate/ammo; pickup Endless dùng health pack/ammo cache; lựu đạn ném dùng model Prop_Grenade.
- Đã viết runtime glTF loader tương thích Three.js r128: đọc accessors/bufferViews/indices, UV, normals, materials PBR, base-color/normal/ORM maps, node hierarchy, skin joints/inverse bind matrices và animation clips. Không dựa vào GLTFLoader qua XHR.
- Để hỗ trợ `file://`, buffer `.bin` của các model được nhúng Base64 trong `js/scifi_assets.js`; texture được đóng gói thành PNG cục bộ trong `assets/scifi/`. Không CDN, không `fetch`, không XHR, không tải model từ Internet khi chạy.
- 18 texture maps có hai mức 512×512 và 1024×1024: Low/Medium dùng 512, High dùng 1024 theo preset đồ họa. Texture maps được chia sẻ theo tên giữa các model, tránh nhân bản dữ liệu trong gói. Model geometry dùng cache; mỗi enemy có material instance riêng để flash sát thương không làm đổi màu các enemy khác.
- Enemy glTF sử dụng skeletal clips có sẵn: Idle/Run/Walk/Attack/Hit/TurnOff tùy model; hit reaction được ưu tiên ngắn khi nhận sát thương. Commander giữ reactor riêng, được đặt ở mặt trước và ở độ cao có thể ngắm từ góc nhìn FPS; reactor vẫn nhận multiplier sát thương ×1.8. Các mesh asset đều được đưa vào raycast hit target.
- Weapon viewmodel thay blockout bằng model súng thật; lựu đạn ném cũng dùng Prop_Grenade. Vẫn giữ rig cánh tay/găng, sway, recoil, inspect và chuyển súng. Reload hiện vẫn là chuyển động viewmodel/procedural, chưa có thao tác bàn tay tháo magazine hoặc kéo bolt/cylinder đúng theo rig súng.
- Crate được thêm vào môi trường làm props trang trí; các props không được gắn nhãn surface nên không vô tình chặn raycast đạn. Pickup hiển thị health pack/ammo model nhưng logic heal/refill cũ được giữ nguyên.
- Geometry glTF được chia sẻ và không bị dispose khi một enemy chết; material instance của enemy được giải phóng riêng. Nếu model không parse được, factory trả `null` và enemy/viewmodel procedural fallback vẫn được giữ.
- **Giới hạn còn lại:** asset kit không cung cấp model humanoid bàn tay FPS hoặc Commander humanoid; Commander hiện dùng QuadShell + reactor custom. Không có skeletal hand reload animation. Texture PBR dùng base-color, normal và ORM, đã tối ưu 1024; chưa có shader post-processing riêng cho từng asset.

### Phase 3 — Endless & Roguelite

**Trạng thái triển khai: Hoàn thành ở mức source + kiểm tra logic wave độc lập.**

- Thêm **Endless Protocol** (Mission 4): không giới hạn wave; số lượng enemy tăng đến ngưỡng 32 enemy thường/wave để kiểm soát draw call, HP tiếp tục tăng theo tiến trình; Commander xuất hiện định kỳ mỗi 5 wave.
- Sau khi dọn sạch một wave Endless, game tạm dừng simulation và đưa ra 3 lựa chọn nâng cấp ngẫu nhiên; người chơi chọn 1 trước khi tiếp tục.
- Bộ nâng cấp hiện có: tăng damage, tăng max HP/hồi máu, tăng tốc di chuyển/giảm cooldown, tăng tốc bắn/nạp đạn, bổ sung đạn/hồi máu và giảm cooldown kỹ năng.
- Thêm pickup MED-CHARGE, AMMO CACHE và FIELD SUPPLY; boss đảm bảo rơi supply trong Endless, enemy thường có xác suất rơi thấp hơn.
- Thêm combo/multiplier tính điểm theo chuỗi hạ gục; combo mất hiệu lực khi hết thời gian duy trì.
- Simulation, timer và điều khiển chiến đấu được đóng băng trong lúc chọn upgrade.
- Không đưa drop, upgrade, combo multiplier vào ba mission gốc; các nâng cấp run không trở thành chỉ số permanent của hồ sơ.

### Phase 4 — Mobile Support

**Trạng thái triển khai: Hoàn thành ở mức source; chưa xác minh trên thiết bị thật.**

- Thêm joystick cảm ứng bên trái để di chuyển.
- Vuốt vùng bên phải để xoay góc nhìn; bỏ yêu cầu Pointer Lock trên thiết bị touch.
- Thêm nút touch cho bắn, ngắm, nhảy, chạy, nạp đạn, dash, grenade, airstrike, đổi vũ khí và pause.
- Responsive layout cho màn hình nhỏ và landscape; nút điều khiển dùng Pointer Events và `touch-action` để tránh thao tác cuộn ngoài ý muốn.
- Desktop input và Pointer Lock tiếp tục hoạt động theo nhánh riêng.
- Thiết bị touch mới chưa có preset lưu sẽ mặc định dùng Low để giảm tải; người chơi vẫn có thể đổi Low / Medium / High trong Settings.

### Phase 5 — Content & Progression

**Trạng thái triển khai: Hoàn thành ở mức source + kiểm tra tĩnh.**

- Thêm **Blackout Offensive** (Mission 5): 5 wave, tăng mật độ/HP enemy và Commander ở wave cuối.
- Thêm dressing map **Stormglass Outpost** gồm barricade và beacon; map chỉ hiển thị trong Blackout.
- Thêm hồ sơ kỹ sư: level, XP, số lượt chơi, tổng hạ gục, số chiến thắng, wave cao nhất và achievement.
- Achievement: First Blood, Eliminator, Mission Complete và Wave 10; XP thưởng được cộng khi kết thúc run.
- Mở khóa Blackout ở level 2, skin accent ở level 3 và Endless Protocol ở level 4.
- Lưu profile trong `localStorage` theo key `skyward-profile-v1`; dữ liệu không gửi ra máy chủ.
- Không dùng level để cộng vĩnh viễn combat stats; progression mở khóa content/cosmetic, còn nâng cấp chiến đấu nằm trong một run Endless.

## 3. Những phần được giữ nguyên

- Three.js r128 local trong `vendor/three.min.js`.
- HTML entry point `index.html`, classic scripts, không `<script type="module">`.
- Không CDN, không framework, không bundler và không build command.
- Ba mission ban đầu giữ số wave và bảng thành phần wave ban đầu; không áp dụng drop/roguelite multiplier vào các mission này.
- Ba class kỹ sư, ba vũ khí, hệ thống Q/E/F, minimap, settings, pause và localStorage hiện hữu tiếp tục được dùng.

## 4. Kiểm tra đã thực hiện

| Hạng mục | Kết quả | Phạm vi |
|---|---|---|
| `node --check` cho toàn bộ file JavaScript | PASS | Kiểm tra cú pháp JavaScript, gồm asset pack và loader mới; chạy lại sau rà soát Phase 0–2 |
| Phân tích `index.html` | PASS | 15 script paths tồn tại, không có URL asset ngoài, 103 ID không trùng |
| `git diff --check` | PASS | Không phát hiện whitespace error |
| WaveManager logic harness | PASS | Wave gốc, boss wave 5 của Blackout/Endless, trạng thái upgrade Endless và trạng thái wave của mission thường |
| Enemy resource harness | PASS | Projectile recycle/reuse, chia sẻ resource theo loại, cleanup idempotent, Commander weakpoint và phase HP |
| Phase 2 asset parser audit | PASS (Three.js r128 harness) | 10 glTF assets parse được; 3 enemy models có SkinnedMesh, hierarchy, materials và clips; 3 weapon models + props tạo được |
| Phase 2 animation audit | PASS (Three.js r128 harness) | AnimationMixer tạo và cập nhật Idle/Run/Attack clips không có quaternion track warnings |
| Phase 2 raycast audit | PASS (Three.js r128 harness) | Drone/Speeder/Brute có hit mesh; raycast chính diện Commander trúng reactor weakpoint trước body; hidden fallback meshes bị loại khỏi hit targets |
| Phase 2 lifecycle audit | PASS (source + harness) | Enemy material instance được giải phóng; geometry glTF chia sẻ không bị dispose; fallback vẫn hoạt động nếu asset parse lỗi |
| Weapon viewmodel harness | PASS (Three.js r128 harness) | Cả 3 model súng được tạo; chiều dài model được căn theo trục nhìn -Z của camera |
| Grenade model lifecycle | PASS (Three.js r128 harness) | Prop_Grenade được tạo khi ném; reset dọn scene mà không dispose geometry/material dùng chung |
| Texture quality audit | PASS (loader harness) | Low/Medium chọn texture 512×512; High chọn texture 1024×1024; cả hai bộ file đều có trong package |
| Quaternius asset/license audit | PASS | 10 model glTF, 18 texture maps cục bộ, giấy phép CC0 1.0 được đóng gói |

| Kiểm tra file phụ thuộc cục bộ | PASS | Three.js, 15 script paths và toàn bộ texture glTF được tham chiếu nằm trong package |
| Local HTTP smoke test | PASS | `index.html`, `vendor/three.min.js`, asset manifest, loader và texture PNG cục bộ được phục vụ nguyên vẹn qua local server |
| Quét dependency runtime | PASS | Không phát hiện CDN, `fetch`, XHR, ES module hoặc import động trong mã HTML/CSS/JS của game |
| Kiểm tra gameplay trên trình duyệt | NOT RUN | Chromium trong môi trường đóng gói bị chặn điều hướng local (`ERR_BLOCKED_BY_ADMINISTRATOR`) |
| Kiểm tra trên điện thoại thật | NOT RUN | Không có thiết bị trình duyệt mobile trong môi trường đóng gói |

**Giới hạn kiểm định:** PASS ở trên là kiểm tra cú pháp, cấu trúc, đường dẫn asset và logic wave độc lập; không được hiểu là đã playtest end-to-end. Không có số FPS hoặc mức sử dụng bộ nhớ thực tế được khẳng định trong báo cáo. Dùng `F3` trong bản game để đo trên thiết bị mục tiêu.

## 5. Checklist QA thủ công đề xuất

1. Mở `index.html` trực tiếp hoặc chạy `python -m http.server 8080`; xác nhận menu, audio unlock và Pointer Lock.
2. Hoàn thành ba mission gốc để đối chiếu wave, thời lượng và độ khó với build trước; kiểm tra accuracy sau khi dùng grenade/airstrike.
3. Mở khóa Blackout ở level 2; kiểm tra barricade có chặn đạn đúng khi map hoạt động và không chặn đạn trong các map khác; bắn thử reactor core và các mảng giáp của Commander.
4. Trong Phase 2, kiểm tra texture PBR của Drone/Speeder/Brute, animation Idle/Run/Attack, raycast các phần thân, reactor Commander, model súng ở góc nhìn FPS, inspect `X`, reload/đổi súng và props/pickups trên trình duyệt thật.
5. Mở khóa Endless ở level 4; kiểm tra boss mỗi 5 wave, ba lựa chọn nâng cấp, pickup, combo, refill và freeze/unfreeze simulation.
6. Chơi nhiều wave liên tục, quan sát F3 để theo dõi geometry/texture count, draw calls và frame time.
7. Kiểm tra joystick, touch-look, các nút chiến đấu và pause trên ít nhất một điện thoại thật ở cả portrait/landscape.

## 6. Kết luận bàn giao

Source đã tích hợp phạm vi Phase 0–5 cùng Hybrid 3D asset integration và vượt qua các kiểm tra tĩnh/logic được liệt kê. Bản này phù hợp để chuyển sang vòng playtest trên trình duyệt và thiết bị mục tiêu. Các lỗi phát sinh chỉ có thể xác nhận tiếp sau khi chạy thật; báo cáo không tuyên bố đã hoàn tất kiểm thử runtime khi môi trường hiện tại không cho phép điều hướng trình duyệt local.
