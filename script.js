let state = {
  currentType: 'satuan',
  gudang: JSON.parse(localStorage.getItem('17an_gudang')) || [],
  items: JSON.parse(localStorage.getItem('17an_items')) || [],
  packages: JSON.parse(localStorage.getItem('17an_packages')) || []
};

const CLOUD_DOC_ID = 'data_kalkulator_17an';

// --- FUNGSI LOGIN / LOGOUT ---
async function handleLogin() {
  const email = document.getElementById('input-email').value.trim();
  const password = document.getElementById('input-password').value.trim();
  if (!email || !password) return showToast('Email & Password wajib!', true);

  try {
    const { auth, signInWithEmailAndPassword } = window.firebaseAuth;
    await signInWithEmailAndPassword(auth, email, password);
    showToast('Login berhasil!');
  } catch (error) {
    showToast('Login gagal: Periksa kredensial Anda.', true);
  }
}

async function handleLogout() {
  try {
    const { auth, signOut } = window.firebaseAuth;
    await signOut(auth);
    showToast('Berhasil logout');
  } catch (error) {
    showToast('Gagal logout', true);
  }
}

// --- INTEGRASI CLOUD & LOKAL ---
async function saveData() {
  localStorage.setItem('17an_gudang', JSON.stringify(state.gudang));
  localStorage.setItem('17an_items', JSON.stringify(state.items));
  localStorage.setItem('17an_packages', JSON.stringify(state.packages));

  if (window.db && window.firebaseModules) {
    try {
      const { doc, setDoc } = window.firebaseModules;
      await setDoc(doc(window.db, 'kalkulator', CLOUD_DOC_ID), {
        gudang: state.gudang,
        items: state.items,
        packages: state.packages,
        updatedAt: new Date().toISOString()
      });
    } catch (error) { console.error("Gagal simpan ke cloud:", error); }
  }
}

async function initAppFromCloud() {
  if (window.db && window.firebaseModules) {
    try {
      const { doc, getDoc } = window.firebaseModules;
      const docSnap = await getDoc(doc(window.db, 'kalkulator', CLOUD_DOC_ID));
      if (docSnap.exists()) {
        const d = docSnap.data();
        state.gudang = d.gudang || [];
        state.items = d.items || [];
        state.packages = d.packages || [];
        localStorage.setItem('17an_gudang', JSON.stringify(state.gudang));
        localStorage.setItem('17an_items', JSON.stringify(state.items));
        localStorage.setItem('17an_packages', JSON.stringify(state.packages));
      }
    } catch (e) { console.error("Gagal muat cloud:", e); }
  }
  renderGudang(); renderKeranjang(); renderPaket();
  if(typeof lucide !== 'undefined') lucide.createIcons();
}

// --- UI HELPERS ---
function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  toast.className = `fixed top-4 left-1/2 -translate-x-1/2 z-[999] px-4 py-2.5 rounded-xl text-white text-sm font-600 shadow-lg flex items-center gap-2 transition-all duration-300 ${isError ? 'bg-red-600' : 'bg-slate-800'}`;
  toast.style.opacity = '1';
  setTimeout(() => { toast.style.opacity = '0'; }, 2500);
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `panel-${tabId}`));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.id === `nav-${tabId}`));
  window.scrollTo(0,0);
}

function setType(type) {
  state.currentType = type;
  document.getElementById('btn-type-satuan').className = type === 'satuan' ? 'active' : '';
  document.getElementById('btn-type-pak').className = type === 'pak' ? 'active' : '';
  document.getElementById('fields-satuan').classList.toggle('hidden', type !== 'satuan');
  document.getElementById('fields-pak').classList.toggle('hidden', type !== 'pak');
}

// --- FUNGSI GUDANG ---
function tambahBarang() {
  const nama = document.getElementById('input-nama').value.trim();
  if(!nama) return showToast('Nama wajib!', true);
  
  let totalStok = 0, hargaPcs = 0;
  if(state.currentType === 'satuan') {
    totalStok = parseInt(document.getElementById('input-qty-pcs').value) || 0;
    hargaPcs = parseFloat(document.getElementById('input-harga-pcs').value) || 0;
  } else {
    const qty = parseInt(document.getElementById('input-qty-pak').value) || 0;
    const isi = parseInt(document.getElementById('input-isi-pak').value) || 0;
    totalStok = qty * isi;
    hargaPcs = parseFloat(document.getElementById('input-harga-pak').value) / isi || 0;
  }
  
  const existing = state.gudang.find(i => i.nama.toLowerCase() === nama.toLowerCase());
  if(existing) existing.stok += totalStok;
  else state.gudang.push({ id: Date.now(), nama, stok: totalStok, hargaPcs });
  
  saveData(); renderGudang(); showToast('Barang ditambah!');
}

function renderGudang() {
  const container = document.getElementById('list-gudang');
  container.innerHTML = state.gudang.length ? '' : '<div class="p-8 text-center text-slate-400">Kosong</div>';
  state.gudang.forEach(i => {
    container.innerHTML += `<div class="p-3 border-b flex justify-between"><span>${i.nama}</span><span>${i.stok} pcs</span></div>`;
  });
}

// --- INISIALISASI ---
document.addEventListener('DOMContentLoaded', () => {
  window.initAppFromCloud = initAppFromCloud;
  renderGudang();
});