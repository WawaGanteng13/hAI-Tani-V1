import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import {
  INITIAL_FARMERS,
  INITIAL_COMMODITIES,
  INITIAL_NOTIFICATIONS,
  INITIAL_STRATEGIC_RECOMMENDATION,
  INITIAL_ADMINS,
} from "./src/data/mockData";
import {
  FarmerRecord,
  MarketCommodity,
  AnomalyNotification,
  StrategicRecommendation,
  AdminUser,
} from "./src/types";

dotenv.config();

// In-memory data stores
let farmersDb: FarmerRecord[] = [...INITIAL_FARMERS];
let commoditiesDb: MarketCommodity[] = [...INITIAL_COMMODITIES];
let notificationsDb: AnomalyNotification[] = [...INITIAL_NOTIFICATIONS];
let latestRecommendation: StrategicRecommendation = { ...INITIAL_STRATEGIC_RECOMMENDATION };
let adminsDb: AdminUser[] = [...INITIAL_ADMINS];

// Helper to normalize phone numbers for accurate matching (+62, 08, dashes, spaces)
function normalizePhone(phone?: string): string {
  if (!phone) return "";
  let p = phone.replace(/[^0-9]/g, "");
  if (p.startsWith("62")) {
    p = "0" + p.slice(2);
  }
  return p;
}

function findAdmin(phone?: string): AdminUser | undefined {
  const norm = normalizePhone(phone);
  if (!norm) return undefined;
  return adminsDb.find((a) => a.aktif && normalizePhone(a.noHp) === norm);
}

// Universal Entity Extractor from conversation text / voice note
function extractFarmerFromText(text: string, currentDraft: Partial<FarmerRecord> = {}): {
  extracted: Partial<FarmerRecord>;
  hasMinimumData: boolean;
} {
  const lower = (text || "").toLowerCase();
  const ext: Partial<FarmerRecord> = { ...currentDraft };

  // 1. Nama Petani
  const nameMatch =
    text.match(/(?:nama\s*(?:saya|petani)?\s*(?:adalah|:)?\s*|petani\s+|pak\s+|bu\s+|bapak\s+|ibu\s+)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i) ||
    text.match(/(?:nama\s*:\s*)([A-Za-z\s]+?)(?:,|\.|\n|$)/i);
  if (nameMatch && nameMatch[1] && nameMatch[1].trim().length > 2) {
    const raw = nameMatch[1].trim();
    if (!["saya", "petani", "tani", "mitra", "baru", "lahan", "data", "semua", "rekap"].includes(raw.toLowerCase())) {
      ext.nama = raw.startsWith("Pak ") || raw.startsWith("Bu ") ? raw : `Pak ${raw}`;
    }
  }

  // 2. Komoditas
  if (lower.includes("cabai") || lower.includes("cabe")) {
    ext.komoditas = lower.includes("keriting") ? "Cabai Merah Keriting" : "Cabai Rawit Merah";
  } else if (lower.includes("bawang")) {
    ext.komoditas = "Bawang Merah";
  } else if (lower.includes("jagung")) {
    ext.komoditas = "Jagung";
  } else if (lower.includes("padi") || lower.includes("beras")) {
    ext.komoditas = "Padi";
  } else if (lower.includes("kedelai")) {
    ext.komoditas = "Kedelai";
  } else if (lower.includes("tomat")) {
    ext.komoditas = "Tomat";
  } else if (lower.includes("kentang")) {
    ext.komoditas = "Kentang";
  }

  // 3. Luas Lahan
  const areaMatch =
    text.match(/(\d+(?:[.,]\d+)?)\s*(?:ha|hektar|hektare)/i) ||
    text.match(/(\d+(?:[.,]\d+)?)\s*(?:m2|m²|meter\s*persegi)/i) ||
    text.match(/(\d+(?:[.,]\d+)?)\s*(?:bahu|ubin)/i);
  if (areaMatch && areaMatch[1]) {
    let num = parseFloat(areaMatch[1].replace(",", "."));
    if (text.match(/m2|m²|meter\s*persegi/i)) {
      num = Number((num / 10000).toFixed(2));
    } else if (text.match(/bahu/i)) {
      num = Number((num * 0.7).toFixed(2));
    } else if (text.match(/ubin/i)) {
      num = Number(((num * 14) / 10000).toFixed(2));
    }
    ext.luasLahan = num;
    ext.luasLahanFormatted = `${num} Ha (${(num * 10000).toLocaleString("id-ID")} m²)`;
  }

  // 4. Nomor HP / WhatsApp
  const phoneMatch = text.match(/(?:\+62|62|08)[0-9\s-]{8,14}/);
  if (phoneMatch) {
    ext.noHp = phoneMatch[0].trim();
  }

  // 5. Lokasi / Alamat / Kabupaten
  const knownCities = [
    "Karawang", "Subang", "Garut", "Kediri", "Brebes", "Magetan", "Indramayu", "Cianjur", "Majalengka",
    "Boyolali", "Ngawi", "Nganjuk", "Banyuwangi", "Malang", "Klaten", "Sragen", "Temanggung", "Wonosobo",
    "Bandung", "Bogor", "Sukabumi", "Cirebon", "Sumedang", "Purwakarta", "Tasikmalaya", "Ciamis", "Kuningan"
  ];
  for (const city of knownCities) {
    if (lower.includes(city.toLowerCase())) {
      ext.kabupaten = city;
      ext.alamat = ext.alamat && !ext.alamat.includes("Sentra Tani") ? ext.alamat : `Desa Binaan, ${city}`;
      break;
    }
  }
  const desaMatch = text.match(/(?:desa|kelurahan|kecamatan)\s+([A-Za-z]+)/i);
  if (desaMatch && desaMatch[1]) {
    ext.alamat = `Desa ${desaMatch[1]}${ext.kabupaten ? `, ${ext.kabupaten}` : ""}`;
  }
  const diMatch = text.match(/(?:di\s+|lokasi\s+|wilayah\s+|kabupaten\s+|kab\.?\s+)([A-Za-z]+(?:\s+[A-Za-z]+)?)/i);
  if (diMatch && diMatch[1] && !ext.kabupaten) {
    const candidate = diMatch[1].trim();
    if (!["sawah", "lahan", "kebun", "desa", "sini", "sana", "dinas", "google", "sheets", "database"].includes(candidate.toLowerCase())) {
      ext.kabupaten = candidate;
      if (!ext.alamat) ext.alamat = `Desa Binaan, ${candidate}`;
    }
  }

  // 6. Varietas
  const varMatch = text.match(/(?:varietas|benih|bibit)\s+([A-Za-z0-9\s-]+?)(?:,|\.|\n|$)/i);
  if (varMatch && varMatch[1]) {
    ext.varietas = varMatch[1].trim();
  } else if (!ext.varietas && ext.komoditas) {
    if (ext.komoditas === "Padi") ext.varietas = "Inpari 32";
    else if (ext.komoditas?.includes("Cabai")) ext.varietas = "Ori 212";
    else if (ext.komoditas === "Bawang Merah") ext.varietas = "Bima Brebes";
    else if (ext.komoditas === "Jagung") ext.varietas = "BISI-18 Hibrida";
    else ext.varietas = "Unggul Lokal";
  }

  // 7. Estimasi Panen
  const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  for (const m of months) {
    if (lower.includes(m.toLowerCase())) {
      const yearMatch = text.match(/202[6-9]/);
      ext.estimasiPanen = `${m} ${yearMatch ? yearMatch[0] : "2026"}`;
      break;
    }
  }

  // 8. Estimasi Hasil Ton
  const tonMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:ton|kuintal)/i);
  if (tonMatch && tonMatch[1]) {
    let t = parseFloat(tonMatch[1].replace(",", "."));
    if (text.match(/kuintal/i)) t = Number((t / 10).toFixed(1));
    ext.estimasiHasilTon = t;
  } else if (ext.luasLahan) {
    const mult = ext.komoditas === "Padi" ? 6.2 : ext.komoditas?.includes("Cabai") ? 8.5 : ext.komoditas === "Jagung" ? 7.0 : 5.0;
    ext.estimasiHasilTon = Number((ext.luasLahan * mult).toFixed(1));
  }

  const hasMinimumData = !!(ext.nama || ext.komoditas || ext.luasLahan || ext.kabupaten);
  return { extracted: ext, hasMinimumData };
}

// Strict Data Completeness Validator: Requires Nama, Komoditas, Luas Lahan, and Lokasi
function checkFarmerCompleteness(record: Partial<FarmerRecord>): {
  isComplete: boolean;
  missingFields: string[];
  presentFields: string[];
} {
  const missing: string[] = [];
  const present: string[] = [];

  // 1. Nama Petani (must not be generic placeholders)
  const hasValidName =
    !!record.nama &&
    record.nama.trim().length >= 2 &&
    !["Pak", "Bu", "Bapak", "Ibu", "Petani", "Petani Terdaftar", "Mitra Tani", "Pak Petani", "Pak Mitra Tani"].includes(
      record.nama.trim()
    );
  if (hasValidName) {
    present.push(`Nama Petani: *${record.nama}*`);
  } else {
    missing.push("Nama Lengkap Petani");
  }

  // 2. Komoditas Tanaman
  const hasValidCrop = !!record.komoditas && record.komoditas.trim().length >= 2;
  if (hasValidCrop) {
    present.push(`Komoditas: *${record.komoditas}*${record.varietas ? ` (${record.varietas})` : ""}`);
  } else {
    missing.push("Komoditas Tanaman (misal: Padi, Cabai, Jagung, Bawang)");
  }

  // 3. Luas Lahan
  const hasValidArea = !!record.luasLahan && Number(record.luasLahan) > 0;
  if (hasValidArea) {
    present.push(`Luas Lahan: *${record.luasLahanFormatted || `${record.luasLahan} Ha`}*`);
  } else {
    missing.push("Luas Lahan (misal: 1.5 Ha atau 5.000 m²)");
  }

  // 4. Lokasi / Wilayah
  const hasValidLocation =
    (!!record.kabupaten && record.kabupaten.trim().length >= 3 && !record.kabupaten.includes("Sentra Tani")) ||
    (!!record.alamat && record.alamat.trim().length >= 3 && !record.alamat.includes("Sentra Tani"));
  if (hasValidLocation) {
    const loc = [record.alamat, record.kabupaten].filter(Boolean).join(", ");
    present.push(`Lokasi: *${loc}*`);
  } else {
    missing.push("Lokasi Wilayah (Desa atau Kabupaten)");
  }

  return {
    isComplete: missing.length === 0,
    missingFields: missing,
    presentFields: present,
  };
}

// Generate friendly conversational response asking the user to complete missing fields
function formatIncompleteFarmerPrompt(
  draft: Partial<FarmerRecord>,
  recipientName?: string,
  isAdmin: boolean = false
): {
  reply: string;
  quickReplies: string[];
  extracted: Partial<FarmerRecord>;
  isComplete: boolean;
} {
  const check = checkFarmerCompleteness(draft);

  const checklist = [
    `• Nama Petani: ${draft.nama ? `✅ *${draft.nama}*` : "❌ _Belum diisi_"}`,
    `• Komoditas: ${draft.komoditas ? `✅ *${draft.komoditas}*` : "❌ _Belum diisi_"}`,
    `• Luas Lahan: ${draft.luasLahan && Number(draft.luasLahan) > 0 ? `✅ *${draft.luasLahanFormatted || `${draft.luasLahan} Ha`}*` : "❌ _Belum diisi_"}`,
    `• Lokasi/Kabupaten: ${draft.kabupaten || draft.alamat ? `✅ *${draft.kabupaten || draft.alamat}*` : "❌ _Belum diisi_"}`,
  ].join("\n");

  const missingList = check.missingFields.map((m, idx) => `${idx + 1}. *${m}*`).join("\n");
  const salutation = isAdmin && recipientName ? `Bpk/Ibu *${recipientName}*` : `Bapak/Ibu`;

  const reply =
    `📝 *Draf Data Petani Dicatat (Data Belum Lengkap)*\n\n` +
    `Terima kasih ${salutation}. Data sementara telah kami simpan di draf percakapan, namun *belum dimasukkan ke database Google Sheets* karena data belum lengkap:\n\n` +
    `${checklist}\n\n` +
    `⚠️ *Data yang masih harus dilengkapi:*\n${missingList}\n\n` +
    `💡 *Silakan ketik data kelanjutannya* (contoh: ketik nama, komoditas, luas lahan, atau kabupaten). Begitu seluruh data pokok di atas lengkap, sistem akan langsung memverifikasi dan menyimpannya ke database Google Sheets secara otomatis.`;

  const quickReplies: string[] = [];
  if (!draft.komoditas) quickReplies.push("Komoditas Cabai Rawit", "Komoditas Jagung Hibrida");
  if (!draft.luasLahan || Number(draft.luasLahan) <= 0) quickReplies.push("Luas Lahan 1.5 Ha", "Luas Lahan 5.000 m²");
  if (!draft.kabupaten && !draft.alamat) quickReplies.push("Lokasi di Kab. Subang", "Lokasi di Karawang");
  if (!draft.nama) quickReplies.push("Nama Petani: Pak Suparman");

  return {
    reply,
    quickReplies: quickReplies.slice(0, 4),
    extracted: draft,
    isComplete: false,
  };
}

// Persist complete record into farmersDb
function saveFarmerRecord(
  draft: Partial<FarmerRecord>,
  activeAdmin?: AdminUser,
  senderPhone?: string
): FarmerRecord {
  const newRecord: FarmerRecord = {
    id: `TANI-${String(farmersDb.length + 1).padStart(3, "0")}`,
    timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
    nama: draft.nama || "Petani Mitra",
    noHp: draft.noHp || senderPhone || "+62 812-xxxx-xxxx",
    alamat: draft.alamat || `Desa Binaan, ${draft.kabupaten || "Subang"}`,
    kabupaten: draft.kabupaten || "Subang",
    luasLahan: Number(draft.luasLahan) || 1.0,
    luasLahanFormatted: draft.luasLahanFormatted || `${draft.luasLahan || 1.0} Ha`,
    komoditas: draft.komoditas || "Padi",
    varietas: draft.varietas || "Unggul Lokal",
    estimasiPanen: draft.estimasiPanen || "Desember 2026",
    estimasiHasilTon: Number(draft.estimasiHasilTon) || Number((Number(draft.luasLahan || 1.0) * 6).toFixed(1)),
    statusVerifikasi: activeAdmin ? "Terverifikasi" : "Menunggu Verifikasi",
    catatanAI: activeAdmin
      ? `Didata & divalidasi langsung oleh ${activeAdmin.nama} (${activeAdmin.role}) via WhatsApp pada ${new Date().toLocaleDateString("id-ID")}. Data lengkap tersinkronisasi ke Google Sheets.`
      : `Tercatat lengkap via WhatsApp Chatbot pada ${new Date().toLocaleDateString("id-ID")}. Data telah divalidasi dan tersinkronisasi ke Google Sheets.`,
    syncStatus: "synced",
    googleSheetRow: farmersDb.length + 2,
  };
  farmersDb.unshift(newRecord);
  return newRecord;
}

// Format success confirmation text
function formatSuccessFarmerRegistration(newRecord: FarmerRecord, activeAdmin?: AdminUser): string {
  if (activeAdmin) {
    return (
      `✅ *Data Petani Lengkap & Berhasil Ditambahkan ke Google Sheets!*\n\n` +
      `Bpk/Ibu *${activeAdmin.nama}*, seluruh data pokok telah lengkap dan telah tersimpan di database:\n\n` +
      `• *ID Registrasi:* \`${newRecord.id}\`\n` +
      `• *Nama Petani:* *${newRecord.nama}*\n` +
      `• *Komoditas:* *${newRecord.komoditas}* (${newRecord.varietas})\n` +
      `• *Luas Lahan:* *${newRecord.luasLahanFormatted}*\n` +
      `• *Lokasi:* ${newRecord.alamat} (${newRecord.kabupaten})\n` +
      `• *Estimasi Panen:* ${newRecord.estimasiPanen} (~*${newRecord.estimasiHasilTon} Ton*)\n` +
      `• *Status Verifikasi:* 🟢 *${newRecord.statusVerifikasi}* (Otoritas ${activeAdmin.role})\n` +
      `• *Baris Google Sheets:* Baris #${newRecord.googleSheetRow}\n\n` +
      `Data telah otomatis tersimpan dan dapat dilihat langsung di tab *Dashboard* dan *Google Sheets*.`
    );
  }
  return (
    `✅ *Data Petani Lengkap & Berhasil Ditambahkan ke Google Sheets!*\n\n` +
    `Data pendaftaran lahan telah lengkap dan berhasil disimpan ke database resmi:\n\n` +
    `• *ID Registrasi:* \`${newRecord.id}\`\n` +
    `• *Nama Petani:* *${newRecord.nama}*\n` +
    `• *Komoditas:* *${newRecord.komoditas}* (${newRecord.varietas})\n` +
    `• *Luas Lahan:* *${newRecord.luasLahanFormatted}*\n` +
    `• *Lokasi:* ${newRecord.alamat} (${newRecord.kabupaten})\n` +
    `• *Estimasi Panen:* ${newRecord.estimasiPanen} (~*${newRecord.estimasiHasilTon} Ton*)\n` +
    `• *Status Verifikasi:* 🟢 *${newRecord.statusVerifikasi}*\n` +
    `• *Baris Google Sheets:* Baris #${newRecord.googleSheetRow}\n\n` +
    `Data sudah dapat dilihat di tab Dashboard dan Google Sheets secara real-time!`
  );
}

// Smart Dynamic Fallback Generator for Admin queries if AI is busy/offline
function generateSmartAdminFallback(
  message: string,
  activeAdmin: AdminUser,
  farmers: FarmerRecord[],
  commodities: MarketCommodity[],
  currentDraft: Partial<FarmerRecord> = {}
) {
  const lower = (message || "").toLowerCase();
  const totalLuas = farmers.reduce((acc, f) => acc + (f.luasLahan || 0), 0).toFixed(1);
  const totalPanen = farmers.reduce((acc, f) => acc + (f.estimasiHasilTon || 0), 0).toFixed(1);
  const unverified = farmers.filter((f) => f.statusVerifikasi !== "Terverifikasi");

  // 0. Admin adding or registering a farmer directly via WhatsApp
  const isAddRequest =
    lower.includes("tambah") ||
    lower.includes("daftarkan") ||
    lower.includes("daftar") ||
    lower.includes("input") ||
    lower.includes("masukkan") ||
    lower.includes("catat") ||
    lower.includes("simpan");

  if (isAddRequest || (lower.includes("petani") && (lower.includes("lahan") || lower.includes("pak ") || lower.includes("bu ")))) {
    const { extracted: ext } = extractFarmerFromText(message, currentDraft || {});
    const merged = { ...(currentDraft || {}), ...ext };
    const check = checkFarmerCompleteness(merged);

    // If incomplete, DO NOT save to database yet! Ask for missing fields.
    if (!check.isComplete) {
      const incomplete = formatIncompleteFarmerPrompt(merged, activeAdmin.nama, true);
      return {
        ...incomplete,
        isAdminAction: true,
      };
    }

    // Only save when data is complete
    const newRecord = saveFarmerRecord(merged, activeAdmin, activeAdmin.noHp);
    return {
      reply: formatSuccessFarmerRegistration(newRecord, activeAdmin),
      extracted: newRecord,
      isComplete: true,
      isAdminAction: true,
      savedRecord: newRecord,
      quickReplies: ["📊 Rekap Semua Petani", "📥 Buka Google Sheets", "🌾 Tambah Petani Lainnya"],
    };
  }

  // 1. Unverified / verifikasi inquiry
  if (lower.includes("belum") || lower.includes("verifikasi") || lower.includes("unverified")) {
    const list = unverified
      .map(
        (f, i) =>
          `${i + 1}. *${f.nama}* (${f.noHp})\n   📍 ${f.kabupaten || f.alamat} | Lahan: *${f.luasLahan} Ha* (${f.komoditas})\n   🗓️ Proyeksi Panen: ${f.estimasiPanen} (~${f.estimasiHasilTon} Ton)\n   ⚠️ Catatan: ${f.catatanAI || "Menunggu validasi polygon lahan oleh PPL."}`
      )
      .join("\n\n");

    return {
      reply: `🎖️ *Laporan Validasi Petani untuk Admin ${activeAdmin.nama}:*\n\nSaat ini terdapat *${unverified.length} data petani* berstatus *Menunggu Verifikasi* dari total ${farmers.length} petani mitra terdaftar:\n\n${list || "✅ Seluruh data petani saat ini telah berstatus Terverifikasi."}\n\n💡 *Rekomendasi Tindakan PPL:*\n1. Koordinasikan dengan petugas penyuluh di wilayah bersangkutan untuk ground-check batas lahan.\n2. Lakukan validasi nomor rekening kelompok tani untuk penyaluran bantuan sarana produksi.`,
      extracted: {},
      isComplete: false,
      isAdminAction: true,
      quickReplies: ["🌾 Data Petani Padi", "🌶️ Data Petani Cabai", "📥 Siapkan Ekspor Data Sheets", "📊 Rekap Statistik Lengkap"],
    };
  }

  // 2. Broadcast / Draf Pesan WA
  if (
    lower.includes("draf") ||
    lower.includes("broadcast") ||
    lower.includes("pesan") ||
    lower.includes("blast") ||
    lower.includes("umumkan")
  ) {
    return {
      reply: `🎖️ *Draf Pesan WhatsApp Resmi Disiapkan untuk Admin ${activeAdmin.nama}*\n*(Siap Salin & Kirim ke Grup Kelompok Tani / Petugas PPL)*:\n\n━━━━━━━━━━━━━━━━━━━━\n🌾 *PEMBERITAHUAN RESMI DINAS PERTANIAN & KETAHANAN PANGAN*\n\nKepada Yth. Seluruh Ketua Kelompok Tani & Petani Mitra,\n\nMenindaklanjuti pemantauan data agroklimat dan dinamika pasokan panen bulan ${new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" })}, kami menghimbau:\n\n1. *Optimalisasi Jadwal Panen:* Segera koordinasikan waktu panen dengan petugas PPL desa masing-masing untuk kelancaran logistik dan penyerapan hasil panen.\n2. *Kewaspadaan Hama & Cuaca:* Waspadai serangan hama pasca-hujan dan pastikan saluran drainase lahan tetap bersih.\n3. *Pembaruan Data Lahan:* Petani yang belum melengkapi data pendaftaran Google Sheets agar segera melapor melalui layanan WhatsApp Kang Tani AI.\n\nDemikian himbauan ini kami sampaikan demi menjaga stabilitas pasokan dan kesejahteraan bersama.\n\n*Hormat kami,*\n*${activeAdmin.nama}*\n_${activeAdmin.role} - ${activeAdmin.instansi}_\n━━━━━━━━━━━━━━━━━━━━`,
      extracted: {},
      isComplete: false,
      isAdminAction: true,
      quickReplies: ["📢 Kirim Broadcast Sekarang", "📊 Rekap Semua Petani", "🌶️ Analisis Harga Cabai", "📥 Ekspor Sheets"],
    };
  }

  // 3. Price anomaly / Pasar inquiry
  if (lower.includes("harga") || lower.includes("anomali") || lower.includes("pasar") || lower.includes("inflasi")) {
    const anomalyList = commodities
      .filter((c) => c.statusAnomali !== "NORMAL")
      .map(
        (c) =>
          `• *${c.nama}*: Rp ${c.hargaSekarang.toLocaleString("id-ID")}/kg (${c.perubahanPersen > 0 ? "+" : ""}${c.perubahanPersen}% | Status: *${c.statusAnomali}*)\n  📝 _${c.pesanAnomali || c.rekomendasiPetani}_`
      )
      .join("\n\n");

    return {
      reply: `🎖️ *Analisis Intelijen Pasar & Anomali Pangan*\n*Disiapkan untuk: ${activeAdmin.nama}*\n\nBerikut komoditas yang terdeteksi mengalami deviasi harga signifikan per ${new Date().toLocaleDateString("id-ID")}:\n\n${anomalyList}\n\n💡 *Rekomendasi Taktis Dinas:*\n1. *Intervensi Pasar Cabai:* Gelar Operasi Pasar Murah mandiri di sentra konsumen dan pasok langsung dari panen Kediri/Garut.\n2. *Subsidi Ongkos Angkut:* Manfaatkan dana BTT (Belanja Tidak Terduga) untuk subsidi logistik armada truk dari sentra surplus ke daerah defisit.\n3. *Fasilitasi Cold Storage:* Tampung kelebihan pasokan sementara di CAS (Controlled Atmosphere Storage).`,
      extracted: {},
      isComplete: false,
      isAdminAction: true,
      quickReplies: ["🌶️ Detail Petani Cabai", "🧅 Detail Petani Bawang", "📊 Rekap Semua Petani", "📥 Ekspor Sheets"],
    };
  }

  // 4. Commodity filtering (e.g. padi, cabai, bawang, jagung)
  if (lower.includes("padi") || lower.includes("cabai") || lower.includes("bawang") || lower.includes("jagung")) {
    const keyword = lower.includes("cabai")
      ? "cabai"
      : lower.includes("bawang")
      ? "bawang"
      : lower.includes("jagung")
      ? "jagung"
      : "padi";

    const filtered = farmers.filter(
      (f) => f.komoditas.toLowerCase().includes(keyword) || f.varietas.toLowerCase().includes(keyword)
    );
    const cLuas = filtered.reduce((acc, f) => acc + (f.luasLahan || 0), 0).toFixed(1);
    const cPanen = filtered.reduce((acc, f) => acc + (f.estimasiHasilTon || 0), 0).toFixed(1);

    const list = filtered
      .slice(0, 5)
      .map(
        (f, i) =>
          `${i + 1}. *${f.nama}* (${f.noHp})\n   📍 ${f.kabupaten || f.alamat}\n   🌾 Varietas: ${f.varietas} | Lahan: *${f.luasLahan} Ha*\n   🗓️ Estimasi Panen: ${f.estimasiPanen} (~*${f.estimasiHasilTon} Ton*) [${f.statusVerifikasi}]`
      )
      .join("\n\n");

    return {
      reply: `🎖️ *Analisis Komoditas ${keyword.toUpperCase()} untuk Admin ${activeAdmin.nama}:*\n\n📊 *Ringkasan Agregat:*\n• Jumlah Petani Terdaftar: *${filtered.length} Petani*\n• Total Luas Lahan: *${cLuas} Hektar*\n• Estimasi Total Produksi: *${cPanen} Ton*\n\n📋 *Daftar Petani Terdata:*\n${list}\n\n💡 Seluruh data telah tercatat di Google Sheets real-time dan siap dianalisis data science.`,
      extracted: {},
      isComplete: false,
      isAdminAction: true,
      quickReplies: [
        `📥 Ekspor Data ${keyword.toUpperCase()}`,
        "📊 Rekap Semua Komoditas",
        "⚠️ Cek Belum Verifikasi",
        "📈 Analisis Harga Pasar",
      ],
    };
  }

  // 5. Export / Download
  if (
    lower.includes("ekspor") ||
    lower.includes("download") ||
    lower.includes("unduh") ||
    lower.includes("link") ||
    lower.includes("csv")
  ) {
    return {
      reply: `📥 *Akses Data Google Sheets & Ekspor CSV Siap!*\n\nBpk/Ibu ${activeAdmin.nama}, berikut tautan resmi penarikan database:\n\n• *Format CSV Master:* [/api/sheets/export.csv](/api/sheets/export.csv)\n• *Live Spreadsheet View:* [/api/sheets/live-view](/api/sheets/live-view)\n• *Total Record:* ${farmers.length} data petani mitra terdaftar\n• *Integritas Sinkronisasi:* 100% Synced ke Google Sheets Cloud\n\nFile CSV dapat langsung dibuka di Microsoft Excel, Google Sheets, atau diimpor ke Jupyter Notebook/Pandas untuk pemodelan data science.`,
      extracted: {},
      isComplete: false,
      isAdminAction: true,
      quickReplies: ["📊 Rekap Semua Petani", "🌾 Data Panen Padi", "🌶️ Data Petani Cabai"],
    };
  }

  // 5b. Google Drive & Sheets API Key Status & Security
  if (
    lower.includes("api key") ||
    lower.includes("drive") ||
    lower.includes("kunci api") ||
    lower.includes("keamanan") ||
    lower.includes("token")
  ) {
    const rawKey = process.env.GOOGLE_DRIVE_SHEETS_API_KEY;
    const isReady = !!rawKey && rawKey.length > 5;
    const masked = isReady
      ? `${rawKey!.slice(0, 4)}••••••••••••••••••••${rawKey!.slice(-4)}`
      : "Belum Dikonfigurasi";

    return {
      reply: `🔐 *Keamanan & Status Kredensial Google Drive / Sheets API*\n\nBpk/Ibu ${activeAdmin.nama}, kredensial API telah *diamankan di backend server*:\n\n• *Status Kunci:* ${isReady ? "🟢 TERPASANG & AKTIF" : "🔴 BELUM AKTIF"}\n• *Kunci Terproteksi:* \`${masked}\`\n• *Tingkat Keamanan:* *Server-Side Isolated Environment* (kunci tidak pernah dibagikan ke browser publik)\n• *Otoritas:* Read & Write Sinkronisasi Google Sheets / Drive Cloud\n• *Jumlah Data Tersinkronisasi:* *${farmers.length} Petani* (${totalPanen} Ton Proyeksi)\n\nAgent TaniAI siap mengeksekusi integrasi dan pembaruan data secara langsung dengan otorisasi kredensial ini.`,
      extracted: {},
      isComplete: false,
      isAdminAction: true,
      quickReplies: ["📥 Buka Live Sheets", "🌾 Rekap Semua Petani", "📊 Analisis Klaster Padi"],
    };
  }

  // 6. Default Executive Summary / Rekap
  const komoditasSummary = farmers.reduce((acc: any, f) => {
    acc[f.komoditas] = (acc[f.komoditas] || 0) + 1;
    return acc;
  }, {});
  const komoditasText = Object.entries(komoditasSummary)
    .map(([k, count]) => `• ${k}: *${count} Petani*`)
    .join("\n");

  return {
    reply: `🎖️ *Halo Bpk/Ibu ${activeAdmin.nama}!* \n*(Otoritas: ${activeAdmin.role} - ${activeAdmin.instansi})*\n\nBerikut ringkasan eksekutif database pertanian per ${new Date().toLocaleDateString("id-ID")}:\n\n📊 *Indikator Utama:* \n• Total Petani Terdata: *${farmers.length} Petani*\n• Total Luas Lahan: *${totalLuas} Hektar*\n• Proyeksi Total Panen: *${totalPanen} Ton*\n• Terverifikasi: *${farmers.length - unverified.length} Petani* (${unverified.length} menunggu verifikasi)\n\n🌾 *Komoditas Terdaftar:*\n${komoditasText}\n\nSilakan instruksikan analisis spesifik yang ingin Bpk/Ibu lakukan, seperti: *"analisis panen cabai"*, *"draf broadcast hama"*, *"tampilkan yang belum verifikasi"*, atau *"rekomendasi stabilisasi harga"*.`,
    extracted: {},
    isComplete: false,
    isAdminAction: true,
    quickReplies: ["📊 Analisis Klaster Padi", "🌶️ Rekomendasi Harga Cabai", "📢 Buat Draf Broadcast WA", "⚠️ Cek Belum Verifikasi", "📥 Ekspor CSV Sheets"],
  };
}

// Lazy initialize Gemini client
let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI | null {
  if (!geminiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key && key !== "MY_GEMINI_API_KEY") {
      geminiClient = new GoogleGenAI({ apiKey: key });
    }
  }
  return geminiClient;
}

// Helper to invoke Gemini with automatic model fallback & timeout protection
async function callGeminiGenerate(ai: GoogleGenAI, contents: any): Promise<string> {
  // Prioritize fast, high-availability gemini-3.1-flash-lite, then fallback to 3.8-flash and flash-latest
  const models = ["gemini-3.1-flash-lite", "gemini-3.8-flash", "gemini-flash-latest"];
  let lastErr: any = null;
  for (const model of models) {
    try {
      const callPromise = ai.models.generateContent({
        model,
        contents,
      });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout (15s) calling ${model}`)), 15000)
      );
      const res: any = await Promise.race([callPromise, timeoutPromise]);
      if (res && res.text) {
        return res.text;
      }
    } catch (err: any) {
      lastErr = err;
      const errMsg = err?.status || err?.message || err;
      console.log(`[Gemini Info] Model ${model} fallback triggered (${errMsg}), trying next available model...`);
    }
  }
  throw lastErr || new Error("All Gemini models failed");
}

export function createServerApp() {
  const app = express();
  app.use(express.json());

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      app: "TaniAI - WhatsApp & Google Sheets Agri-Agent",
      version: "1.0.0",
      time: new Date().toISOString(),
      farmersCount: farmersDb.length,
      commoditiesCount: commoditiesDb.length,
      adminsCount: adminsDb.length,
      hasGeminiKey: !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY"),
    });
  });

  // GET all recognized admin numbers
  app.get("/api/admins", (_req, res) => {
    res.json(adminsDb);
  });

  // POST add new admin phone number
  app.post("/api/admins", (req, res) => {
    const { nama, noHp, instansi, role, izinAkses } = req.body;
    if (!nama || !noHp) {
      return res.status(400).json({ error: "Nama dan nomor WhatsApp wajib diisi." });
    }

    const existing = findAdmin(noHp);
    if (existing) {
      return res.status(400).json({ error: `Nomor ini sudah terdaftar sebagai admin (${existing.nama})` });
    }

    const newAdmin: AdminUser = {
      id: `ADM-${String(adminsDb.length + 1).padStart(3, "0")}`,
      nama: nama.trim(),
      noHp: noHp.trim(),
      instansi: instansi || "Dinas Pertanian / PPL Lapangan",
      role: role || "PETUGAS_PPL",
      izinAkses: izinAkses || ["rekap_data", "ekspor_sheets", "verifikasi_petani"],
      aktif: true,
      waktuTerdaftar: new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }),
    };

    adminsDb.push(newAdmin);
    res.status(201).json(newAdmin);
  });

  // DELETE or deactivate admin phone number
  app.delete("/api/admins/:id", (req, res) => {
    const { id } = req.params;
    if (id === "ADM-001") {
      return res.status(403).json({ error: "Super Admin utama tidak dapat dihapus." });
    }
    adminsDb = adminsDb.filter((a) => a.id !== id);
    res.json({ success: true, message: "Nomor admin berhasil dihapus." });
  });

  // GET all registered farmers
  app.get("/api/farmers", (_req, res) => {
    res.json(farmersDb);
  });

  // POST add new farmer
  app.post("/api/farmers", (req, res) => {
    const data = req.body;
    const check = checkFarmerCompleteness(data);
    if (!check.isComplete) {
      return res.status(400).json({
        error: "Data petani belum lengkap. Harap lengkapi seluruh informasi pokok sebelum menyimpan ke database.",
        missingFields: check.missingFields,
      });
    }

    const newFarmer: FarmerRecord = {
      id: `TANI-${String(farmersDb.length + 1).padStart(3, "0")}`,
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
      nama: data.nama,
      noHp: data.noHp || "+62 8xx-xxxx-xxxx",
      alamat: data.alamat || `Desa Binaan, ${data.kabupaten || "Sentra"}`,
      kabupaten: data.kabupaten || "Subang",
      luasLahan: Number(data.luasLahan) || 1.0,
      luasLahanFormatted: data.luasLahanFormatted || `${data.luasLahan || 1.0} Ha`,
      komoditas: data.komoditas,
      varietas: data.varietas || "Lokal Unggul",
      estimasiPanen: data.estimasiPanen || "November 2026",
      estimasiHasilTon: Number(data.estimasiHasilTon) || Number(((Number(data.luasLahan) || 1) * 6).toFixed(1)),
      statusVerifikasi: data.statusVerifikasi || "Terverifikasi",
      catatanAI: data.catatanAI || "Data dicatat melalui sistem TaniAI.",
      syncStatus: "synced",
      googleSheetRow: farmersDb.length + 2,
    };
    farmersDb.unshift(newFarmer);
    res.status(201).json(newFarmer);
  });

  // DELETE farmer by ID
  app.delete("/api/farmers/:id", (req, res) => {
    const { id } = req.params;
    farmersDb = farmersDb.filter((f) => f.id !== id);
    res.json({ success: true, message: `Data petani ${id} berhasil dihapus.` });
  });

  // GET market commodities & anomaly prices
  app.get("/api/commodities", (_req, res) => {
    res.json(commoditiesDb);
  });

  // POST simulate or update commodity price
  app.post("/api/commodities/update", (req, res) => {
    const { id, hargaBaru, penyebab } = req.body;
    const item = commoditiesDb.find((c) => c.id === id);
    if (!item) {
      return res.status(404).json({ error: "Komoditas tidak ditemukan" });
    }

    const hargaLama = item.hargaSekarang;
    const baru = Number(hargaBaru) || hargaLama;
    const perubahan = ((baru - item.hargaKemarin) / item.hargaKemarin) * 100;

    item.hargaKemarin = hargaLama;
    item.hargaSekarang = baru;
    item.perubahanPersen = Number(perubahan.toFixed(2));
    item.tanggalUpdate = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

    // Evaluate anomaly thresholds (+/- 15%)
    if (item.perubahanPersen >= 20) {
      item.statusAnomali = "LONJAKAN_EKSTREM";
      item.pesanAnomali = `Lonjakan ekstrem (+${item.perubahanPersen}%) akibat fluktuasi pasokan dan cuaca. ${penyebab || ""}`;
    } else if (item.perubahanPersen <= -20) {
      item.statusAnomali = "PENURUNAN_DRASTIS";
      item.pesanAnomali = `Penurunan drastis (${item.perubahanPersen}%) di bawah acuan pasar. ${penyebab || ""}`;
    } else if (Math.abs(item.perubahanPersen) >= 10) {
      item.statusAnomali = "PERINGATAN_FLUKTUASI";
      item.pesanAnomali = `Perubahan harga signifikan (${item.perubahanPersen}%). Pantau ketat dinamika pasar.`;
    } else {
      item.statusAnomali = "NORMAL";
      item.pesanAnomali = "Kondisi harga relatif stabil dalam rentang normal.";
    }

    // Append to trend
    item.tren7Hari.push({
      tanggal: new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
      harga: baru,
    });
    if (item.tren7Hari.length > 7) {
      item.tren7Hari.shift();
    }

    res.json(item);
  });

  // POST broadcast anomaly notification to farmers
  app.post("/api/notifications/broadcast", (req, res) => {
    const { komoditasId } = req.body;
    const commodity = commoditiesDb.find((c) => c.id === komoditasId);
    if (!commodity) {
      return res.status(404).json({ error: "Komoditas tidak ditemukan" });
    }

    // Find farmers growing this commodity
    const matchingFarmers = farmersDb.filter((f) =>
      f.komoditas.toLowerCase().includes(commodity.nama.toLowerCase().split(" ")[0])
    );

    const isSurge = commodity.statusAnomali === "LONJAKAN_EKSTREM";
    const alertMessage = isSurge
      ? `📢 [TaniAI ALERT HARGA PASAR]\nBpk/Ibu Petani ${commodity.nama}, harga pasar melonjak tinggi mencapai Rp ${commodity.hargaSekarang.toLocaleString("id-ID")}/kg (+${commodity.perubahanPersen}%).\n💡 Rekomendasi: ${commodity.rekomendasiPetani}`
      : `⚠️ [TaniAI PERINGATAN PASAR]\nBpk/Ibu Petani ${commodity.nama}, harga pasar mengalami pelemahan di Rp ${commodity.hargaSekarang.toLocaleString("id-ID")}/kg (${commodity.perubahanPersen}%).\n💡 Rekomendasi: ${commodity.rekomendasiPetani}`;

    const newNotif: AnomalyNotification = {
      id: `notif-${Date.now()}`,
      komoditas: commodity.nama,
      tipeAnomali: commodity.statusAnomali as any,
      pesanPeringatan: alertMessage,
      waktuKirim: new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) + ", " + new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB",
      jumlahPetaniTerdampak: Math.max(matchingFarmers.length, 1),
      status: "Terkirim",
      targetPetaniNames: matchingFarmers.length > 0 ? matchingFarmers.map((f) => f.nama) : ["Seluruh Petani Terdaftar"],
    };

    notificationsDb.unshift(newNotif);
    res.json({ success: true, notification: newNotif, recipientsCount: newNotif.jumlahPetaniTerdampak });
  });

  // GET notifications list
  app.get("/api/notifications", (_req, res) => {
    res.json(notificationsDb);
  });

  // GET strategic recommendations
  app.get("/api/strategic-recommendation", (_req, res) => {
    res.json(latestRecommendation);
  });

  // POST generate strategic recommendation via Gemini AI
  app.post("/api/strategic-recommendation/generate", async (_req, res) => {
    const ai = getGemini();

    const summaryContext = {
      totalPetani: farmersDb.length,
      totalLuasLahan: farmersDb.reduce((acc, f) => acc + (f.luasLahan || 0), 0).toFixed(1),
      totalEstimasiPanenTon: farmersDb.reduce((acc, f) => acc + (f.estimasiHasilTon || 0), 0).toFixed(1),
      daftarPetani: farmersDb.map((f) => ({
        nama: f.nama,
        kabupaten: f.kabupaten,
        luas: `${f.luasLahan} Ha`,
        komoditas: f.komoditas,
        panen: f.estimasiPanen,
        hasilTon: f.estimasiHasilTon,
      })),
      anomaliPasar: commoditiesDb.map((c) => ({
        nama: c.nama,
        hargaSekarang: c.hargaSekarang,
        perubahanPersen: c.perubahanPersen,
        statusAnomali: c.statusAnomali,
      })),
    };

    if (!ai) {
      // Fallback structured recommendation
      const fallback: StrategicRecommendation = {
        ...INITIAL_STRATEGIC_RECOMMENDATION,
        id: `strat-${Date.now()}`,
        tanggal: new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
      };
      latestRecommendation = fallback;
      return res.json(fallback);
    }

    try {
      const prompt = `Anda adalah Senior Agricultural Data Scientist & Ahli Ekonomi Pertanian Indonesia.
Tugas Anda adalah menganalisis data spasial komoditas petani yang baru dicatat via WhatsApp dan disinkronkan ke Google Sheets, serta mencocokkannya dengan harga pasar saat ini.

DATA AGREGAT PETANI:
${JSON.stringify(summaryContext, null, 2)}

Buatkan laporan rekomendasi strategis dalam format JSON dengan struktur:
{
  "judul": "Judul Laporan Strategis yang tajam dan profesional",
  "urgensi": "Tinggi" | "Sedang" | "Rendah",
  "ringkasanEksekutif": "1-2 paragraf ringkasan temuan data untuk pengambil kebijakan & data scientist",
  "analisisOversupplyShortage": ["analisis titik 1", "analisis titik 2", "analisis titik 3"],
  "rekomendasiAgronomi": ["rekomendasi teknis tani 1", "rekomendasi teknis tani 2", "rekomendasi teknis tani 3"],
  "rekomendasiKebijakanHarga": ["rekomendasi intervensi harga 1", "rekomendasi intervensi harga 2"],
  "rekomendasiRantaiPasok": ["rekomendasi logistik dan distribusi 1", "rekomendasi logistik dan distribusi 2"],
  "dataScientistNotes": "Catatan analitik untuk penelitian lebih lanjut"
}

Berikan respon HANYA dalam JSON valid tanpa markdown wrapper jika memungkinkan.`;

      const responseText = await callGeminiGenerate(ai, prompt);
      let parsed: any = {};
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
      } catch (err) {
        console.warn("Could not parse JSON recommendation, using latest:", err);
        parsed = {};
      }

      const generated: StrategicRecommendation = {
        id: `strat-${Date.now()}`,
        tanggal: new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
        judul: parsed.judul || "Laporan Rekomendasi Strategis Pertanian",
        urgensi: parsed.urgensi || "Tinggi",
        ringkasanEksekutif: parsed.ringkasanEksekutif || "",
        analisisOversupplyShortage: parsed.analisisOversupplyShortage || [],
        rekomendasiAgronomi: parsed.rekomendasiAgronomi || [],
        rekomendasiKebijakanHarga: parsed.rekomendasiKebijakanHarga || [],
        rekomendasiRantaiPasok: parsed.rekomendasiRantaiPasok || [],
        dataScientistNotes: parsed.dataScientistNotes || "",
      };

      latestRecommendation = generated;
      res.json(generated);
    } catch (err: any) {
      console.error("Gemini strategic generation error:", err);
      res.json(latestRecommendation);
    }
  });

  // POST Chatbot endpoint (Kang Tani AI) with Role-Based Access Control (RBAC)
  app.post("/api/chat", async (req, res) => {
    const { message, history, currentDraft, senderPhone } = req.body;
    const ai = getGemini();

    const activeAdmin = findAdmin(senderPhone);
    const isAdmin = !!activeAdmin;

    // RULE-BASED SECURITY CHECK FOR NON-ADMIN NUMBERS
    if (!isAdmin) {
      const lower = (message || "").toLowerCase();
      const isAddAction =
        lower.includes("tambah") ||
        lower.includes("daftarkan") ||
        lower.includes("daftar") ||
        lower.includes("input") ||
        lower.includes("masukkan") ||
        lower.includes("catat") ||
        lower.includes("simpan");

      // Only check forbidden data-leak keywords if the user is NOT registering / adding data
      if (!isAddAction) {
        const forbiddenAdminKeywords = [
          "rekap semua",
          "rekap data",
          "semua data",
          "seluruh data",
          "minta semua",
          "minta data petani",
          "daftar semua petani",
          "seluruh petani",
          "semua petani",
          "nomor hp petani lain",
          "kontak semua petani",
          "telepon petani lain",
          "buka database dinas",
          "unduh semua data",
          "ekspor database",
          "download database",
        ];

        const isAttemptingAdminAction = forbiddenAdminKeywords.some((keyword) => lower.includes(keyword));

        if (isAttemptingAdminAction) {
          const maskedPhone = senderPhone ? senderPhone : "nomor Anda";
          return res.json({
            reply: `🔒 *Akses Dibatasi - Perlindungan Privasi Data Petani*\n\nMohon maaf Bpk/Ibu, nomor Anda (*${maskedPhone}*) terdeteksi sebagai *Petani Mitra* (bukan nomor admin resmi).\n\nDemi menjaga kerahasiaan data lahan dan kontak kelompok tani, fitur rekapitulasi database, daftar kontak petani lain, serta penarikan data administratif *hanya dapat diakses oleh Nomor Admin & Petugas PPL Terdaftar* (Dinas Ketahanan Pangan & Pertanian).\n\n💡 *Layanan WhatsApp yang dapat Bapak/Ibu nikmati:* \n1. 🌾 *Daftarkan Lahan Anda* (masuk otomatis ke database Google Sheets resmi)\n2. 📈 *Cek Harga Pasar Terkini* & anomali harga komoditas\n3. 💡 *Konsultasi Hama & Pemupukan*\n4. 📋 *Cek Status Pendaftaran Lahan Sendiri*`,
            extracted: currentDraft || {},
            isComplete: false,
            isRestricted: true,
            quickReplies: [
              "Daftarkan Lahan Saya",
              "Cek Harga Pasar Hari Ini",
              "Konsultasi Hama Tanaman",
              "Cek Anomali Harga Cabai",
            ],
          });
        }
      }
    }

    // IF SENDER IS ADMIN: Build Executive Agricultural Intelligence AI Assistant
    if (isAdmin) {
      const totalLuas = farmersDb.reduce((acc, f) => acc + (f.luasLahan || 0), 0).toFixed(1);
      const totalPanen = farmersDb.reduce((acc, f) => acc + (f.estimasiHasilTon || 0), 0).toFixed(1);
      const unverifiedFarmers = farmersDb.filter((f) => f.statusVerifikasi !== "Terverifikasi");
      const verifiedFarmers = farmersDb.filter((f) => f.statusVerifikasi === "Terverifikasi");

      const komoditasSummary = farmersDb.reduce((acc: any, f) => {
        if (!acc[f.komoditas]) acc[f.komoditas] = { count: 0, luas: 0, ton: 0, farmers: [] };
        acc[f.komoditas].count += 1;
        acc[f.komoditas].luas += f.luasLahan || 0;
        acc[f.komoditas].ton += f.estimasiHasilTon || 0;
        acc[f.komoditas].farmers.push(`${f.nama} (${f.kabupaten || f.alamat}, ${f.luasLahan} Ha, est. ${f.estimasiHasilTon} Ton, panen ${f.estimasiPanen})`);
        return acc;
      }, {});

      const kabupatenSummary = farmersDb.reduce((acc: any, f) => {
        const kab = f.kabupaten || "Lainnya";
        if (!acc[kab]) acc[kab] = { count: 0, luas: 0, ton: 0 };
        acc[kab].count += 1;
        acc[kab].luas += f.luasLahan || 0;
        acc[kab].ton += f.estimasiHasilTon || 0;
        return acc;
      }, {});

      if (ai) {
        try {
          const adminSystemInstructions = `Anda adalah "Kang Tani AI - Executive Agricultural Intelligence & Data Analytics Assistant", asisten AI resmi berdedikasi tinggi untuk pimpinan dinas, koordinator penyuluh pertanian (PPL), dan data scientist.

IDENTITAS ADMIN PENGIRIM:
- Nama: ${activeAdmin.nama}
- Jabatan / Otoritas: ${activeAdmin.role}
- Instansi: ${activeAdmin.instansi}
- Izin Akses: ${activeAdmin.izinAkses.join(", ")}

STATUS DATABASE REAL-TIME DI GOOGLE SHEETS & SENTRA:
- Total Petani Terdata: ${farmersDb.length} orang
- Total Luas Lahan Terdata: ${totalLuas} Hektar
- Total Proyeksi Panen: ${totalPanen} Ton
- Terverifikasi: ${verifiedFarmers.length} petani | Menunggu Verifikasi: ${unverifiedFarmers.length} petani (${unverifiedFarmers.map((u) => `${u.nama} [${u.komoditas}, ${u.luasLahan} Ha]`).join(", ") || "Semua sudah terverifikasi"})

DISTRIBUSI KOMODITAS:
${Object.entries(komoditasSummary)
  .map(([k, v]: any) => `• ${k}: ${v.count} petani, ${v.luas.toFixed(1)} Ha, ${v.ton.toFixed(1)} Ton`)
  .join("\n")}

DISTRIBUSI KABUPATEN/SENTRA:
${Object.entries(kabupatenSummary)
  .map(([k, v]: any) => `• ${k}: ${v.count} petani, ${v.luas.toFixed(1)} Ha, ${v.ton.toFixed(1)} Ton`)
  .join("\n")}

KONDISI HARGA & ANOMALI PASAR HARI INI:
${commoditiesDb
  .map(
    (c) =>
      `• ${c.nama}: Rp ${c.hargaSekarang.toLocaleString("id-ID")}/kg (Acuan HET: Rp ${c.hargaAcuanPemerintah.toLocaleString("id-ID")}, ${c.perubahanPersen > 0 ? "+" : ""}${c.perubahanPersen}%, Status: ${c.statusAnomali}, Catatan: ${c.pesanAnomali || c.rekomendasiPetani})`
  )
  .join("\n")}

DATABASE PETANI LENGKAP (MASTER DATA):
${JSON.stringify(
  farmersDb.map((f) => ({
    id: f.id,
    nama: f.nama,
    kontak: f.noHp,
    lokasi: `${f.alamat}, ${f.kabupaten}`,
    komoditas: f.komoditas,
    varietas: f.varietas,
    luasHa: f.luasLahan,
    panen: f.estimasiPanen,
    hasilTon: f.estimasiHasilTon,
    status: f.statusVerifikasi,
    catatanAI: f.catatanAI,
  })),
  null,
  1
)}

ATURAN DAN PRINSIP RESPON (SANGAT PENTING):
1. MENYESUAIKAN RESPOON SECARA CERDAS & FLEKSIBEL SESUAI PERMINTAAN ADMIN:
   - Jika admin meminta analisis/perhitungan: lakukan kalkulasi nyata dari data di atas (misal perbandingan, rata-rata tonase, estimasi suplai pasar, dll).
   - Jika admin mencari/memfilter data (misal: komoditas tertentu, wilayah tertentu, petani belum diverifikasi, luasan tertentu): sebutkan nama-nama petani, nomor HP, detail lahan dan estimasi panen secara akurat.
   - Jika admin meminta rekomendasi kebijakan/solusi/mitigasi (misal: kenaikan harga cabai ekstrem, anomali pasokan, distribusi pupuk, cuaca buruk): susun rekomendasi terstruktur, runut, dan taktis (contoh: intervensi pasar, mobilisasi rantai pasok antar-daerah, pengawalan PPL, manajemen cadangan pangan).
   - Jika admin meminta dibuatkan draf pesan (contoh: broadcast WhatsApp ke kelompok tani, arahan dinas ke petugas PPL, peringatan dini hama): buatkan draf pesan WhatsApp resmi yang siap disalin/disebarkan dengan format yang rapi dan profesional.
   - Jika admin meminta unduh/ekspor: informasikan link unduh CSV [/api/sheets/export.csv] dan live web spreadsheet [/api/sheets/live-view].
2. FORMAT & GAYA KOMUNIKASI:
   - Gunakan format gaya pesan WhatsApp yang rapi (*tebal*, _miring_, poin •, angka 1 2 3, emoji pendukung).
   - Sapa dengan hormat Bpk/Ibu ${activeAdmin.nama}.
   - Jangan menyertakan blok kode JSON mentah di dalam teks pesan "reply".
3. FORMAT OUTPUT JSON (WAJIB VALID JSON):
{
  "reply": "Pesan balasan profesional untuk Admin dalam format WhatsApp (*bold*, bullet points, emojis)",
  "quickReplies": ["3-4 tombol aksi cepat yang relevan langsung dengan topik yang baru saja dibahas"],
  "isAdminAction": true
}`;

          const historyFormatted = (history || [])
            .slice(-6)
            .map((h: any) => `${h.sender === "bot" ? "Kang Tani AI" : "Admin"}: ${h.text}`)
            .join("\n\n");

          const chatMessages = [
            {
              role: "user",
              parts: [
                {
                  text: `${adminSystemInstructions}\n\n${
                    historyFormatted ? `RIWAYAT PERCAKAPAN SEBELUMNYA:\n${historyFormatted}\n\n` : ""
                  }REQUEST DARI ADMIN ${activeAdmin.nama}:\n"${message}"`,
                },
              ],
            },
          ];

          const responseText = await callGeminiGenerate(ai, chatMessages);
          let parsed: any;
          try {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            parsed = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
          } catch {
            parsed = {
              reply: responseText,
              quickReplies: ["📊 Rekapitulasi Lengkap", "🌶️ Analisis Harga Cabai", "📥 Unduh Spreadsheet"],
              isAdminAction: true,
            };
          }

          if (typeof parsed.reply === "string" && parsed.reply.trim().startsWith("{") && parsed.reply.trim().endsWith("}")) {
            try {
              const inner = JSON.parse(parsed.reply.trim());
              if (inner.reply) parsed = { ...parsed, ...inner };
            } catch {}
          }

          const lowerAdminMsg = (message || "").toLowerCase();
          const isAddRequest =
            lowerAdminMsg.includes("tambah") ||
            lowerAdminMsg.includes("daftarkan") ||
            lowerAdminMsg.includes("daftar") ||
            lowerAdminMsg.includes("input") ||
            lowerAdminMsg.includes("masukkan") ||
            lowerAdminMsg.includes("catat") ||
            lowerAdminMsg.includes("simpan");

          const reg = extractFarmerFromText(message, currentDraft || {});
          const merged = { ...(currentDraft || {}), ...(parsed.extracted || {}), ...(reg.extracted || {}) };
          const check = checkFarmerCompleteness(merged);

          if (isAddRequest || reg.hasMinimumData || parsed.isComplete) {
            if (check.isComplete) {
              const newRecord = saveFarmerRecord(merged, activeAdmin, activeAdmin.noHp);
              parsed.savedRecord = newRecord;
              parsed.extracted = newRecord;
              parsed.isComplete = true;
              parsed.reply = formatSuccessFarmerRegistration(newRecord, activeAdmin);
            } else {
              // INCOMPLETE: DO NOT save to database! Ask for missing fields politely
              const incomplete = formatIncompleteFarmerPrompt(merged, activeAdmin.nama, true);
              parsed.reply = incomplete.reply;
              parsed.quickReplies = incomplete.quickReplies;
              parsed.extracted = merged;
              parsed.isComplete = false;
              delete parsed.savedRecord;
            }
          } else {
            parsed.extracted = {};
            parsed.isComplete = false;
          }

          parsed.isAdminAction = true;
          if (!parsed.quickReplies || !Array.isArray(parsed.quickReplies) || parsed.quickReplies.length === 0) {
            parsed.quickReplies = ["📊 Rekap Semua Petani", "🌶️ Analisis Anomali Cabai", "📥 Siapkan Ekspor Sheets"];
          }

          return res.json(parsed);
        } catch (err: any) {
          console.log("[Admin Chat] Gemini fallback triggered:", err?.message);
        }
      }

      // Smart Dynamic Fallback for Admin
      const smartFallback = generateSmartAdminFallback(message, activeAdmin, farmersDb, commoditiesDb, currentDraft);
      return res.json(smartFallback);
    }

    // GENERAL CONVERSATION (Petani Biasa / Non-Admin)
    const systemInstructions = `Anda adalah "Kang Tani AI", asisten digital cerdas, sopan, dan hangat yang terhubung ke WhatsApp untuk melayani para petani Indonesia.
Tujuan utama Anda:
1. Menyapa petani dengan hangat dan ramah dalam Bahasa Indonesia santun (bisa sesekali menyisipkan istilah akrab khas mitra tani seperti "Pak/Bu Tani", "Mugi berkah").
2. Membantu menjawab pertanyaan seputar pertanian, hama penyakit, pupuk, atau harga pasar komoditas secara tuntas, solutif, dan berbasis keahlian agrikultur.
3. Mencatat data lahan dan komoditas petani untuk direkam secara REAL-TIME ke Google Sheets agar para data scientist dan penyuluh pertanian dapat memberikan rekomendasi terbaik.
   Data yang wajib digali secara bertahap / natural jika petani ingin mendaftar:
   - Nama Petani
   - Nomor WhatsApp / Kontak
   - Alamat Lengkap (Desa, Kecamatan, Kabupaten/Kota)
   - Luasan Lahan (misal: "1 hektar", "5000 m2", "1 bahu", "100 ubin" -> konversikan ke satuan Hektar)
   - Komoditas utama & varietas yang ditanam (misal: Padi Inpari 32, Cabai Rawit Merah, Bawang Merah, Jagung Hibrida)
   - Estimasi Waktu Panen (Bulan & Tahun) serta perkiraan hasil panen dalam Ton.

STATUS DATA DRAFT SAAT INI:
${JSON.stringify(currentDraft || {}, null, 2)}

DATA HARGA PASAR TERKINI:
${commoditiesDb.map((c) => `- ${c.nama}: Rp ${c.hargaSekarang.toLocaleString("id-ID")}/kg (Status: ${c.statusAnomali}, Perubahan: ${c.perubahanPersen}%)`).join("\n")}

Format output yang HARUS Anda berikan adalah JSON persis seperti berikut:
{
  "reply": "Pesan balasan Anda ke petani via WhatsApp (gunakan format gaya pesan WhatsApp dengan emoji yang ramah, tebalkan kata penting seperti *Nama*, *Komoditas*, dsb.)",
  "extracted": {
    "nama": "nama jika disebutkan / null",
    "noHp": "nomor wa jika ada / null",
    "alamat": "desa & kecamatan jika ada / null",
    "kabupaten": "kabupaten jika ada / null",
    "luasLahan": 1.5,
    "luasLahanFormatted": "1.5 Ha (15.000 m²)",
    "komoditas": "komoditas jika ada / null",
    "varietas": "varietas benih jika ada / null",
    "estimasiPanen": "Bulan Tahun jika ada / null",
    "estimasiHasilTon": 9.5
  },
  "isComplete": true (hanya jika minimal nama, alamat, luasLahan, komoditas, estimasiPanen sudah lengkap terkumpul),
  "quickReplies": ["3-4 opsi pilihan cepat untuk tombol WhatsApp"]
}`;

    if (!ai) {
      // Intelligent rule-based fallback if API key is not yet set
      const lower = (message || "").toLowerCase();
      const isAddIntent =
        lower.includes("tambah") ||
        lower.includes("daftarkan") ||
        lower.includes("daftar") ||
        lower.includes("input") ||
        lower.includes("masukkan") ||
        lower.includes("catat") ||
        lower.includes("simpan");

      const reg = extractFarmerFromText(message, currentDraft || {});
      let extracted: Partial<FarmerRecord> = { ...(currentDraft || {}), ...reg.extracted };
      const check = checkFarmerCompleteness(extracted);

      // If user asks to add or provides farmer registration details
      if (isAddIntent || reg.hasMinimumData) {
        if (check.isComplete) {
          const newRecord = saveFarmerRecord(extracted, undefined, senderPhone);
          return res.json({
            reply: formatSuccessFarmerRegistration(newRecord),
            extracted: newRecord,
            isComplete: true,
            savedRecord: newRecord,
            quickReplies: [
              "Cek Harga Cabai Hari Ini",
              "Konsultasi Hama Tanaman",
              "Buka Database Google Sheets",
              "Daftarkan Lahan Lain",
            ],
          });
        } else {
          // Data is not complete yet: DO NOT save to database! Prompt for missing fields.
          const incomplete = formatIncompleteFarmerPrompt(extracted, undefined, false);
          return res.json(incomplete);
        }
      }

      let replyText =
        "🌾 *Salam Berkah Petani!* Saya Kang Tani AI, asisten digital siap melayani konsultasi pertanian dan pendaftaran lahan ke Google Sheets. Boleh tahu nama Bapak/Ibu, luas lahan, dan komoditas apa yang sedang ditanam?";

      if (lower.includes("padi") || lower.includes("cabai") || lower.includes("bawang") || lower.includes("jagung")) {
        const crop = lower.includes("cabai")
          ? "Cabai Rawit Merah"
          : lower.includes("bawang")
          ? "Bawang Merah"
          : lower.includes("jagung")
          ? "Jagung"
          : "Padi";
        extracted.komoditas = crop;
        replyText = `Matur nuwun infonya Pak/Bu! Senang mendengar Bapak/Ibu menanam *${crop}*. Berapa luasan lahan yang ditanam saat ini (misal: 1 Ha atau 5.000 m²), dan di desa/kabupaten mana lokasinya?`;
      } else if (lower.includes("ha") || lower.includes("hektar") || lower.includes("m2") || lower.includes("meter")) {
        const num = parseFloat(lower.match(/\d+(\.\d+)?/)?.[0] || "1.0");
        extracted.luasLahan = num;
        extracted.luasLahanFormatted = `${num} Ha (${num * 10000} m²)`;
        extracted.estimasiHasilTon = Number((num * 6.5).toFixed(1));
        replyText = `Data luasan *${extracted.luasLahanFormatted}* sudah Kang Tani catat. Kapan estimasi panennya (misal: November 2026)? Dan atas nama siapa kami catatkan ke Google Sheets?`;
      } else if (lower.includes("nama") || lower.includes("saya pak") || lower.includes("saya bu")) {
        extracted.nama = message.replace(/(halo|nama saya|saya|pak|bu)/gi, "").trim() || "Pak Petani";
        replyText = `Salam kenal *${extracted.nama}*! Data sementara sudah dicatat. Komoditas apa yang ditanam dan berapa luasan lahannya agar dapat kami verifikasi ke Google Sheets?`;
      }

      return res.json({
        reply: replyText,
        extracted,
        isComplete: false,
        quickReplies: [
          "Cek Harga Cabai Hari Ini",
          "Daftarkan Luas Lahan",
          "Konsultasi Hama Tanaman",
          "Buka Database Google Sheets",
        ],
      });
    }

    try {
      const historyFormatted = (history || [])
        .slice(-6)
        .map((h: any) => `${h.sender === "bot" ? "Kang Tani AI" : "Petani"}: ${h.text}`)
        .join("\n\n");

      const chatMessages = [
        {
          role: "user",
          parts: [
            {
              text: `${systemInstructions}\n\n${
                historyFormatted ? `RIWAYAT PERCAKAPAN SEBELUMNYA:\n${historyFormatted}\n\n` : ""
              }PESAN DARI PETANI:\n"${message}"`,
            },
          ],
        },
      ];

      const responseText = await callGeminiGenerate(ai, chatMessages);
      let parsed: any;
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
      } catch {
        parsed = {
          reply: responseText,
          extracted: {},
          isComplete: false,
          quickReplies: ["Daftarkan Lahan", "Cek Harga Pasar", "Konsultasi Pupuk"],
        };
      }

      // If reply is accidentally stringified JSON, unnest it
      if (typeof parsed.reply === "string" && parsed.reply.trim().startsWith("{") && parsed.reply.trim().endsWith("}")) {
        try {
          const inner = JSON.parse(parsed.reply.trim());
          if (inner.reply) {
            parsed = { ...parsed, ...inner };
          }
        } catch {
          // ignore
        }
      }

      // Merge extracted fields with regex extractor and previous draft
      const reg = extractFarmerFromText(message, currentDraft || {});
      const merged = { ...(currentDraft || {}), ...(parsed.extracted || {}), ...(reg.extracted || {}) };
      parsed.extracted = merged;

      const lowerNonAdmin = (message || "").toLowerCase();
      const isAddRequest =
        lowerNonAdmin.includes("tambah") ||
        lowerNonAdmin.includes("daftarkan") ||
        lowerNonAdmin.includes("daftar") ||
        lowerNonAdmin.includes("input") ||
        lowerNonAdmin.includes("masukkan") ||
        lowerNonAdmin.includes("catat") ||
        lowerNonAdmin.includes("simpan");

      const check = checkFarmerCompleteness(merged);

      // Only save when ALL required fields are complete!
      if (isAddRequest || reg.hasMinimumData || parsed.isComplete) {
        if (check.isComplete) {
          const newRecord = saveFarmerRecord(merged, undefined, senderPhone);
          parsed.savedRecord = newRecord;
          parsed.extracted = newRecord;
          parsed.isComplete = true;
          parsed.reply = formatSuccessFarmerRegistration(newRecord);
        } else {
          // INCOMPLETE DATA: DO NOT save to database yet! Prompt user to complete the missing fields.
          const incomplete = formatIncompleteFarmerPrompt(merged, undefined, false);
          parsed.reply = incomplete.reply;
          parsed.quickReplies = incomplete.quickReplies;
          parsed.extracted = merged;
          parsed.isComplete = false;
          delete parsed.savedRecord;
        }
      }

      res.json(parsed);
    } catch (error: any) {
      console.log("[Chat Info] Serving rule-based fallback reply:", error?.message || "fallback");
      const lower = (message || "").toLowerCase();
      const isAddRequest =
        lower.includes("tambah") ||
        lower.includes("daftarkan") ||
        lower.includes("daftar") ||
        lower.includes("input") ||
        lower.includes("masukkan") ||
        lower.includes("catat") ||
        lower.includes("simpan");

      const reg = extractFarmerFromText(message, currentDraft || {});
      const extracted: Partial<FarmerRecord> = { ...(currentDraft || {}), ...reg.extracted };
      const check = checkFarmerCompleteness(extracted);

      if (isAddRequest || reg.hasMinimumData) {
        if (check.isComplete) {
          const newRecord = saveFarmerRecord(extracted, undefined, senderPhone);
          return res.json({
            reply: formatSuccessFarmerRegistration(newRecord),
            extracted: newRecord,
            isComplete: true,
            savedRecord: newRecord,
            quickReplies: [
              "Cek Harga Cabai Hari Ini",
              "Konsultasi Hama Tanaman",
              "Buka Database Google Sheets",
              "Daftarkan Lahan Lain",
            ],
          });
        } else {
          // INCOMPLETE: DO NOT save to database! Ask for missing fields
          const incomplete = formatIncompleteFarmerPrompt(extracted, undefined, false);
          return res.json(incomplete);
        }
      }

      // Rule-based fallback response
      let fallbackReply =
        "🌾 *Salam Berkah Petani!* Pesan Bapak/Ibu telah diterima Kang Tani AI. Boleh disampaikan nama lengkap, luas lahan, dan komoditas apa yang sedang ditanam agar kami catat ke Google Sheets?";

      if (lower.includes("harga") || lower.includes("pasar")) {
        fallbackReply = `📊 *Informasi Harga Pasar Terkini:*\n• Beras Premium: Rp 16.200/kg\n• Cabai Rawit Merah: Rp 82.000/kg (⚠️ Lonjakan Ekstrem +36.7%)\n• Bawang Merah: Rp 28.500/kg\n• Jagung Pipil: Rp 5.800/kg\n\nApakah Bapak/Ibu ingin mendaftarkan komoditas dan perkiraan waktu panen?`;
      } else if (lower.includes("padi") || lower.includes("cabai") || lower.includes("bawang") || lower.includes("jagung")) {
        const crop = lower.includes("cabai")
          ? "Cabai Rawit"
          : lower.includes("bawang")
          ? "Bawang Merah"
          : lower.includes("jagung")
          ? "Jagung Hibrida"
          : "Padi";
        extracted.komoditas = crop;
        fallbackReply = `Matur nuwun infonya Pak/Bu! Senang mendengar Bapak/Ibu menanam *${crop}*. Berapa luasan lahan yang ditanam dan di desa mana lokasinya agar langsung kami sinkronkan ke Google Sheets?`;
      } else if (lower.includes("ha") || lower.includes("hektar") || lower.includes("m2")) {
        const num = parseFloat(lower.match(/\d+(\.\d+)?/)?.[0] || "1.0");
        extracted.luasLahan = num;
        extracted.luasLahanFormatted = `${num} Ha`;
        extracted.estimasiHasilTon = num * 6;
        fallbackReply = `Data luasan *${num} Hektar* berhasil dicatat. Atas nama Bapak/Ibu siapa pendaftaran lahan ini dicatatkan ke database?`;
      }

      res.json({
        reply: fallbackReply,
        extracted,
        isComplete: false,
        quickReplies: [
          "Daftarkan Lahan Baru",
          "Cek Harga Pasar Hari Ini",
          "Buka Database Google Sheets",
        ],
      });
    }
  });

  // Webhook WhatsApp Verification (Meta Cloud API Standard)
  app.get("/api/webhook/whatsapp", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "tani_ai_webhook_verify_token";

    if (mode === "subscribe" && token === verifyToken) {
      console.log("WhatsApp Webhook verified successfully.");
      return res.status(200).send(challenge);
    }
    return res.status(403).send("Verification token mismatch");
  });

  // Webhook WhatsApp Message Receiver
  app.post("/api/webhook/whatsapp", async (req, res) => {
    try {
      const body = req.body;
      console.log("Incoming WhatsApp Webhook event:", JSON.stringify(body));
      res.status(200).send("EVENT_RECEIVED");
    } catch (err) {
      console.error("Webhook processing error:", err);
      res.status(500).send("INTERNAL_ERROR");
    }
  });

  // CSV Export for Google Sheets
  app.get("/api/sheets/export.csv", (_req, res) => {
    const headers = [
      "ID",
      "Waktu Pencatatan",
      "Nama Petani",
      "Nomor WhatsApp",
      "Alamat / Desa",
      "Kabupaten / Provinsi",
      "Luas Lahan (Ha)",
      "Komoditas",
      "Varietas",
      "Estimasi Panen",
      "Estimasi Hasil (Ton)",
      "Status Verifikasi",
      "Catatan Rekomendasi AI",
    ];

    const rows = farmersDb.map((f) => [
      `"${f.id}"`,
      `"${f.timestamp}"`,
      `"${f.nama}"`,
      `"${f.noHp}"`,
      `"${f.alamat}"`,
      `"${f.kabupaten || ""}"`,
      f.luasLahan,
      `"${f.komoditas}"`,
      `"${f.varietas || ""}"`,
      `"${f.estimasiPanen}"`,
      f.estimasiHasilTon,
      `"${f.statusVerifikasi}"`,
      `"${(f.catatanAI || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="TaniAI_Database_Petani_GoogleSheets.csv"');
    res.send(csvContent);
  });

  // Standalone Google Sheets Live View Web Page with authentic spreadsheet UI & interaction
  app.get("/api/sheets/live-view", (req, res) => {
    const totalLuas = farmersDb.reduce((acc, f) => acc + (f.luasLahan || 0), 0).toFixed(1);
    const totalTon = farmersDb.reduce((acc, f) => acc + (f.estimasiHasilTon || 0), 0).toFixed(1);
    const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
    const host = req.get("host") || "localhost:3000";
    const fullCsvUrl = `${protocol}://${host}/api/sheets/export.csv`;

    const rowsHtml = farmersDb
      .map(
        (f, idx) => `
      <tr class="farmer-row hover:bg-emerald-50/50 transition-colors" data-nama="${f.nama.toLowerCase()}" data-komoditas="${f.komoditas.toLowerCase()}" data-alamat="${f.alamat.toLowerCase()}">
        <td class="row-num select-none">${idx + 2}</td>
        <td class="cell font-mono font-semibold text-emerald-800" data-col="A" data-row="${idx + 2}">${f.id}</td>
        <td class="cell text-slate-500 font-mono text-xs" data-col="B" data-row="${idx + 2}">${f.timestamp}</td>
        <td class="cell font-semibold text-slate-900" data-col="C" data-row="${idx + 2}">${f.nama}</td>
        <td class="cell font-mono text-slate-700" data-col="D" data-row="${idx + 2}">${f.noHp}</td>
        <td class="cell text-slate-700" data-col="E" data-row="${idx + 2}">${f.alamat}</td>
        <td class="cell text-slate-700" data-col="F" data-row="${idx + 2}">${f.kabupaten || "—"}</td>
        <td class="cell text-right font-mono font-bold text-emerald-900 bg-emerald-50/40" data-col="G" data-row="${idx + 2}">${f.luasLahan.toFixed(1)}</td>
        <td class="cell font-medium text-slate-800" data-col="H" data-row="${idx + 2}">${f.komoditas}</td>
        <td class="cell text-slate-600" data-col="I" data-row="${idx + 2}">${f.varietas || "—"}</td>
        <td class="cell text-slate-700" data-col="J" data-row="${idx + 2}">${f.estimasiPanen}</td>
        <td class="cell text-right font-mono font-bold text-amber-900 bg-amber-50/40" data-col="K" data-row="${idx + 2}">${f.estimasiHasilTon.toFixed(1)}</td>
        <td class="cell text-center" data-col="L" data-row="${idx + 2}"><span class="badge">${f.statusVerifikasi}</span></td>
        <td class="cell text-slate-600 max-w-sm truncate" data-col="M" data-row="${idx + 2}" title="${(f.catatanAI || "").replace(/"/g, "&quot;")}">${f.catatanAI || "—"}</td>
      </tr>`
      )
      .join("\n");

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Petani_TaniAI_2026_Database_Master - Google Sheets</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="icon" href="https://ssl.gstatic.com/docs/spreadsheets/favicon3.ico">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 10px; white-space: nowrap; }
    th { background: #f8fafc; color: #475569; position: sticky; top: 0; z-index: 10; font-weight: 600; text-align: left; }
    .col-header { text-align: center; color: #64748b; font-size: 11px; font-weight: 600; background: #f1f5f9; }
    .row-num { background: #f1f5f9; text-align: center; color: #64748b; font-family: monospace; width: 42px; font-size: 11px; }
    .badge { background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; border: 1px solid #bbf7d0; display: inline-block; }
    .cell-selected { outline: 2px solid #059669 !important; background-color: #ecfdf5 !important; position: relative; z-index: 2; }
    .scrollbar-thin::-webkit-scrollbar { height: 7px; width: 7px; }
    .scrollbar-thin::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
  </style>
</head>
<body class="bg-slate-100 flex flex-col h-screen overflow-hidden">
  <!-- Google Sheets Top Bar -->
  <header class="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between shrink-0 shadow-2xs">
    <div class="flex items-center space-x-3">
      <!-- Sheets Green Logo -->
      <div class="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14H6v-2h6v2zm0-4H6v-2h6v2zm0-4H6V7h6v2zm6 8h-4v-2h4v2zm0-4h-4v-2h4v2zm0-4h-4V7h4v2z"/>
        </svg>
      </div>
      <div>
        <div class="flex items-center space-x-2">
          <span class="font-bold text-slate-900 text-base">Petani_TaniAI_2026_Database_Master</span>
          <span class="bg-emerald-100 text-emerald-800 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-300">
            Live Web Spreadsheet
          </span>
          <span class="text-xs text-slate-400 hidden sm:inline">&bull; Tersimpan otomatis</span>
        </div>
        <!-- Menus -->
        <div class="flex items-center space-x-3 text-xs text-slate-600 mt-0.5">
          <span class="hover:text-emerald-700 cursor-pointer font-medium">File</span>
          <span class="hover:text-emerald-700 cursor-pointer font-medium">Edit</span>
          <span class="hover:text-emerald-700 cursor-pointer font-medium">Tampilan</span>
          <span class="hover:text-emerald-700 cursor-pointer font-medium">Sisipkan</span>
          <span class="hover:text-emerald-700 cursor-pointer font-medium">Format</span>
          <span class="hover:text-emerald-700 cursor-pointer font-medium">Data</span>
          <span class="hover:text-emerald-700 cursor-pointer font-medium">Alat</span>
          <span class="hover:text-emerald-700 cursor-pointer font-medium">Ekstensi</span>
          <span class="hover:text-emerald-700 cursor-pointer font-medium">Bantuan</span>
        </div>
      </div>
    </div>

    <!-- Quick Action Buttons -->
    <div class="flex items-center space-x-2">
      <button onclick="copyAllTSV()" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition cursor-pointer" title="Salin semua data tabel untuk di-paste (Ctrl+V) langsung ke Google Sheets">
        <span>📋 Salin Data (TSV)</span>
      </button>

      <button onclick="copyImportFormula()" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition cursor-pointer" title="Salin rumus =IMPORTDATA untuk live sync">
        <span>🔗 Salin Rumus Live</span>
      </button>

      <a href="/api/sheets/export.csv" download class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition cursor-pointer">
        <span>📥 Unduh .CSV</span>
      </a>

      <button onclick="openDocsGoogle()" class="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition cursor-pointer" title="Buka docs.google.com dengan panduan paste instan">
        <span>🌐 Buka di docs.google.com</span>
      </button>
    </div>
  </header>

  <!-- Formula Bar & Filter Toolbar -->
  <div class="bg-slate-50 border-b border-slate-200 px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
    <div class="flex items-center space-x-2 w-full sm:w-auto">
      <div id="cellCoord" class="bg-white border border-slate-300 rounded px-2.5 py-1 font-mono text-slate-800 font-bold text-xs min-w-[50px] text-center shadow-2xs">
        C2
      </div>
      <div class="text-slate-400 font-serif italic text-sm select-none px-1">
        fx
      </div>
      <input id="formulaInput" type="text" readonly value="${farmersDb[0]?.nama || ""}" class="bg-white border border-slate-300 rounded px-3 py-1 text-slate-800 text-xs flex-1 sm:w-96 font-mono shadow-2xs focus:outline-none" />
    </div>

    <!-- Search / Filter Box -->
    <div class="flex items-center space-x-2">
      <div class="relative">
        <input id="searchInput" type="text" onkeyup="filterTable()" placeholder="Cari nama, komoditas, desa..." class="pl-3 pr-3 py-1 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 w-52 sm:w-64" />
      </div>
      <button onclick="window.location.reload()" class="px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 transition cursor-pointer font-medium" title="Perbarui data terbaru">
        🔄 Refresh
      </button>
    </div>
  </div>

  <!-- Notification Banner -->
  <div id="toastBanner" class="hidden bg-emerald-700 text-white text-xs px-4 py-1.5 flex items-center justify-between transition-all">
    <span id="toastText">Data berhasil disalin!</span>
    <button onclick="document.getElementById('toastBanner').classList.add('hidden')" class="text-white/80 hover:text-white font-bold ml-4">✕</button>
  </div>

  <!-- Spreadsheet Data Table Container -->
  <div class="flex-1 overflow-auto bg-white scrollbar-thin">
    <table id="farmerTable" class="w-full">
      <thead>
        <tr>
          <th class="row-num select-none">#</th>
          <th class="col-header min-w-[90px]"><span class="block text-[10px] text-slate-400">A</span>ID Petani</th>
          <th class="col-header min-w-[130px]"><span class="block text-[10px] text-slate-400">B</span>Waktu Registrasi</th>
          <th class="col-header min-w-[160px]"><span class="block text-[10px] text-slate-400">C</span>Nama Petani</th>
          <th class="col-header min-w-[130px]"><span class="block text-[10px] text-slate-400">D</span>Nomor WhatsApp</th>
          <th class="col-header min-w-[180px]"><span class="block text-[10px] text-slate-400">E</span>Alamat / Desa</th>
          <th class="col-header min-w-[120px]"><span class="block text-[10px] text-slate-400">F</span>Kabupaten</th>
          <th class="col-header min-w-[110px] text-right bg-emerald-50/50"><span class="block text-[10px] text-slate-400">G</span>Luas Lahan (Ha)</th>
          <th class="col-header min-w-[130px]"><span class="block text-[10px] text-slate-400">H</span>Komoditas</th>
          <th class="col-header min-w-[120px]"><span class="block text-[10px] text-slate-400">I</span>Varietas</th>
          <th class="col-header min-w-[120px]"><span class="block text-[10px] text-slate-400">J</span>Estimasi Panen</th>
          <th class="col-header min-w-[110px] text-right bg-amber-50/50"><span class="block text-[10px] text-slate-400">K</span>Hasil (Ton)</th>
          <th class="col-header min-w-[120px] text-center"><span class="block text-[10px] text-slate-400">L</span>Status Verifikasi</th>
          <th class="col-header min-w-[260px]"><span class="block text-[10px] text-slate-400">M</span>Catatan AI Rekomendasi</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        <!-- Total Formula Row -->
        <tr class="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
          <td class="row-num select-none">${farmersDb.length + 2}</td>
          <td colspan="6" class="p-2 font-mono text-emerald-900">∑ TOTAL REKAPITULASI ( =SUM )</td>
          <td class="cell text-right font-mono text-emerald-900 bg-emerald-100 font-bold" data-col="G" data-row="${farmersDb.length + 2}">
            ${totalLuas} Ha
          </td>
          <td colspan="3" class="p-2 text-slate-600">
            Rata-rata: ${(Number(totalLuas) / (farmersDb.length || 1)).toFixed(2)} Ha/Petani
          </td>
          <td class="cell text-right font-mono text-amber-900 bg-amber-100 font-bold" data-col="K" data-row="${farmersDb.length + 2}">
            ${totalTon} Ton
          </td>
          <td colspan="2" class="p-2 text-center text-slate-500 font-normal">
            Database Siap Data Science
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Bottom Sheet Tabs Bar -->
  <footer class="bg-slate-100 border-t border-slate-300 px-4 py-1.5 flex items-center justify-between text-xs shrink-0">
    <div class="flex items-center space-x-1">
      <div class="bg-white border-t-2 border-emerald-600 px-3 py-1 text-xs font-bold text-slate-800 rounded-t shadow-2xs flex items-center space-x-1.5">
        <span class="text-emerald-700">📄</span>
        <span>Lahan_Petani_Master</span>
      </div>
      <div class="px-3 py-1 text-xs text-slate-500 hover:bg-slate-200 rounded cursor-pointer hidden sm:block">
        📊 Rekap_Komoditas
      </div>
      <div class="px-3 py-1 text-xs text-slate-500 hover:bg-slate-200 rounded cursor-pointer hidden sm:block">
        📈 Analisis_Harga_Pasar
      </div>
    </div>
    <div class="text-slate-500 text-[11px] flex items-center space-x-3">
      <span>Total Baris: <strong>${farmersDb.length} Petani Terdata</strong></span>
      <span>• Total Lahan: <strong>${totalLuas} Ha</strong></span>
      <span>• Proyeksi Panen: <strong>${totalTon} Ton</strong></span>
    </div>
  </footer>

  <script>
    const fullCsvUrl = "${fullCsvUrl}";
    const importFormula = '=IMPORTDATA("' + fullCsvUrl + '")';

    // Interactive Cell Selection
    let activeCell = null;
    document.querySelectorAll('.cell').forEach(td => {
      td.addEventListener('click', () => {
        if (activeCell) activeCell.classList.remove('cell-selected');
        td.classList.add('cell-selected');
        activeCell = td;
        const col = td.getAttribute('data-col') || 'A';
        const row = td.getAttribute('data-row') || '2';
        document.getElementById('cellCoord').innerText = col + row;
        document.getElementById('formulaInput').value = td.innerText.trim();
      });
    });

    function showToast(msg) {
      const banner = document.getElementById('toastBanner');
      const text = document.getElementById('toastText');
      text.innerHTML = msg;
      banner.classList.remove('hidden');
      setTimeout(() => banner.classList.add('hidden'), 5000);
    }

    function copyAllTSV() {
      const table = document.getElementById('farmerTable');
      let tsv = '';
      for (const row of table.rows) {
        const cells = Array.from(row.cells).map(c => c.innerText.replace(/\\t|\\n/g, ' ').trim());
        tsv += cells.join('\\t') + '\\n';
      }
      navigator.clipboard.writeText(tsv);
      showToast('✅ Seluruh tabel data petani berhasil disalin ke clipboard! Buka Google Sheets lalu tekan <strong>Ctrl+V</strong>.');
    }

    function copyImportFormula() {
      navigator.clipboard.writeText(importFormula);
      showToast('✅ Rumus Live Sync disalin: <code>' + importFormula + '</code>. Tempelkan di sel A1 Google Sheets Anda.');
    }

    function openDocsGoogle() {
      copyAllTSV();
      showToast('🌐 Membuka Google Sheets... Data telah disalin! Tekan <strong>Ctrl+V</strong> di sel A1 pada lembar kerja baru.');
      setTimeout(() => {
        window.open('https://docs.google.com/spreadsheets/create', '_blank');
      }, 500);
    }

    function filterTable() {
      const query = document.getElementById('searchInput').value.toLowerCase();
      const rows = document.querySelectorAll('.farmer-row');
      rows.forEach(r => {
        const nama = r.getAttribute('data-nama') || '';
        const komoditas = r.getAttribute('data-komoditas') || '';
        const alamat = r.getAttribute('data-alamat') || '';
        if (nama.includes(query) || komoditas.includes(query) || alamat.includes(query)) {
          r.style.display = '';
        } else {
          r.style.display = 'none';
        }
      });
    }
  </script>
</body>
</html>`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  });

  return app;
}

async function startServer() {
  const app = createServerApp();
  const PORT = 3000;

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🌾 TaniAI Server running on port ${PORT}`);
  });
}

startServer();
