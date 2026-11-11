/* ============================================================
   SKYWARD SALVAGE — textures.js  (V2)
   Toàn bộ texture sinh bằng Canvas API lúc khởi tạo.
   - Không load file ngoài → chạy được trên file://
   - Cache texture + material, không tạo bản trùng
   - Kích thước texture theo preset (LOW 256 / MED 512 / HIGH 1024)
   ============================================================ */

const Tex = (() => {
  let SIZE = 512;
  let ANISO = 4;
  const setCache = {};   // name -> { map, gray } canvases
  const texCache = {};   // name|rx|x|ry -> CanvasTexture
  const matCache = {};   // composite key -> Material

  // texture nào được phép dùng bản lớn ở preset HIGH
  const BIG = {
    concrete: 1, asphalt: 1, stone: 1, metal: 1, gunmetal: 1,
    floorplate: 1, container: 1, military: 1, gravel: 1
  };

  function init(opts) {
    opts = opts || {};
    SIZE = opts.size || 512;
    ANISO = opts.anisotropy || 4;
  }

  function sizeFor(name) {
    return BIG[name] ? SIZE : Math.min(512, SIZE);
  }

  // ---------------- utils ----------------
  function mk(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h === undefined ? w : h;
    return c;
  }

  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function rgba(hex, a) {
    const n = typeof hex === 'number' ? hex : parseInt(hex, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function shade(hex, f) {
    const n = typeof hex === 'number' ? hex : parseInt(hex, 16);
    const r = Math.max(0, Math.min(255, ((n >> 16) & 255) * f));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 255) * f));
    const b = Math.max(0, Math.min(255, (n & 255) * f));
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  }

  // value noise → Float32Array 0..1
  function vnoise(res, cells, seed) {
    const rand = rng(seed);
    const grid = new Float32Array(cells * cells);
    for (let i = 0; i < grid.length; i++) grid[i] = rand();
    const out = new Float32Array(res * res);
    const scale = cells / res;
    for (let y = 0; y < res; y++) {
      const gy = y * scale;
      const y0 = Math.floor(gy);
      const fy = gy - y0;
      const y1 = y0 + 1 >= cells ? 0 : y0 + 1;
      for (let x = 0; x < res; x++) {
        const gx = x * scale;
        const x0 = Math.floor(gx);
        const fx = gx - x0;
        const x1 = x0 + 1 >= cells ? 0 : x0 + 1;
        const a = grid[y0 * cells + x0];
        const b = grid[y0 * cells + x1];
        const c = grid[y1 * cells + x0];
        const d = grid[y1 * cells + x1];
        const top = a + (b - a) * fx;
        const bot = c + (d - c) * fx;
        out[y * res + x] = top + (bot - top) * fy;
      }
    }
    return out;
  }

  // fractal brownian motion → grayscale canvas
  // giá trị được map vào [lo, hi] để dùng làm roughness map (tránh quá bóng)
  function fbm(res, seed, octaves, persistence, lo, hi) {
    const acc = new Float32Array(res * res);
    let amp = 1, total = 0, cells = 4;
    for (let o = 0; o < octaves; o++) {
      const n = vnoise(res, cells, seed + o * 7919);
      for (let i = 0; i < acc.length; i++) acc[i] += n[i] * amp;
      total += amp;
      amp *= (persistence || 0.5);
      cells *= 2;
    }
    const lo2 = lo === undefined ? 0 : lo;
    const hi2 = hi === undefined ? 1 : hi;
    const c = mk(res);
    const g = c.getContext('2d');
    const img = g.createImageData(res, res);
    const d = img.data;
    for (let i = 0; i < acc.length; i++) {
      const t = acc[i] / total;
      const v = Math.max(0, Math.min(255, (lo2 + t * (hi2 - lo2)) * 255)) | 0;
      const j = i * 4;
      d[j] = d[j + 1] = d[j + 2] = v;
      d[j + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  // vẽ 1 canvas grayscale lên canvas khác theo blend mode
  // LƯU Ý: 'overlay' rất mạnh, dễ bị bạc màu → đổi sang 'soft-light' cho albedo
  function blend(g, canvas, mode, alpha) {
    g.save();
    g.globalCompositeOperation = (mode === 'overlay') ? 'soft-light' : mode;
    g.globalAlpha = alpha;
    g.drawImage(canvas, 0, 0, g.canvas.width, g.canvas.height);
    g.restore();
  }

  function speckle(g, w, h, rand, count, colors, rMin, rMax, alpha) {
    for (let i = 0; i < count; i++) {
      g.globalAlpha = alpha * (0.3 + rand() * 0.7);
      g.fillStyle = colors[(rand() * colors.length) | 0];
      const r = rMin + rand() * (rMax - rMin);
      g.beginPath();
      g.arc(rand() * w, rand() * h, r, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  function scratches(g, w, h, rand, count, color, alpha, maxLen) {
    g.strokeStyle = color;
    g.lineCap = 'round';
    for (let i = 0; i < count; i++) {
      g.globalAlpha = alpha * (0.25 + rand() * 0.75);
      g.lineWidth = 0.5 + rand() * 1.5;
      const x = rand() * w, y = rand() * h;
      const a = rand() * Math.PI * 2;
      const len = 10 + rand() * (maxLen || 90);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  function cracks(g, w, h, rand, count, color, alpha) {
    g.strokeStyle = color;
    g.lineCap = 'round';
    for (let i = 0; i < count; i++) {
      g.globalAlpha = alpha * (0.5 + rand() * 0.5);
      g.lineWidth = 0.6 + rand() * 1.8;
      let x = rand() * w, y = rand() * h;
      let ang = rand() * Math.PI * 2;
      g.beginPath();
      g.moveTo(x, y);
      const steps = 8 + ((rand() * 22) | 0);
      for (let s = 0; s < steps; s++) {
        ang += (rand() - 0.5) * 1.15;
        const len = 7 + rand() * 26;
        x += Math.cos(ang) * len;
        y += Math.sin(ang) * len;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  function stains(g, w, h, rand, count, color, alpha, rMax) {
    for (let i = 0; i < count; i++) {
      const x = rand() * w, y = rand() * h;
      const r = 18 + rand() * (rMax || 90);
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, rgba(color, alpha * (0.4 + rand() * 0.6)));
      grd.addColorStop(1, rgba(color, 0));
      g.fillStyle = grd;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  }

  function streaks(g, w, h, rand, count, color, alpha) {
    // vệt dọc (nước chảy / rỉ sét)
    for (let i = 0; i < count; i++) {
      const x = rand() * w;
      const y = rand() * h * 0.5;
      const len = 30 + rand() * 130;
      const wd = 2 + rand() * 9;
      const grd = g.createLinearGradient(x, y, x, y + len);
      grd.addColorStop(0, rgba(color, alpha * (0.5 + rand() * 0.5)));
      grd.addColorStop(1, rgba(color, 0));
      g.fillStyle = grd;
      g.fillRect(x - wd / 2, y, wd, len);
    }
  }

  // ---------------- builders ----------------
  // mỗi builder: (canvas, gray, rand) => void   [canvas = màu, gray = grayscale dùng cho bump/rough]

  const BUILDERS = {

    concrete(g, gray, rand, w, h) {
      const base = '#83837d';
      g.fillStyle = base;
      g.fillRect(0, 0, w, h);
      blend(g, gray, 'overlay', 0.5);
      stains(g, w, h, rand, 26, 0x4a4a46, 0.16, 130);
      stains(g, w, h, rand, 14, 0xb8b8b0, 0.10, 100);
      speckle(g, w, h, rand, 2600, ['#6f6f6b', '#a5a5a0', '#7d7d78'], 0.4, 1.6, 0.5);
      cracks(g, w, h, rand, 9, 0x3c3c39, 0.5);
      cracks(g, w, h, rand, 4, 0x6a6a66, 0.35);
      scratches(g, w, h, rand, 40, 0xb0b0aa, 0.18, 70);
    },

    asphalt(g, gray, rand, w, h) {
      g.fillStyle = '#3b3e42';
      g.fillRect(0, 0, w, h);
      blend(g, gray, 'overlay', 0.6);
      // vết sửa chữa / patch tối hơn
      for (let i = 0; i < 7; i++) {
        g.globalAlpha = 0.16 + rand() * 0.16;
        g.fillStyle = rand() < 0.5 ? '#2c2f33' : '#4a4e53';
        const pw = 60 + rand() * 220, ph = 60 + rand() * 220;
        g.fillRect(rand() * w, rand() * h, pw, ph);
      }
      g.globalAlpha = 1;
      speckle(g, w, h, rand, 5200, ['#565b61', '#2f3236', '#6a7077'], 0.4, 1.8, 0.55);
      cracks(g, w, h, rand, 14, 0x22252a, 0.6);
      cracks(g, w, h, rand, 6, 0x55595e, 0.25);
      stains(g, w, h, rand, 16, 0x1e2023, 0.2, 110);
      stains(g, w, h, rand, 8, 0x6d6f6a, 0.10, 90);
    },

    stone(g, gray, rand, w, h) {
      g.fillStyle = '#726c61';
      g.fillRect(0, 0, w, h);
      blend(g, gray, 'overlay', 0.7);
      // các mảng đá
      for (let i = 0; i < 26; i++) {
        g.globalAlpha = 0.10 + rand() * 0.16;
        g.fillStyle = rand() < 0.5 ? '#5b564c' : '#857e70';
        const x = rand() * w, y = rand() * h;
        const rx = 22 + rand() * 70, ry = 16 + rand() * 50;
        g.beginPath();
        g.ellipse(x, y, rx, ry, rand() * 3.14, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
      speckle(g, w, h, rand, 3000, ['#4e4a42', '#8d8678', '#625d53'], 0.5, 2.2, 0.5);
      cracks(g, w, h, rand, 20, 0x35322c, 0.65);
      cracks(g, w, h, rand, 10, 0x8b8474, 0.3);
      stains(g, w, h, rand, 20, 0x3f3b33, 0.2, 120);
    },

    gravel(g, gray, rand, w, h) {
      g.fillStyle = '#6e675c';
      g.fillRect(0, 0, w, h);
      blend(g, gray, 'overlay', 0.45);
      // sỏi
      for (let i = 0; i < 2600; i++) {
        const x = rand() * w, y = rand() * h;
        const r = 1.2 + rand() * 4.2;
        const f = 0.7 + rand() * 0.6;
        g.globalAlpha = 0.5 + rand() * 0.5;
        g.fillStyle = shade(0x8a8175, f);
        g.beginPath();
        g.ellipse(x, y, r, r * (0.7 + rand() * 0.5), rand() * 3.14, 0, Math.PI * 2);
        g.fill();
        // bóng nhỏ
        g.globalAlpha = 0.18;
        g.fillStyle = '#2c2a26';
        g.beginPath();
        g.ellipse(x + r * 0.4, y + r * 0.5, r * 0.8, r * 0.5, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
      stains(g, w, h, rand, 14, 0x46423a, 0.18, 110);
    },

    dirt(g, gray, rand, w, h) {
      g.fillStyle = '#6a5741';
      g.fillRect(0, 0, w, h);
      blend(g, gray, 'overlay', 0.6);
      stains(g, w, h, rand, 24, 0x40342a, 0.22, 140);
      stains(g, w, h, rand, 16, 0x8a7355, 0.14, 120);
      speckle(g, w, h, rand, 2200, ['#54432f', '#7d6749', '#8f7a5a', '#4a3a28'], 0.5, 2.0, 0.5);
      // vệt lún
      g.strokeStyle = rgba(0x4a3a28, 0.25);
      for (let i = 0; i < 22; i++) {
        g.lineWidth = 2 + rand() * 6;
        g.beginPath();
        const y = rand() * h;
        g.moveTo(0, y);
        g.bezierCurveTo(w * 0.3, y + (rand() - 0.5) * 40, w * 0.7, y + (rand() - 0.5) * 40, w, y + (rand() - 0.5) * 30);
        g.stroke();
      }
    },

    metal(g, gray, rand, w, h) {
      g.fillStyle = '#6d7379';
      g.fillRect(0, 0, w, h);
      blend(g, gray, 'overlay', 0.4);
      // vân mài ngang
      for (let i = 0; i < 160; i++) {
        g.globalAlpha = 0.05 + rand() * 0.10;
        g.strokeStyle = rand() < 0.5 ? '#8b9298' : '#54595f';
        g.lineWidth = 0.5 + rand() * 1.6;
        const y = rand() * h;
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(w, y + (rand() - 0.5) * 8);
        g.stroke();
      }
      g.globalAlpha = 1;
      scratches(g, w, h, rand, 70, 0x9aa1a7, 0.35, 150);
      scratches(g, w, h, rand, 40, 0x3f4449, 0.3, 120);
      stains(g, w, h, rand, 16, 0x3a3f45, 0.22, 120);
      stains(g, w, h, rand, 10, 0x8d9298, 0.10, 90);
    },

    gunmetal(g, gray, rand, w, h) {
      g.fillStyle = '#33383d';
      g.fillRect(0, 0, w, h);
      blend(g, gray, 'overlay', 0.35);
      for (let i = 0; i < 220; i++) {
        g.globalAlpha = 0.04 + rand() * 0.08;
        g.strokeStyle = rand() < 0.5 ? '#4a5157' : '#24282c';
        g.lineWidth = 0.5 + rand() * 1.2;
        const y = rand() * h;
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(w, y + (rand() - 0.5) * 5);
        g.stroke();
      }
      g.globalAlpha = 1;
      scratches(g, w, h, rand, 55, 0x6b747b, 0.3, 130);
      scratches(g, w, h, rand, 30, 0x1c1f22, 0.35, 100);
      stains(g, w, h, rand, 10, 0x1e2124, 0.25, 100);
    },

    rust(g, gray, rand, w, h) {
      g.fillStyle = '#5c5650';
      g.fillRect(0, 0, w, h);
      blend(g, gray, 'overlay', 0.4);
      // ve gỉ
      for (let i = 0; i < 46; i++) {
        const x = rand() * w, y = rand() * h;
        const r = 8 + rand() * 60;
        const grd = g.createRadialGradient(x, y, 0, x, y, r);
        const c = rand() < 0.5 ? 0x8a4a24 : 0x6b3a1e;
        grd.addColorStop(0, rgba(c, 0.55));
        grd.addColorStop(0.6, rgba(c, 0.22));
        grd.addColorStop(1, rgba(c, 0));
        g.fillStyle = grd;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
      }
      streaks(g, w, h, rand, 22, 0x7a3f1e, 0.35);
      speckle(g, w, h, rand, 1400, ['#96522a', '#4a3a30', '#b06a34'], 0.5, 2.4, 0.5);
      scratches(g, w, h, rand, 35, 0x9a938a, 0.2, 90);
    },

    military(g, gray, rand, w, h) {
      g.fillStyle = '#4b5138';
      g.fillRect(0, 0, w, h);
      blend(g, gray, 'overlay', 0.45);
      // vệt mòn sơn
      for (let i = 0; i < 60; i++) {
        g.globalAlpha = 0.06 + rand() * 0.12;
        g.fillStyle = rand() < 0.5 ? '#5f6647' : '#3a3f2b';
        const x = rand() * w, y = rand() * h;
        g.beginPath();
        g.ellipse(x, y, 10 + rand() * 60, 6 + rand() * 30, rand() * 3.14, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
      scratches(g, w, h, rand, 60, 0x767d57, 0.3, 110);
      scratches(g, w, h, rand, 35, 0x2c3020, 0.3, 90);
      stains(g, w, h, rand, 12, 0x2a2d1f, 0.28, 100);
      stains(g, w, h, rand, 8, 0x8b8a63, 0.10, 90);
      speckle(g, w, h, rand, 900, ['#3a3f2b', '#5f6647', '#6d7350'], 0.4, 1.6, 0.4);
    },

    wood(g, gray, rand, w, h) {
      g.fillStyle = '#6b5334';
      g.fillRect(0, 0, w, h);
      blend(g, gray, 'overlay', 0.4);
      // vân gỗ
      for (let i = 0; i < 46; i++) {
        g.globalAlpha = 0.10 + rand() * 0.16;
        g.strokeStyle = rand() < 0.5 ? '#7d6240' : '#55402a';
        g.lineWidth = 1 + rand() * 3.4;
        const y = rand() * h;
        g.beginPath();
        g.moveTo(0, y);
        g.bezierCurveTo(w * 0.3, y + (rand() - 0.5) * 22, w * 0.7, y + (rand() - 0.5) * 22, w, y + (rand() - 0.5) * 14);
        g.stroke();
      }
      g.globalAlpha = 1;
      // mặt gỗ tách
      for (let i = 1; i < 4; i++) {
        g.globalAlpha = 0.5;
        g.strokeStyle = '#3a2c1c';
        g.lineWidth = 2.5;
        g.beginPath();
        g.moveTo(0, (h / 4) * i + (rand() - 0.5) * 4);
        g.lineTo(w, (h / 4) * i + (rand() - 0.5) * 4);
        g.stroke();
      }
      g.globalAlpha = 1;
      // mắt gỗ
      for (let i = 0; i < 7; i++) {
        const x = rand() * w, y = rand() * h;
        g.globalAlpha = 0.5;
        g.strokeStyle = '#4a3823';
        g.lineWidth = 1.6;
        g.beginPath();
        g.ellipse(x, y, 5 + rand() * 8, 3 + rand() * 5, rand(), 0, Math.PI * 2);
        g.stroke();
      }
      g.globalAlpha = 1;
      stains(g, w, h, rand, 14, 0x3a2c1c, 0.22, 110);
      scratches(g, w, h, rand, 30, 0x8a6f4a, 0.2, 80);
    },

    floorplate(g, gray, rand, w, h) {
      g.fillStyle = '#4a4f54';
      g.fillRect(0, 0, w, h);
      blend(g, gray, 'overlay', 0.4);
      // tấm sàn chữ nhật
      const cell = w / 6;
      for (let y = 0; y < 6; y++) {
        for (let x = 0; x < 6; x++) {
          g.globalAlpha = 0.10 + rand() * 0.10;
          g.fillStyle = rand() < 0.5 ? '#585e64' : '#3d4247';
          g.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
        }
      }
      g.globalAlpha = 1;
      // hoa văn chống trượt (chấm chéo)
      g.strokeStyle = rgba(0x767d84, 0.5);
      g.lineWidth = 3;
      for (let y = 0; y < 6; y++) {
        for (let x = 0; x < 6; x++) {
          const cx = x * cell + cell / 2, cy = y * cell + cell / 2;
          g.beginPath();
          g.moveTo(cx - cell * 0.28, cy + cell * 0.28);
          g.lineTo(cx + cell * 0.28, cy - cell * 0.28);
          g.stroke();
        }
      }
      scratches(g, w, h, rand, 50, 0x7d848b, 0.28, 120);
      stains(g, w, h, rand, 18, 0x2b2f33, 0.28, 110);
      speckle(g, w, h, rand, 1200, ['#5d646b', '#31363b'], 0.4, 1.6, 0.4);
    },

    container(g, gray, rand, w, h) {
      g.fillStyle = '#5d6b62';
      g.fillRect(0, 0, w, h);
      blend(g, gray, 'overlay', 0.4);
      // gợn dọc
      const step = w / 12;
      for (let i = 0; i < 12; i++) {
        g.globalAlpha = 0.5;
        g.fillStyle = i % 2 === 0 ? '#68776d' : '#4e5a52';
        g.fillRect(i * step, 0, step, h);
        g.globalAlpha = 0.35;
        g.fillStyle = '#2f3833';
        g.fillRect(i * step, 0, 2, h);
      }
      g.globalAlpha = 1;
      streaks(g, w, h, rand, 26, 0x3a2a1e, 0.3);
      stains(g, w, h, rand, 20, 0x2f3833, 0.3, 130);
      // gỉ quanh góc
      for (let i = 0; i < 24; i++) {
        const edge = (rand() * 4) | 0;
        const x = edge === 0 ? rand() * w : edge === 1 ? rand() * w : edge === 2 ? rand() * 24 : w - rand() * 24;
        const y = edge === 0 ? rand() * 24 : edge === 1 ? h - rand() * 24 : rand() * h;
        const r = 6 + rand() * 34;
        const grd = g.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, rgba(0x7a4526, 0.5));
        grd.addColorStop(1, rgba(0x7a4526, 0));
        g.fillStyle = grd;
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
      scratches(g, w, h, rand, 40, 0x8b9690, 0.22, 100);
    },

    grass(g, gray, rand, w, h) {
      g.fillStyle = '#5c6c44';
      g.fillRect(0, 0, w, h);
      blend(g, gray, 'overlay', 0.55);
      stains(g, w, h, rand, 20, 0x3f4a2c, 0.22, 130);
      stains(g, w, h, rand, 14, 0x7d8a5c, 0.16, 110);
      // cỏ
      for (let i = 0; i < 5200; i++) {
        const x = rand() * w, y = rand() * h;
        const len = 2 + rand() * 5;
        const a = -Math.PI / 2 + (rand() - 0.5) * 0.9;
        g.globalAlpha = 0.25 + rand() * 0.45;
        g.strokeStyle = rand() < 0.5 ? '#6d7f4e' : '#4a5a34';
        g.lineWidth = 0.8 + rand() * 1.1;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
        g.stroke();
      }
      g.globalAlpha = 1;
      speckle(g, w, h, rand, 700, ['#8a7a52', '#4a5a34', '#6d7f4e'], 0.4, 1.4, 0.4);
    },

    hazard(g, gray, rand, w, h) {
      g.fillStyle = '#c9a227';
      g.fillRect(0, 0, w, h);
      // sọc chéo đen
      g.fillStyle = '#22211f';
      const sw = w / 8;
      for (let i = -8; i < 16; i++) {
        g.save();
        g.translate(i * sw * 2, 0);
        g.rotate(Math.PI / 4);
        g.fillRect(0, -h, sw, h * 3);
        g.restore();
      }
      blend(g, gray, 'overlay', 0.5);
      // mòn, bùn
      stains(g, w, h, rand, 30, 0x3a3129, 0.3, 100);
      scratches(g, w, h, rand, 70, 0x8a7a4a, 0.35, 110);
      scratches(g, w, h, rand, 40, 0x1a1917, 0.4, 90);
      speckle(g, w, h, rand, 1500, ['#3a3129', '#a08a30'], 0.5, 2.2, 0.45);
    },

    crate(g, gray, rand, w, h) {
      g.fillStyle = '#5c5a3c';
      g.fillRect(0, 0, w, h);
      blend(g, gray, 'overlay', 0.45);
      // khung
      g.strokeStyle = '#3f3d28';
      g.lineWidth = w * 0.03;
      g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth);
      g.beginPath();
      g.moveTo(0, 0); g.lineTo(w, h);
      g.moveTo(w, 0); g.lineTo(0, h);
      g.stroke();
      scratches(g, w, h, rand, 45, 0x7d7a52, 0.3, 110);
      scratches(g, w, h, rand, 30, 0x33311f, 0.35, 90);
      stains(g, w, h, rand, 18, 0x2f2d1c, 0.3, 120);
      speckle(g, w, h, rand, 1000, ['#6b6846', '#403e28'], 0.4, 1.6, 0.4);
    }
  };

  // ---------------- generate ----------------
  function buildSet(name) {
    if (setCache[name]) return setCache[name];
    const size = sizeFor(name);
    const builder = BUILDERS[name];
    if (!builder) return null;

    const color = mk(size);
    const g = color.getContext('2d');
    // gray: dùng cho bump + roughness (sáng, đọc được độ nhám)
    const gray = fbm(size, name.length * 131 + 17, 4, 0.55, 0.62, 1.0);
    // tone: dùng để pha màu albedo (tối hơn, tránh bạc màu)
    const tone = fbm(size, name.length * 401 + 7, 4, 0.5, 0.22, 0.82);
    const rand = rng(name.length * 977 + 31);

    builder(g, tone, rand, size, size);

    // dùng chung grayscale cho bump + roughness
    const set = { map: color, gray: gray, size: size };
    setCache[name] = set;
    return set;
  }

  function makeTex(canvas, rx, ry, srgb) {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx || 1, ry || 1);
    t.anisotropy = ANISO;
    if (srgb) t.encoding = THREE.sRGBEncoding;
    return t;
  }

  function tex(name, rx, ry) {
    const set = buildSet(name);
    if (!set) return null;
    const key = name + '|' + rx + 'x' + ry;
    if (texCache[key]) return texCache[key];
    const t = makeTex(set.map, rx, ry, true);
    texCache[key] = t;
    return t;
  }

  function grayTex(name, rx, ry) {
    const set = buildSet(name);
    if (!set) return null;
    const key = 'g|' + name + '|' + rx + 'x' + ry;
    if (texCache[key]) return texCache[key];
    const t = makeTex(set.gray, rx, ry, false);
    texCache[key] = t;
    return t;
  }

  function mat(name, opts) {
    opts = opts || {};
    const rx = opts.rx || 1, ry = opts.ry || 1;
    const key = name + '|' + rx + 'x' + ry + '|' + JSON.stringify(opts);
    if (matCache[key]) return matCache[key];
    const set = buildSet(name);
    if (!set) return new THREE.MeshStandardMaterial(opts);

    const m = new THREE.MeshStandardMaterial({
      map: tex(name, rx, ry),
      roughnessMap: grayTex(name, rx, ry),
      bumpMap: grayTex(name, rx, ry),
      color: opts.color !== undefined ? opts.color : 0xffffff,
      roughness: opts.roughness !== undefined ? opts.roughness : 1,
      metalness: opts.metalness !== undefined ? opts.metalness : 0,
      bumpScale: opts.bumpScale !== undefined ? opts.bumpScale : 0.015
    });
    m.userData = { tex: name };
    if (opts.side) m.side = opts.side;
    matCache[key] = m;
    return m;
  }

  function has(name) { return !!BUILDERS[name]; }

  // ---------------- texture đặc biệt (decal, khói, shockwave, flash) ----------------
  const SPECIAL = {
    bulletHole() {
      const s = 128;
      const c = mk(s);
      const g = c.getContext('2d');
      const cx = s / 2, cy = s / 2;
      // vệt bẩn xung quanh
      for (let i = 0; i < 16; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = 12 + Math.random() * 34;
        const r = 4 + Math.random() * 12;
        const grd = g.createRadialGradient(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 0, cx + Math.cos(a) * d, cy + Math.sin(a) * d, r);
        grd.addColorStop(0, 'rgba(30,26,22,0.35)');
        grd.addColorStop(1, 'rgba(30,26,22,0)');
        g.fillStyle = grd;
        g.beginPath(); g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r, 0, Math.PI * 2); g.fill();
      }
      // lỗ đạn
      const hole = g.createRadialGradient(cx, cy, 0, cx, cy, 20);
      hole.addColorStop(0, 'rgba(8,8,8,0.98)');
      hole.addColorStop(0.45, 'rgba(18,16,14,0.9)');
      hole.addColorStop(0.75, 'rgba(40,36,30,0.45)');
      hole.addColorStop(1, 'rgba(40,36,30,0)');
      g.fillStyle = hole;
      g.beginPath(); g.arc(cx, cy, 22, 0, Math.PI * 2); g.fill();
      // nứt tỏa ra
      g.strokeStyle = 'rgba(20,18,16,0.7)';
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + Math.random() * 0.5;
        g.lineWidth = 0.8 + Math.random() * 1.2;
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14);
        const mx = cx + Math.cos(a) * (22 + Math.random() * 10);
        const my = cy + Math.sin(a) * (22 + Math.random() * 10);
        g.lineTo(mx, my);
        g.lineTo(cx + Math.cos(a + 0.2) * (32 + Math.random() * 14), cy + Math.sin(a + 0.2) * (32 + Math.random() * 14));
        g.stroke();
      }
      return c;
    },

    smoke() {
      const s = 128;
      const c = mk(s);
      const g = c.getContext('2d');
      const cx = s / 2, cy = s / 2;
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * 30;
        const r = 14 + Math.random() * 26;
        const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
        const grd = g.createRadialGradient(x, y, 0, x, y, r);
        const v = 200 + Math.floor(Math.random() * 40);
        grd.addColorStop(0, 'rgba(' + v + ',' + v + ',' + v + ',0.30)');
        grd.addColorStop(1, 'rgba(' + v + ',' + v + ',' + v + ',0)');
        g.fillStyle = grd;
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
      return c;
    },

    ring() {
      const s = 256;
      const c = mk(s);
      const g = c.getContext('2d');
      const cx = s / 2, cy = s / 2;
      const grd = g.createRadialGradient(cx, cy, 0, cx, cy, cx);
      grd.addColorStop(0, 'rgba(255,240,220,0)');
      grd.addColorStop(0.42, 'rgba(255,240,220,0)');
      grd.addColorStop(0.58, 'rgba(255,250,240,0.85)');
      grd.addColorStop(0.72, 'rgba(255,220,180,0.35)');
      grd.addColorStop(1, 'rgba(255,210,170,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, s, s);
      return c;
    },

    flash() {
      const s = 128;
      const c = mk(s);
      const g = c.getContext('2d');
      const cx = s / 2, cy = s / 2;
      // ngôi sao
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const len = i % 2 === 0 ? cx * 0.95 : cx * 0.55;
        const grd = g.createLinearGradient(cx, cy, cx + Math.cos(a) * len, cy + Math.sin(a) * len);
        grd.addColorStop(0, 'rgba(255,250,235,0.95)');
        grd.addColorStop(0.4, 'rgba(255,200,120,0.5)');
        grd.addColorStop(1, 'rgba(255,160,60,0)');
        g.strokeStyle = grd;
        g.lineWidth = i % 2 === 0 ? 9 : 13;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
        g.stroke();
      }
      const core = g.createRadialGradient(cx, cy, 0, cx, cy, 26);
      core.addColorStop(0, 'rgba(255,255,250,1)');
      core.addColorStop(0.5, 'rgba(255,220,160,0.7)');
      core.addColorStop(1, 'rgba(255,180,80,0)');
      g.fillStyle = core;
      g.beginPath(); g.arc(cx, cy, 26, 0, Math.PI * 2); g.fill();
      return c;
    }
  };

  const specialCache = {};
  function special(name) {
    if (specialCache[name]) return specialCache[name];
    const builder = SPECIAL[name];
    if (!builder) return null;
    const t = new THREE.CanvasTexture(builder());
    t.encoding = THREE.sRGBEncoding;
    specialCache[name] = t;
    return t;
  }

  function stats() {
    return {
      sets: Object.keys(setCache).length,
      textures: Object.keys(texCache).length,
      materials: Object.keys(matCache).length,
      special: Object.keys(specialCache).length
    };
  }

  return { init, mat, tex, grayTex, has, stats, special, get size() { return SIZE; } };
})();
