'use strict';
/* Panel Mini App — sisi depan. Mode contoh: buka dengan ?mock=1 buat lihat UI tanpa Telegram. */
const PARAMS = new URLSearchParams(location.search);
const MOCK = PARAMS.has('mock');
const tg = (!MOCK && window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;
const INIT_DATA = tg ? (tg.initData || '') : '';

const $ = (id) => document.getElementById(id);
const elPanel = $('panel'), elStatus = $('layar-status'), elLuar = $('layar-luar');
const elTeksStatus = $('teks-status'), elUlang = $('tombol-ulang');

let sibuk = false;         // lagi jalanin aksi → jangan timpa pakai segar otomatis
let rotiTimer = null;

if (tg) { try { tg.ready(); tg.expand(); } catch { /* abaikan */ } }

function getar(jenis) {
  if (!tg || !tg.HapticFeedback) return;
  try {
    if (jenis === 'ok') tg.HapticFeedback.notificationOccurred('success');
    else if (jenis === 'gagal') tg.HapticFeedback.notificationOccurred('error');
    else tg.HapticFeedback.impactOccurred('light');
  } catch { /* abaikan */ }
}

function roti(teks, lama = 2600) {
  const r = $('roti');
  r.textContent = teks;
  r.classList.remove('sembunyi');
  requestAnimationFrame(() => r.classList.add('tampil'));
  clearTimeout(rotiTimer);
  rotiTimer = setTimeout(() => {
    r.classList.remove('tampil');
    setTimeout(() => r.classList.add('sembunyi'), 320);
  }, lama);
}

/* ---------- data ---------- */
const DATA_MOCK = {
  box: { hostname: 'ubuntu-4cpu-8gb-sg-sin1', uptimeSec: 93784, loadavg: [1.42, 1.1, 0.87], cpuCount: 4, memTotal: 8589934592, memFree: 3221225472, diskUsedPct: 38 },
  apps: [
    { name: 'botai', status: 'online', uptimeSec: 7320, restarts: 2, cpuPct: 1.4, memMB: 86.5 },
    { name: 'bot7', status: 'stopped', uptimeSec: 0, restarts: 0, cpuPct: 0, memMB: 0 },
    { name: 'ogtes', status: 'errored', uptimeSec: 0, restarts: 14, cpuPct: 0, memMB: 0 },
  ],
};

async function ambilStatus() {
  if (MOCK) { await new Promise((r) => setTimeout(r, 350)); return structuredClone(DATA_MOCK); }
  const r = await fetch('/api/status', { headers: { 'X-Init-Data': INIT_DATA } });
  if (!r.ok) throw new Error('status ' + r.status);
  return r.json();
}

async function kirimAksi(app, aksi) {
  if (MOCK) {
    await new Promise((r) => setTimeout(r, 600));
    const tiruan = structuredClone(DATA_MOCK);
    const a = tiruan.apps.find((x) => x.name === app);
    if (a) {
      if (aksi === 'stop') { a.status = 'stopped'; a.uptimeSec = 0; }
      if (aksi === 'start' || aksi === 'restart') { a.status = 'online'; a.uptimeSec = aksi === 'restart' ? 0 : a.uptimeSec; if (aksi === 'restart') a.restarts += 1; }
    }
    DATA_MOCK.apps = tiruan.apps;
    return tiruan;
  }
  const r = await fetch('/api/aksi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Init-Data': INIT_DATA },
    body: JSON.stringify({ app, aksi }),
  });
  if (!r.ok) throw new Error('status ' + r.status);
  return r.json();
}

/* ---------- format ---------- */
function lamaDetik(s) {
  s = Math.max(0, Math.floor(s || 0));
  if (s < 60) return 'baru aja';
  const m = Math.floor(s / 60);
  if (m < 60) return m + ' mnt';
  const j = Math.floor(m / 60);
  if (j < 24) return j + ' jam ' + (m % 60) + ' mnt';
  return Math.floor(j / 24) + ' hari ' + (j % 24) + ' jam';
}
function gb(b) { return (b / 1073741824).toFixed(1).replace('.', ',') + ' GB'; }
function kelasBar(pct) { return pct >= 85 ? 'merah' : pct >= 60 ? 'kuning' : 'hijau'; }
function setBar(idBar, idTeks, pct, teks) {
  const bar = $(idBar);
  bar.style.width = Math.min(100, Math.max(0, pct)) + '%';
  bar.className = 'bar-isi ' + kelasBar(pct);
  $(idTeks).textContent = teks;
}
const STATUS_ID = { online: 'Nyala', stopped: 'Mati', errored: 'Error', launching: 'Nyiapin', unknown: '?' };

/* ---------- gambar ulang ---------- */
function gambar(data) {
  const { box, apps } = data;
  $('nama-box').textContent = box.hostname || 'server';
  $('nyala-box').textContent = 'nyala ' + lamaDetik(box.uptimeSec);

  const beban = box.loadavg && box.loadavg.length ? box.loadavg[0] : 0;
  const pctCpu = box.cpuCount ? (beban / box.cpuCount) * 100 : 0;
  $('pil-beban').textContent = 'beban ' + beban.toFixed(2);
  setBar('bar-cpu', 'teks-cpu', pctCpu, Math.round(pctCpu) + '% • ' + beban.toFixed(2) + ' / ' + box.cpuCount + ' core');

  const pctRam = box.memTotal ? ((box.memTotal - box.memFree) / box.memTotal) * 100 : 0;
  setBar('bar-ram', 'teks-ram', pctRam, Math.round(pctRam) + '% • ' + gb(box.memTotal - box.memFree) + ' / ' + gb(box.memTotal));

  if (box.diskUsedPct === null || box.diskUsedPct === undefined) setBar('bar-disk', 'teks-disk', 0, '—');
  else setBar('bar-disk', 'teks-disk', box.diskUsedPct, box.diskUsedPct + '% kepakai');

  const wadah = $('daftar-app');
  wadah.innerHTML = '';
  $('app-kosong').classList.toggle('sembunyi', apps.length > 0);

  for (const app of apps) {
    const kartu = document.createElement('article');
    kartu.className = 'kartu kartu-app';

    const atas = document.createElement('div');
    atas.className = 'app-atas';
    const titik = document.createElement('span');
    titik.className = 'titik ' + (['online', 'stopped', 'errored', 'launching'].includes(app.status) ? app.status : 'lain');
    const nama = document.createElement('span');
    nama.className = 'app-nama';
    nama.textContent = app.name;
    const st = document.createElement('span');
    st.className = 'app-status ' + app.status;
    st.textContent = STATUS_ID[app.status] || app.status;
    atas.append(titik, nama, st);

    const meta = document.createElement('div');
    meta.className = 'app-meta';
    meta.innerHTML =
      '<span>⏱️ nyala <b></b></span><span>🔁 restart <b></b></span><span>🧠 <b></b></span><span>⚡ CPU <b></b></span>';
    const b = meta.querySelectorAll('b');
    b[0].textContent = app.status === 'online' ? lamaDetik(app.uptimeSec) : '—';
    b[1].textContent = app.restarts + '×';
    b[2].textContent = app.memMB ? app.memMB.toFixed(0) + ' MB' : '—';
    b[3].textContent = app.cpuPct ? app.cpuPct + '%' : '—';

    const tombolWadah = document.createElement('div');
    tombolWadah.className = 'app-tombol';
    const daftar = app.status === 'online'
      ? [['jeda', 'stop', '⏸️ Jeda'], ['restart', 'restart', '🔁 Restart']]
      : [['mulai', 'start', '▶️ Mulai'], ['restart', 'restart', '🔁 Restart']];
    for (const [kelas, aksi, label] of daftar) {
      const t = document.createElement('button');
      t.className = 'tombol ' + kelas;
      t.textContent = label;
      t.addEventListener('click', () => sentuhTombol(t, app.name, aksi, label));
      tombolWadah.appendChild(t);
    }

    kartu.append(atas, meta, tombolWadah);
    wadah.appendChild(kartu);
  }

  $('segar-terakhir').textContent = 'disegar ' + new Date().toLocaleTimeString('id-ID');
}

async function sentuhTombol(tombol, app, aksi, labelAsli) {
  if (tombol.dataset.konfirm !== '1') {
    // ketuk pertama → mode yakin
    tombol.dataset.konfirm = '1';
    tombol.dataset.label = labelAsli;
    tombol.textContent = 'Yakin?';
    tombol.classList.add('konfirm');
    getar('ringan');
    setTimeout(() => {
      if (tombol.dataset.konfirm === '1' && !tombol.disabled) {
        tombol.dataset.konfirm = '';
        tombol.textContent = labelAsli;
        tombol.classList.remove('konfirm');
      }
    }, 2600);
    return;
  }
  // ketuk kedua → eksekusi
  tombol.dataset.konfirm = '';
  tombol.classList.remove('konfirm');
  tombol.disabled = true;
  tombol.textContent = 'Sebentar…';
  sibuk = true;
  try {
    const data = await kirimAksi(app, aksi);
    gambar(data);
    getar('ok');
    roti({ start: ' dinyalain ▶️', stop: ' dijeda ⏸️', restart: ' di-restart 🔁' }[aksi].replace(' ', app));
  } catch {
    getar('gagal');
    roti('Yah, gagal. Coba lagi bentar lagi ya 🙏');
    tombol.disabled = false;
    tombol.textContent = labelAsli;
  } finally {
    sibuk = false;
  }
}

/* ---------- alur utama ---------- */
async function segar() {
  if (sibuk) return;
  try {
    const data = await ambilStatus();
    elStatus.classList.add('sembunyi');
    elPanel.classList.remove('sembunyi');
    gambar(data);
  } catch {
    if (elPanel.classList.contains('sembunyi')) {
      elStatus.classList.remove('sembunyi');
      elTeksStatus.textContent = 'Servernya lagi nggak nyaut. Tidur kali ya dia. Coba lagi ya.';
      elUlang.classList.remove('sembunyi');
    } else {
      roti('Segarnya gagal — nampilin data terakhir dulu');
    }
  }
}

elUlang.addEventListener('click', () => {
  elUlang.classList.add('sembunyi');
  elTeksStatus.textContent = 'Nyambung ke server…';
  segar();
});

if (!MOCK && !INIT_DATA) {
  elLuar.classList.remove('sembunyi');
} else {
  elStatus.classList.remove('sembunyi');
  segar();
  setInterval(segar, 5000);
}
