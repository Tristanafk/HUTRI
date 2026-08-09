let state = {
  currentType: 'satuan',
  gudang: JSON.parse(localStorage.getItem('17an_gudang')) || [],
  items: JSON.parse(localStorage.getItem('17an_items')) || [],
  packages: JSON.parse(localStorage.getItem('17an_packages')) || []
};

const CLOUD_DOC_ID = 'data_kalkulator_17an';

// --- FUNGSI LOGIN & LOGOUT ---
async function handleLogin() {
  const email = document.getElementById('input-email').value.trim();
  const password = document.getElementById('input-password').value.trim();
  if (!email || !password) return showToast('Email & Password wajib diisi!', true);

  try {
    const { auth, signInWithEmailAndPassword } = window.firebaseAuth;
    await signInWithEmailAndPassword(auth, email, password);
    showToast('Login berhasil!');
  } catch (error) {
    console.error("Gagal login:", error);
    showToast('Login gagal: Periksa email & password.', true);
  }
}

async function handleLogout() {
  try {
    const { auth, signOut } = window.firebaseAuth;
    await signOut(auth);
    showToast('Berhasil keluar akun.');
  } catch (error) {
    console.error("Gagal logout:", error);
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
    } catch (error) {
      console.error("Gagal simpan ke cloud:", error);
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
      console.error("Gagal muat dari cloud:", error);
    }
  }
  refreshAllUI();
}

window.initAppFromCloud = initAppFromCloud;

// --- UI HELPERS ---
function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-msg');
  const toastIcon = document.getElementById('toast-icon');
  if(!toast || !toastMsg) return;
  
  toastMsg.textContent = msg;
  toast.className = `fixed top-4 left-1/2 -translate-x-1/2 z-[999] px-4 py-2.5 rounded-xl text-white text-sm font-600 shadow-lg flex items-center gap-2 transition-all duration-300 ${isError ? 'bg-red-600' : 'bg-slate-800'}`;
  if(toastIcon) toastIcon.setAttribute('data-lucide', isError ? 'alert-circle' : 'check-circle');
  if (typeof lucide !== 'undefined') lucide.createIcons();
  
  toast.style.opacity = '1';
  setTimeout(() => { toast.style.opacity = '0'; }, 2500);
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const panel = document.getElementById(`panel-${tabId}`);
  const nav = document.getElementById(`nav-${tabId}`);
  if(panel) panel.classList.add('active');
  if(nav) nav.classList.add('active');
  window.scrollTo(0, 0);
  
  if(tabId === 3) renderLaporan();
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function setType(type) {
  state.currentType = type;
  const btnSatuan = document.getElementById('btn-type-satuan');
  const btnPak = document.getElementById('btn-type-pak');
  const fieldsSatuan = document.getElementById('fields-satuan');
  const fieldsPak = document.getElementById('fields-pak');

  if(btnSatuan) btnSatuan.className = type === 'satuan' ? 'active' : 'text-slate-500';
  if(btnPak) btnPak.className = type === 'pak' ? 'active' : 'text-slate-500';
  if(fieldsSatuan) fieldsSatuan.classList.toggle('hidden', type !== 'satuan');
  if(fieldsPak) fieldsPak.classList.toggle('hidden', type !== 'pak');
}

// --- FUNGSI GUDANG & STOK ---
function tambahBarang() {
  const namaInput = document.getElementById('input-nama');
  if(!namaInput) return;
  const nama = namaInput.value.trim();
  if(!nama) return showToast('Nama barang wajib diisi!', true);

  let totalStok = 0, hargaPcs = 0, modalBeli = 0;
  if(state.currentType === 'satuan') {
    const harga = parseFloat(document.getElementById('input-harga-pcs').value) || 0;
    const qty = parseInt(document.getElementById('input-qty-pcs').value) || 0;
    if(harga <= 0 || qty <= 0) return showToast('Harga dan jumlah harus valid!', true);
    totalStok = qty; 
    hargaPcs = harga;
    modalBeli = harga * qty;
    
    document.getElementById('input-harga-pcs').value = '';
    document.getElementById('input-qty-pcs').value = '';
  } else {
    const hargaPak = parseFloat(document.getElementById('input-harga-pak').value) || 0;
    const isiPak = parseInt(document.getElementById('input-isi-pak').value) || 0;
    const qtyPak = parseInt(document.getElementById('input-qty-pak').value) || 0;
    if(hargaPak <= 0 || isiPak <= 0 || qtyPak <= 0) return showToast('Data pak harus valid!', true);
    totalStok = isiPak * qtyPak; 
    hargaPcs = hargaPak / isiPak;
    modalBeli = hargaPak * qtyPak;
    
    document.getElementById('input-harga-pak').value = '';
    document.getElementById('input-isi-pak').value = '';
    document.getElementById('input-qty-pak').value = '';
  }

  const existingGudang = state.gudang.find(i => i.nama.toLowerCase() === nama.toLowerCase());
  if(existingGudang) { 
    existingGudang.stok += totalStok; 
    existingGudang.modal = (existingGudang.modal || 0) + modalBeli;
  } else { 
    state.gudang.push({ id: Date.now(), nama, stok: totalStok, hargaPcs, modal: modalBeli }); 
  }

  const existingItem = state.items.find(i => i.nama.toLowerCase() === nama.toLowerCase());
  if(existingItem) {
    existingItem.stok += totalStok;
    existingItem.hargaPcs = hargaPcs;
  } else {
    state.items.push({ id: Date.now(), nama, stok: totalStok, hargaPcs });
  }

  saveData(); 
  refreshAllUI();
  showToast('Barang berhasil ditambahkan!');
  namaInput.value = '';
}

function hapusGudang(id) {
  const target = state.gudang.find(i => i.id === id);
  if(target) {
    state.gudang = state.gudang.filter(i => i.id !== id);
    state.items = state.items.filter(i => i.nama.toLowerCase() !== target.nama.toLowerCase());
  }
  saveData();
  refreshAllUI();
  showToast('Barang dihapus.');
}

function renderGudang() {
  const container = document.getElementById('list-gudang');
  const badge = document.getElementById('badge-gudang');
  const cardTotal = document.getElementById('card-total-belanja');
  const nominalTotal = document.getElementById('total-belanja-nominal');
  if(!container) return;

  if(state.gudang.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center text-slate-400 text-sm">
        <i data-lucide="shopping-basket" class="w-8 h-8 mx-auto mb-2 opacity-40"></i>
        <div>Belanjaan masih kosong</div>
        <div class="text-xs mt-1">Tambahkan barang di form atas</div>
      </div>`;
    if(badge) badge.classList.add('hidden');
    if(cardTotal) cardTotal.classList.add('hidden');
    return;
  }

  if(badge) {
    badge.textContent = state.gudang.length;
    badge.classList.remove('hidden');
  }

  let html = '';
  let totalBelanja = 0;
  state.gudang.forEach(item => {
    let subtotal = item.modal || (item.stok * item.hargaPcs);
    totalBelanja += subtotal;
    html += `
      <div class="p-3 flex justify-between items-center text-sm">
        <div>
          <div class="font-600 text-slate-800">${item.nama}</div>
          <div class="text-xs text-slate-500">Stok: <b>${item.stok} pcs</b> &bull; Est: Rp ${subtotal.toLocaleString('id-ID')}</div>
        </div>
        <div class="flex items-center gap-1">
          <button onclick="hapusGudang(${item.id})" class="btn-danger p-2"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        </div>
      </div>`;
  });
  container.innerHTML = html;

  if(cardTotal && nominalTotal) {
    cardTotal.classList.remove('hidden');
    nominalTotal.textContent = `Rp ${totalBelanja.toLocaleString('id-ID')}`;
  }
}

function renderKeranjang() {
  const container = document.getElementById('list-keranjang');
  const badge = document.getElementById('badge-keranjang');
  if(!container) return;

  if(state.items.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center text-slate-400 text-sm">
        <i data-lucide="package-check" class="w-8 h-8 mx-auto mb-2 opacity-40"></i>
        <div>Belum ada barang siap pakai</div>
        <div class="text-xs mt-1">Tambahkan inventori barang terlebih dahulu</div>
      </div>`;
    if(badge) badge.classList.add('hidden');
    return;
  }

  if(badge) {
    badge.textContent = state.items.length;
    badge.classList.remove('hidden');
  }

  let html = '';
  state.items.forEach(item => {
    html += `
      <div class="p-3 flex justify-between items-center text-sm">
        <div>
          <div class="font-600 text-slate-800">${item.nama}</div>
          <div class="text-xs text-slate-500">Tersedia: <b class="text-merah-600">${item.stok} pcs</b> &bull; @Rp ${Math.round(item.hargaPcs).toLocaleString('id-ID')}</div>
        </div>
      </div>`;
  });
  container.innerHTML = html;
}

// --- FUNGSI PAKET HADIAH (OTOMATIS KOMBINASI MULTI-BARANG) ---
function simpanPaket() {
  const namaPaketInput = document.getElementById('input-nama-paket');
  const budgetInput = document.getElementById('input-budget');
  const jumlahPaketInput = document.getElementById('input-jumlah-paket');

  if(!namaPaketInput || !budgetInput || !jumlahPaketInput) return;
  const nama = namaPaketInput.value.trim();
  const targetBudget = parseFloat(budgetInput.value) || 0;
  const jumlahKantong = parseInt(jumlahPaketInput.value) || 1;

  if(!nama) return showToast('Nama kategori paket wajib diisi!', true);
  if(targetBudget <= 0) return showToast('Target budget harus valid!', true);
  if(jumlahKantong <= 0) return showToast('Jumlah kantong minimal 1!', true);
  if(state.items.length === 0) return showToast('Belum ada barang di keranjang/stok!', true);

  // Filter barang yang stoknya mencukupi untuk total kantong
  let kandidatBarang = state.items.filter(item => item.stok >= jumlahKantong);

  if(kandidatBarang.length === 0) {
    return showToast('Tidak ada barang dengan stok yang mencukupi untuk jumlah kantong tersebut!', true);
  }

  // Acak atau urutkan kandidat barang agar kombinasi lebih bervariasi (diurutkan dari harga termurah)
  kandidatBarang.sort((a, b) => a.hargaPcs - b.hargaPcs);

  let barangTerpilihList = [];
  let totalModalPerPaket = 0;

  // Algoritma kombinasi multi-barang: looping untuk memasukkan berbagai jenis barang berbeda
  for (let item of kandidatBarang) {
    // Cek apakah sisa budget masih cukup untuk memasukkan minimal 1 pcs barang ini per kantong
    if (totalModalPerPaket + item.hargaPcs <= targetBudget) {
      let qtyPerKantong = 1;

      // Jika masih jauh dari budget, coba tambahkan lagi kuantitas barang yang sama (maksimal 3 pcs per jenis)
      while (
        totalModalPerPaket + (item.hargaPcs * (qtyPerKantong + 1)) <= targetBudget &&
        item.stok >= (qtyPerKantong + 1) * jumlahKantong &&
        qtyPerKantong < 3
      ) {
        qtyPerKantong++;
      }

      barangTerpilihList.push({ id: item.id, qty: qtyPerKantong });
      totalModalPerPaket += (item.hargaPcs * qtyPerKantong);
    }

    // Jika total modal sudah mencapai minimal 85% dari target budget, hentikan pencarian agar pas
    if (totalModalPerPaket >= targetBudget * 0.85) {
      break;
    }
  }

  // Jika ternyata budget terlalu kecil untuk barang apa pun, ambil 1 barang termurah sebagai fallback
  if (barangTerpilihList.length === 0) {
    barangTerpilihList.push({ id: kandidatBarang[0].id, qty: 1 });
  }

  // Validasi stok akhir
  let errorStok = false;
  barangTerpilihList.forEach(pi => {
    let itemRef = state.items.find(i => i.id === pi.id);
    let totalDibutuhkan = pi.qty * jumlahKantong;
    if (!itemRef || itemRef.stok < totalDibutuhkan) {
      errorStok = true;
    }
  });

  if (errorStok) {
    return showToast('Stok barang tidak mencukupi untuk kombinasi paket ini!', true);
  }

  // Eksekusi pemotongan stok di keranjang & gudang
  barangTerpilihList.forEach(pi => {
    let totalDibutuhkan = pi.qty * jumlahKantong;
    let itemKeranjang = state.items.find(i => i.id === pi.id);
    if(itemKeranjang) itemKeranjang.stok -= totalDibutuhkan;

    let itemGudang = state.gudang.find(g => g.nama.toLowerCase() === itemKeranjang.nama.toLowerCase());
    if(itemGudang) itemGudang.stok -= totalDibutuhkan;
  });

  // Simpan paket baru
  const newPackage = {
    id: Date.now(),
    nama: nama,
    budget: targetBudget,
    jumlahKantong: jumlahKantong,
    items: barangTerpilihList
  };

  state.packages.push(newPackage);

  // Reset form
  namaPaketInput.value = '';
  budgetInput.value = '';
  jumlahPaketInput.value = '1';

  saveData();
  refreshAllUI();
  showToast('Paket kombinasi berhasil dibuat otomatis!');
  switchTab(2);
}

function hapusPaket(id) {
  const index = state.packages.findIndex(p => p.id === id);
  if(index !== -1) {
    const pkg = state.packages[index];
    pkg.items.forEach(pi => {
      const itemRef = state.items.find(i => i.id === pi.id);
      if(itemRef) {
        itemRef.stok += (pi.qty * pkg.jumlahKantong);
        const itemGudang = state.gudang.find(g => g.nama.toLowerCase() === itemRef.nama.toLowerCase());
        if(itemGudang) itemGudang.stok += (pi.qty * pkg.jumlahKantong);
      }
    });

    state.packages.splice(index, 1);
    saveData();
    refreshAllUI();
    showToast('Paket dihapus dan stok dikembalikan.');
  }
}

function renderPaket() {
  const container = document.getElementById('list-paket');
  const badge = document.getElementById('badge-paket');
  if(!container) return;

  if(state.packages.length === 0) {
    container.innerHTML = `
      <div class="card p-8 text-center text-slate-400 text-sm">
        <i data-lucide="gift" class="w-8 h-8 mx-auto mb-2 opacity-40"></i>
        <div>Belum ada paket</div>
        <div class="text-xs mt-1">Buat paket otomatis di form atas</div>
      </div>`;
    if(badge) badge.classList.add('hidden');
    return;
  }

  if(badge) {
    badge.textContent = state.packages.length;
    badge.classList.remove('hidden');
  }

  let html = '';
  state.packages.forEach(pkg => {
    let rincianItems = '';
    let totalModalPerPaket = 0;

    pkg.items.forEach(pi => {
      const itemInfo = state.items.find(i => i.id === pi.id) || state.gudang.find(g => g.id === pi.id);
      const namaBarang = itemInfo ? itemInfo.nama : 'Barang';
      const hargaPcs = itemInfo ? (itemInfo.hargaPcs || (itemInfo.modal / itemInfo.stok) || 0) : 0;
      totalModalPerPaket += (hargaPcs * pi.qty);
      rincianItems += `<li class="text-xs text-slate-600">&bull; ${pi.qty}x ${namaBarang}</li>`;
    });

    html += `
      <div class="card p-4 space-y-2">
        <div class="flex justify-between items-start">
          <div>
            <div class="font-700 text-slate-800 text-sm">${pkg.nama}</div>
            <div class="text-xs text-slate-500">Jumlah: <b>${pkg.jumlahKantong} Kantong</b> &bull; Target Budget: Rp ${pkg.budget.toLocaleString('id-ID')}</div>
          </div>
          <button onclick="hapusPaket(${pkg.id})" class="btn-danger p-2"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        </div>
        <div class="bg-slate-50 p-2.5 rounded-xl space-y-1">
          <div class="text-xs font-600 text-slate-700">Isi per Kantong:</div>
          <ul class="pl-2 space-y-0.5">${rincianItems}</ul>
        </div>
        <div class="text-xs text-right text-slate-500 font-500">
          Modal per Kantong: <span class="text-merah-600 font-700">Rp ${Math.round(totalModalPerPaket).toLocaleString('id-ID')}</span>
        </div>
      </div>`;
  });

    container.innerHTML = html;
}

// --- FUNGSI LAPORAN & EKSPOR PDF ---
function renderLaporan() {
  const sumItems = document.getElementById('sum-items');
  const sumPaket = document.getElementById('sum-paket');
  const sumTotalPaket = document.getElementById('sum-total-paket');
  const previewBelanja = document.getElementById('preview-belanja');
  const previewBungkus = document.getElementById('preview-bungkus');

  let totalKantongSemua = state.packages.reduce((acc, p) => acc + p.jumlahKantong, 0);

  if(sumItems) sumItems.textContent = state.items.length;
  if(sumPaket) sumPaket.textContent = state.packages.length;
  if(sumTotalPaket) sumTotalPaket.textContent = totalKantongSemua;

  if(previewBelanja) {
    if(state.gudang.length === 0) {
      previewBelanja.innerHTML = `<div class="text-slate-400 italic">Belum ada data belanja...</div>`;
    } else {
      let html = '<ul class="list-disc pl-4 space-y-1">';
      state.gudang.forEach(i => {
        html += `<li><b>${i.nama}</b>: ${i.stok} pcs (Est. Rp ${(i.modal || (i.stok * i.hargaPcs)).toLocaleString('id-ID')})</li>`;
      });
      html += '</ul>';
      previewBelanja.innerHTML = html;
    }
  }

  if(previewBungkus) {
    if(state.packages.length === 0) {
      previewBungkus.innerHTML = `<div class="text-slate-400 italic">Simpan paket untuk melihat panduan...</div>`;
    } else {
      let html = '<ul class="list-disc pl-4 space-y-1">';
      state.packages.forEach(p => {
        let rincianStr = p.items.map(pi => {
          const itemRef = state.items.find(i => i.id === pi.id) || state.gudang.find(g => g.id === pi.id);
          return `${pi.qty} ${itemRef ? itemRef.nama : 'Barang'}`;
        }).join(', ');
        html += `<li><b>${p.nama}</b> (${p.jumlahKantong} kantong) &rarr; ${rincianStr}</li>`;
      });
      html += '</ul>';
      previewBungkus.innerHTML = html;
    }
  }
}

function cetakBelanjaGlobal() {
  if(state.gudang.length === 0) return showToast('Belum ada data belanja untuk dicetak!', true);
  
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(16);
  doc.text("REKAP DAFTAR BELANJA GUDANG 17-AN", 14, 20);
  
  doc.setFontSize(10);
  doc.setFont("Helvetica", "normal");
  doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 14, 27);

  let tableData = [];
  let totalSemuaBelanja = 0;
  state.gudang.forEach((item, index) => {
    let subtotal = item.modal || (item.stok * item.hargaPcs);
    totalSemuaBelanja += subtotal;
    tableData.push([
      index + 1,
      item.nama,
      `${item.stok} pcs`,
      `Rp ${Math.round(item.hargaPcs).toLocaleString('id-ID')}`,
      `Rp ${Math.round(subtotal).toLocaleString('id-ID')}`
    ]);
  });

  doc.autoTable({
    startY: 35,
    head: [['No', 'Nama Barang', 'Jumlah', 'Estimasi Harga/Pcs', 'Subtotal']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [220, 38, 38] }
  });

  let finalY = doc.lastAutoTable.finalY + 10;
  doc.setFont("Helvetica", "bold");
  doc.text(`Total Estimasi Keseluruhan: Rp ${Math.round(totalSemuaBelanja).toLocaleString('id-ID')}`, 14, finalY);

  doc.save('Daftar_Belanja_17an.pdf');
  showToast('PDF Daftar Belanja berhasil diunduh!');
}

function cetakPanduanBungkus() {
  if(state.packages.length === 0) return showToast('Belum ada data paket untuk dicetak!', true);

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(16);
  doc.text("PANDUAN TIM BUNGKUS HADIAH 17-AN", 14, 20);
  
  doc.setFontSize(10);
  doc.setFont("Helvetica", "normal");
  doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 14, 27);

  let tableData = [];
  state.packages.forEach((p, index) => {
    let rincianStr = p.items.map(pi => {
      const itemRef = state.items.find(i => i.id === pi.id) || state.gudang.find(g => g.id === pi.id);
      return `- ${pi.qty}x ${itemRef ? itemRef.nama : 'Barang'}`;
    }).join('\n');
    tableData.push([
      index + 1,
      p.nama,
      `${p.jumlahKantong} Kantong`,
      rincianStr,
      `Rp ${p.budget.toLocaleString('id-ID')}`
    ]);
  });

  doc.autoTable({
    startY: 35,
    head: [['No', 'Kategori Paket', 'Jumlah Kantong', 'Komposisi Isi per Kantong', 'Target Budget']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [220, 38, 38] }
  });

  doc.save('Panduan_Bungkus_Hadiah_17an.pdf');
  showToast('PDF Panduan Bungkus berhasil diunduh!');
}

function resetData() {
  if(confirm('Yakin ingin mereset seluruh data aplikasi? Tindakan ini tidak dapat dibatalkan.')) {
    localStorage.clear();
    state.gudang = [];
    state.items = [];
    state.packages = [];
    saveData();
    refreshAllUI();
    showToast('Semua data berhasil direset.');
  }
}

function refreshAllUI() {
  renderGudang();
  renderKeranjang();
  renderPaket();
  renderLaporan();
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

document.addEventListener('DOMContentLoaded', () => {
  refreshAllUI();
});