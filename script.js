let state = {
  currentType: 'satuan',
  gudang: JSON.parse(localStorage.getItem('17an_gudang')) || [],
  items: JSON.parse(localStorage.getItem('17an_items')) || [], // Keranjang Siap Pakai
  packages: JSON.parse(localStorage.getItem('17an_packages')) || []
};

// --- INTEGRASI CLOUD FIRESTORE ---
const CLOUD_DOC_ID = 'data_kalkulator_17an';

async function saveData() {
  // Simpan lokal dulu sebagai cadangan instan
  localStorage.setItem('17an_gudang', JSON.stringify(state.gudang));
  localStorage.setItem('17an_items', JSON.stringify(state.items));
  localStorage.setItem('17an_packages', JSON.stringify(state.packages));

  // Simpan ke Cloud Firestore jika sudah siap
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
        
        // Perbarui localStorage dengan data terbaru dari cloud
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
  if(typeof lucide !== 'undefined') lucide.createIcons();
}

// Daftarkan fungsi ke window agar bisa dipanggil script inisialisasi di index.html
window.initAppFromCloud = initAppFromCloud;

function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-msg');
  const toastIcon = document.getElementById('toast-icon');
  
  toastMsg.textContent = msg;
  toast.className = `fixed top-4 left-1/2 -translate-x-1/2 z-200 px-4 py-2.5 rounded-xl text-white text-sm font-600 shadow-lg flex items-center gap-2 transition-all duration-300 ${isError ? 'bg-red-600' : 'bg-slate-800'}`;
  toastIcon.setAttribute('data-lucide', isError ? 'alert-circle' : 'check-circle');
  lucide.createIcons();
  
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
  if(tabId === 3) updateLaporan();
}

function setType(type) {
  state.currentType = type;
  document.getElementById('btn-type-satuan').className = type === 'satuan' ? 'active' : '';
  document.getElementById('btn-type-pak').className = type === 'pak' ? 'active' : '';
  
  if(type === 'satuan') {
    document.getElementById('fields-satuan').classList.remove('hidden');
    document.getElementById('fields-pak').classList.add('hidden');
  } else {
    document.getElementById('fields-satuan').classList.add('hidden');
    document.getElementById('fields-pak').classList.remove('hidden');
  }
}

function formatRupiah(num) {
  return 'Rp ' + Number(num).toLocaleString('id-ID');
}

function tambahBarang() {
  const nama = document.getElementById('input-nama').value.trim();
  if(!nama) return showToast('Nama barang wajib diisi!', true);

  let totalStok = 0;
  let hargaPcs = 0;
  let detailInfo = '';

  if(state.currentType === 'satuan') {
    const harga = parseFloat(document.getElementById('input-harga-pcs').value) || 0;
    const qty = parseInt(document.getElementById('input-qty-pcs').value) || 0;
    if(harga <= 0 || qty <= 0) return showToast('Harga dan jumlah harus valid!', true);

    totalStok = qty;
    hargaPcs = harga;
    detailInfo = 'Satuan (Pcs)';
  } else {
    const hargaPak = parseFloat(document.getElementById('input-harga-pak').value) || 0;
    const isiPak = parseInt(document.getElementById('input-isi-pak').value) || 0;
    const qtyPak = parseInt(document.getElementById('input-qty-pak').value) || 0;
    if(hargaPak <= 0 || isiPak <= 0 || qtyPak <= 0) return showToast('Data pak/dus harus valid!', true);

    totalStok = isiPak * qtyPak;
    hargaPcs = hargaPak / isiPak;
    detailInfo = `${qtyPak} Pak (@${isiPak} pcs)`;
  }

  // Cek duplikat nama barang di gudang
  const existing = state.gudang.find(i => i.nama.toLowerCase() === nama.toLowerCase());
  if(existing) {
    existing.stok += totalStok;
  } else {
    state.gudang.push({
      id: Date.now(),
      nama: nama,
      stok: totalStok,
      hargaPcs: hargaPcs,
      detail: detailInfo
    });
  }

  saveData();
  renderGudang();
  showToast('Barang berhasil ditambahkan ke daftar belanja!');

  // Reset form
  document.getElementById('input-nama').value = '';
  document.getElementById('input-harga-pcs').value = '';
  document.getElementById('input-qty-pcs').value = '';
  document.getElementById('input-harga-pak').value = '';
  document.getElementById('input-isi-pak').value = '';
  document.getElementById('input-qty-pak').value = '';
}

function updateStokGudang(id, newStok) {
  const val = parseInt(newStok);
  const item = state.gudang.find(i => i.id === id);
  if(item) {
    item.stok = (isNaN(val) || val < 0) ? 0 : val;
    saveData();
    renderGudang();
  }
}

function hapusGudang(id) {
  state.gudang = state.gudang.filter(i => i.id !== id);
  saveData();
  renderGudang();
  showToast('Barang dihapus dari daftar belanja.');
}

// Pindahkan dari Daftar Belanja ke Stok Siap Pakai untuk Paket
function pindahKeSiapPakai(id) {
  const itemGudang = state.gudang.find(i => i.id === id);
  if(!itemGudang || itemGudang.stok <= 0) return showToast('Stok tidak mencukupi!', true);

  // Cek apakah sudah ada di stok siap pakai
  const existingSiap = state.items.find(i => i.nama.toLowerCase() === itemGudang.nama.toLowerCase());
  if(existingSiap) {
    existingSiap.stok += itemGudang.stok;
  } else {
    state.items.push({
      id: Date.now(),
      nama: itemGudang.nama,
      stok: itemGudang.stok,
      hargaPcs: itemGudang.hargaPcs,
      detail: itemGudang.detail
    });
  }

  // Kurangi/hapus dari gudang setelah dipindah
  state.gudang = state.gudang.filter(i => i.id !== id);

  saveData();
  renderGudang();
  renderKeranjang();
  showToast('Barang dipindahkan ke Stok Siap Pakai!');
}

function updateStokItem(id, newStok) {
  const val = parseInt(newStok);
  const item = state.items.find(i => i.id === id);
  if(item) {
    item.stok = (isNaN(val) || val < 0) ? 0 : val;
    saveData();
    renderKeranjang();
  }
}

function hapusItem(id) {
  state.items = state.items.filter(i => i.id !== id);
  saveData();
  renderKeranjang();
  showToast('Barang dihapus dari stok siap pakai.');
}

function renderGudang() {
  const container = document.getElementById('list-gudang');
  const badge = document.getElementById('badge-gudang');
  const cardTotal = document.getElementById('card-total-belanja');
  const totalNominal = document.getElementById('total-belanja-nominal');

  if(!container) return;

  if(state.gudang.length === 0) {
    container.innerHTML = `<div class="p-8 text-center text-slate-400 text-sm"><i data-lucide="shopping-basket" class="w-8 h-8 mx-auto mb-2 opacity-40"></i><div>Belanjaan masih kosong</div><div class="text-xs mt-1">Tambahkan barang di form atas</div></div>`;
    if(badge) badge.classList.add('hidden');
    if(cardTotal) cardTotal.classList.add('hidden');
    lucide.createIcons();
    return;
  }

  if(badge) {
    badge.textContent = state.gudang.length;
    badge.classList.remove('hidden');
  }
  if(cardTotal) cardTotal.classList.remove('hidden');

  let html = '';
  let totalBelanja = 0;

  state.gudang.forEach(item => {
    const subtotal = item.stok * item.hargaPcs;
    totalBelanja += subtotal;

    html += `
      <div class="p-3.5 flex items-center justify-between gap-3 item-row">
        <div class="flex-1 min-w-0">
          <div class="font-700 text-slate-800 text-sm truncate">${item.nama}</div>
          <div class="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
            <span>${formatRupiah(item.hargaPcs)}/pcs</span>
            <span>•</span>
            <span class="text-merah-600 font-600">Subtotal: ${formatRupiah(subtotal)}</span>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <div class="text-right">
            <label class="block text-[10px] text-slate-400 font-600">JML</label>
            <input type="number" min="0" value="${item.stok}" onchange="updateStokGudang(${item.id}, this.value)" class="w-16 border border-slate-200 rounded-lg px-2 py-1 text-xs text-center font-700 bg-slate-50" />
          </div>
          <button onclick="pindahKeSiapPakai(${item.id})" class="btn-success p-2 mt-3" title="Gunakan untuk Paket"><i data-lucide="arrow-down-circle" class="w-4 h-4"></i></button>
          <button onclick="hapusGudang(${item.id})" class="btn-danger p-2 mt-3"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  if(totalNominal) totalNominal.textContent = formatRupiah(totalBelanja);
  lucide.createIcons();
}

function renderKeranjang() {
  const container = document.getElementById('list-keranjang');
  const badge = document.getElementById('badge-keranjang');

  if(!container) return;

  if(state.items.length === 0) {
    container.innerHTML = `<div class="p-8 text-center text-slate-400 text-sm"><i data-lucide="package-check" class="w-8 h-8 mx-auto mb-2 opacity-40"></i><div>Belum ada barang siap pakai</div><div class="text-xs mt-1">Pindahkan barang dari daftar belanja di atas</div></div>`;
    if(badge) badge.classList.add('hidden');
    lucide.createIcons();
    return;
  }

  if(badge) {
    badge.textContent = state.items.length;
    badge.classList.remove('hidden');
  }

  let html = '';
  state.items.forEach(item => {
    html += `
      <div class="p-3.5 flex items-center justify-between gap-3 item-row">
        <div class="flex-1 min-w-0">
          <div class="font-700 text-slate-800 text-sm truncate">${item.nama}</div>
          <div class="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
            <span>${formatRupiah(item.hargaPcs)}/pcs</span>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <div class="text-right">
            <label class="block text-[10px] text-slate-400 font-600">STOK PAKAI</label>
            <input type="number" min="0" value="${item.stok}" onchange="updateStokItem(${item.id}, this.value)" class="w-16 border border-slate-200 rounded-lg px-2 py-1 text-xs text-center font-700 bg-slate-50" />
          </div>
          <button onclick="hapusItem(${item.id})" class="btn-danger p-2 mt-3"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  lucide.createIcons();
}

// Inisialisasi awal saat halaman dimuat (jika belum dipanggil cloud)
document.addEventListener('DOMContentLoaded', () => {
  // Jika window.db belum ada (misal offline total), render langsung dari localStorage
  if (!window.db) {
    renderGudang();
    renderKeranjang();
  }
  if(typeof lucide !== 'undefined') lucide.createIcons();
});

async function handleLogin() {
  const email = document.getElementById('input-email').value.trim();
  const password = document.getElementById('input-password').value.trim();

  if (!email || !password) {
    return showToast('Email dan password wajib diisi!', true);
  }

  if (window.firebaseAuth) {
    try {
      const { auth, signInWithEmailAndPassword } = window.firebaseAuth;
      await signInWithEmailAndPassword(auth, email, password);
      showToast('Login berhasil!');
    } catch (error) {
      console.error("Gagal login:", error);
      showToast('Login gagal: Periksa kembali email & password Anda.', true);
    }
  }
}

async function handleLogout() {
  if (window.firebaseAuth) {
    try {
      const { auth, signOut } = window.firebaseAuth;
      await signOut(auth);
      showToast('Berhasil keluar akun.');
    } catch (error) {
      console.error("Gagal logout:", error);
    }
  }
}