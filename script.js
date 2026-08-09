let state = {
  currentType: 'satuan',
  gudang: JSON.parse(localStorage.getItem('17an_gudang')) || [],
  items: JSON.parse(localStorage.getItem('17an_items')) || [],
  packages: JSON.parse(localStorage.getItem('17an_packages')) || []
};

// --- INTEGRASI CLOUD FIRESTORE ---
const CLOUD_DOC_ID = 'data_kalkulator_17an';

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
    } catch (error) {
      console.error("Gagal menyimpan ke cloud:", error);
    }
  }
}

async function initAppFromCloud() {
  if (window.db && window.firebaseModules) {
    try {
      const { doc, getDoc } = window.firebaseModules;
      const docSnap = await getDoc(doc(window.db, 'kalkulator', CLOUD_DOC_ID));
      if (docSnap.exists()) {
        const cloudData = docSnap.data();
        state.gudang = cloudData.gudang || state.gudang;
        state.items = cloudData.items || state.items;
        state.packages = cloudData.packages || state.packages;
        localStorage.setItem('17an_gudang', JSON.stringify(state.gudang));
        localStorage.setItem('17an_items', JSON.stringify(state.items));
        localStorage.setItem('17an_packages', JSON.stringify(state.packages));
      }
    } catch (error) {
      console.error("Gagal memuat dari cloud:", error);
    }
  }
  renderGudang();
  renderKeranjang();
  renderPaket();
  if(typeof lucide !== 'undefined') lucide.createIcons();
}

window.initAppFromCloud = initAppFromCloud;

function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-msg');
  const toastIcon = document.getElementById('toast-icon');
  toastMsg.textContent = msg;
  toast.className = `fixed top-4 left-1/2 -translate-x-1/2 z-200 px-4 py-2.5 rounded-xl text-white text-sm font-600 shadow-lg flex items-center gap-2 transition-all duration-300 ${isError ? 'bg-red-600' : 'bg-slate-800'}`;
  toastIcon.setAttribute('data-lucide', isError ? 'alert-circle' : 'check-circle');
  if(typeof lucide !== 'undefined') lucide.createIcons();
  toast.style.opacity = '1';
  setTimeout(() => { toast.style.opacity = '0'; }, 2500);
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`panel-${tabId}`).classList.add('active');
  document.getElementById(`nav-${tabId}`).classList.add('active');
  window.scrollTo(0, 0);
  if(tabId === 2) renderItemSelector();
  if(tabId === 3) renderPaket();
}

function setType(type) {
  state.currentType = type;
  document.getElementById('btn-type-satuan').className = type === 'satuan' ? 'active' : '';
  document.getElementById('btn-type-pak').className = type === 'pak' ? 'active' : '';
  document.getElementById('fields-satuan').classList.toggle('hidden', type !== 'satuan');
  document.getElementById('fields-pak').classList.toggle('hidden', type !== 'pak');
}

function formatRupiah(num) { return 'Rp ' + Number(num).toLocaleString('id-ID'); }

function tambahBarang() {
  const nama = document.getElementById('input-nama').value.trim();
  if(!nama) return showToast('Nama barang wajib diisi!', true);
  let totalStok = 0, hargaPcs = 0;
  if(state.currentType === 'satuan') {
    const harga = parseFloat(document.getElementById('input-harga-pcs').value) || 0;
    const qty = parseInt(document.getElementById('input-qty-pcs').value) || 0;
    if(harga <= 0 || qty <= 0) return showToast('Harga dan jumlah harus valid!', true);
    totalStok = qty; hargaPcs = harga;
  } else {
    const hargaPak = parseFloat(document.getElementById('input-harga-pak').value) || 0;
    const isiPak = parseInt(document.getElementById('input-isi-pak').value) || 0;
    const qtyPak = parseInt(document.getElementById('input-qty-pak').value) || 0;
    if(hargaPak <= 0 || isiPak <= 0 || qtyPak <= 0) return showToast('Data pak harus valid!', true);
    totalStok = isiPak * qtyPak; hargaPcs = hargaPak / isiPak;
  }
  const existing = state.gudang.find(i => i.nama.toLowerCase() === nama.toLowerCase());
  if(existing) { existing.stok += totalStok; } 
  else { state.gudang.push({ id: Date.now(), nama, stok: totalStok, hargaPcs }); }
  saveData(); renderGudang(); showToast('Barang ditambah!');
}

function updateStokGudang(id, val) {
  const item = state.gudang.find(i => i.id === id);
  if(item) { item.stok = Math.max(0, parseInt(val) || 0); saveData(); renderGudang(); }
}

function hapusGudang(id) { state.gudang = state.gudang.filter(i => i.id !== id); saveData(); renderGudang(); }

function pindahKeSiapPakai(id) {
  const itemGudang = state.gudang.find(i => i.id === id);
  if(!itemGudang || itemGudang.stok <= 0) return showToast('Stok habis!', true);
  const existing = state.items.find(i => i.nama.toLowerCase() === itemGudang.nama.toLowerCase());
  if(existing) { existing.stok += itemGudang.stok; } 
  else { state.items.push({...itemGudang}); }
  state.gudang = state.gudang.filter(i => i.id !== id);
  saveData(); renderGudang(); renderKeranjang();
}

function renderGudang() {
  const container = document.getElementById('list-gudang');
  if(!container) return;
  container.innerHTML = state.gudang.length === 0 ? '<div class="text-center p-4">Kosong</div>' : '';
  state.gudang.forEach(item => {
    container.innerHTML += `<div class="p-3 border-b flex justify-between"><div>${item.nama}</div><div>${item.stok} pcs</div><button onclick="hapusGudang(${item.id})">Hapus</button><button onclick="pindahKeSiapPakai(${item.id})">Pakai</button></div>`;
  });
}

function renderKeranjang() {
  const container = document.getElementById('list-keranjang');
  if(!container) return;
  container.innerHTML = state.items.length === 0 ? '<div class="text-center p-4">Kosong</div>' : '';
  state.items.forEach(item => {
    container.innerHTML += `<div class="p-3 border-b">${item.nama} (${item.stok} tersedia)</div>`;
  });
}

// --- FUNGSI PERAKIT PAKET ---
function renderItemSelector() {
  const container = document.getElementById('item-selector-container');
  if(!container) return;
  if(state.items.length === 0) { container.innerHTML = 'Belum ada stok siap pakai.'; return; }
  if(!window.currentPackageItems) window.currentPackageItems = [{ itemId: state.items[0].id, qty: 1 }];
  let html = '';
  window.currentPackageItems.forEach((row, index) => {
    let options = state.items.map(i => `<option value="${i.id}" ${i.id === row.itemId ? 'selected' : ''}>${i.nama}</option>`).join('');
    html += `<div class="flex gap-2 mb-2"><select onchange="updateRowItem(${index}, this.value)">${options}</select><input type="number" value="${row.qty}" onchange="updateRowQty(${index}, this.value)"></div>`;
  });
  container.innerHTML = html;
}

function tambahBarisPaket() { window.currentPackageItems.push({ itemId: state.items[0].id, qty: 1 }); renderItemSelector(); }
function updateRowItem(idx, id) { window.currentPackageItems[idx].itemId = parseInt(id); }
function updateRowQty(idx, qty) { window.currentPackageItems[idx].qty = parseInt(qty); }
function simpanPaket() {
  const nama = document.getElementById('input-nama-paket').value;
  state.packages.push({ id: Date.now(), nama, items: [...window.currentPackageItems] });
  saveData(); renderPaket(); showToast('Paket tersimpan!');
}

function renderPaket() {
  const container = document.getElementById('list-paket');
  if(!container) return;
  container.innerHTML = state.packages.map(p => `<div class="p-2 border-b">${p.nama}</div>`).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  renderGudang(); renderKeranjang(); renderPaket();
  if(typeof lucide !== 'undefined') lucide.createIcons();
});

async function handleLogin() { /* ... */ }
async function handleLogout() { /* ... */ }