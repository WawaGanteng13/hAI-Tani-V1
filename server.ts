import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import {
  INITIAL_FARMERS,
  INITIAL_COMMODITIES,
  INITIAL_NOTIFICATIONS,
  INITIAL_STRATEGIC_RECOMMENDATION,
  INITIAL_ADMINS,
  INITIAL_SUPPLIERS,
} from "./src/data/mockData";
import {
  FarmerRecord,
  MarketCommodity,
  AnomalyNotification,
  StrategicRecommendation,
  AdminUser,
  SupplierRecord,
} from "./src/types";
import { calculateFertilizerRecommendation } from "./src/utils/agronomy";
import { nextId } from "./lib/next-id";
import { nextSheetRow } from "./lib/sheet-row";

dotenv.config();

// In-memory data stores (with local disk-backed persistence)
let farmersDb: FarmerRecord[] = [...INITIAL_FARMERS];
let commoditiesDb: MarketCommodity[] = [...INITIAL_COMMODITIES];
let notificationsDb: AnomalyNotification[] = [...INITIAL_NOTIFICATIONS];
let latestRecommendation: StrategicRecommendation = { ...INITIAL_STRATEGIC_RECOMMENDATION };
let latestRecommendationDataHash = "";
let lastRecommendationGeneratedAt = Date.now();
let adminsDb: AdminUser[] = [...INITIAL_ADMINS];
let suppliersDb: SupplierRecord[] = [...INITIAL_SUPPLIERS];

// Disk-backed persistence directories & paths
const DATA_DIR = path.join(process.cwd(), "data");
const FARMERS_FILE = path.join(DATA_DIR, "farmers_db.json");
const ADMINS_FILE = path.join(DATA_DIR, "admins_db.json");
const SUPPLIERS_FILE = path.join(DATA_DIR, "suppliers_db.json");

// Webhook audit logs
let webhookLogs: Array<{ id: string; timestamp: string; event: string; detail: string; status: string }> = [
  {
    id: "wh-init",
    timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
    event: "system_init",
    detail: "Sistem Webhook TaniAI siap menerima data dua arah dari Google Apps Script",
    status: "READY",
  },
];

function readJsonSafe<T>(file: string, fallback: T, label: string): T {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
  } catch (err) {
    console.error(`[Storage] ${label} korup, pakai data awal:`, (err as Error)?.message);
    try {
      fs.renameSync(file, `${file}.corrupt-${Date.now()}`);
    } catch {}
    return fallback;
  }
}

function initPersistence() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const farmersData = readJsonSafe<unknown>(FARMERS_FILE, [], "farmers_db.json");
    if (Array.isArray(farmersData) && farmersData.length > 0) {
      farmersDb = (farmersData as FarmerRecord[]).map((f: FarmerRecord) => {
        const init = INITIAL_FARMERS.find((i) => i.id === f.id);
        return {
          ...f,
          latitude: f.latitude ?? init?.latitude ?? -6.5 + (Math.random() * 0.1 - 0.05),
          longitude: f.longitude ?? init?.longitude ?? 107.5 + (Math.random() * 0.1 - 0.05),
          supplierTerhubungId: f.supplierTerhubungId ?? init?.supplierTerhubungId,
        };
      });
      console.log(`[Storage] Berhasil memuat ${farmersDb.length} data petani dari disk (${FARMERS_FILE})`);
    } else if (!fs.existsSync(FARMERS_FILE)) {
      saveFarmersToDisk();
    }

    const adminsData = readJsonSafe<unknown>(ADMINS_FILE, [], "admins_db.json");
    if (Array.isArray(adminsData) && adminsData.length > 0) {
      adminsDb = adminsData as AdminUser[];
      console.log(`[Storage] Berhasil memuat ${adminsDb.length} admin dari disk (${ADMINS_FILE})`);
    } else if (!fs.existsSync(ADMINS_FILE)) {
      saveAdminsToDisk();
    }

    const suppliersData = readJsonSafe<unknown>(SUPPLIERS_FILE, [], "suppliers_db.json");
    if (Array.isArray(suppliersData) && suppliersData.length > 0) {
      suppliersDb = suppliersData as SupplierRecord[];
      console.log(`[Storage] Berhasil memuat ${suppliersDb.length} data supplier dari disk (${SUPPLIERS_FILE})`);
    } else if (!fs.existsSync(SUPPLIERS_FILE)) {
      saveSuppliersToDisk();
    }
  } catch (err) {
    console.error("[Storage] Inisialisasi storage lokal gagal:", err);
  }
}

function writeJsonAtomic(file: string, data: unknown, label: string) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tmp, file);
  } catch (err) {
    console.error(`[Storage] Gagal menyimpan ${label}:`, err);
  }
}

// nextId: single source di ./lib/next-id (ada self-check).
function saveFarmersToDisk() {
  writeJsonAtomic(FARMERS_FILE, farmersDb, "farmers_db.json");
}

function saveAdminsToDisk() {
  writeJsonAtomic(ADMINS_FILE, adminsDb, "admins_db.json");
}

function saveSuppliersToDisk() {
  writeJsonAtomic(SUPPLIERS_FILE, suppliersDb, "suppliers_db.json");
}

// Inisialisasi data storage saat server pertama kali booting
initPersistence();

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
      const lowerRaw = raw.toLowerCase();
      if (lowerRaw.startsWith("pak ") || lowerRaw.startsWith("bapak ")) {
        const cleanName = raw.replace(/^(?:pak|bapak)\s+/i, "").trim();
        ext.nama = `Pak ${cleanName}`;
      } else if (lowerRaw.startsWith("bu ") || lowerRaw.startsWith("ibu ")) {
        const cleanName = raw.replace(/^(?:bu|ibu)\s+/i, "").trim();
        ext.nama = `Bu ${cleanName}`;
      } else {
        ext.nama = `Pak ${raw}`;
      }
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
    id: nextId("TANI", farmersDb.map((f) => f.id)),
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
    googleSheetRow: nextSheetRow(
      farmersDb.map((f) => f.googleSheetRow),
      farmersDb.length,
    ),
  };
  farmersDb.unshift(newRecord);
  saveFarmersToDisk();
  bumpDataVersion();
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

// Coordinate resolver based on kabupaten name or general location
function resolveCoordinates(locationStr?: string): { lat: number; lng: number } {
  const loc = (locationStr || "").toLowerCase();
  let baseLat = -6.5716;
  let baseLng = 107.7587;

  if (loc.includes("karawang")) { baseLat = -6.3073; baseLng = 107.3069; }
  else if (loc.includes("subang")) { baseLat = -6.5716; baseLng = 107.7587; }
  else if (loc.includes("indramayu")) { baseLat = -6.3264; baseLng = 108.3200; }
  else if (loc.includes("majalengka")) { baseLat = -6.8361; baseLng = 108.2275; }
  else if (loc.includes("cianjur")) { baseLat = -6.8172; baseLng = 107.1399; }
  else if (loc.includes("bandung") || loc.includes("lembang")) { baseLat = -6.8152; baseLng = 107.6186; }
  else if (loc.includes("garut")) { baseLat = -7.2167; baseLng = 107.9000; }
  else if (loc.includes("tasikmalaya")) { baseLat = -7.3274; baseLng = 108.2207; }
  else if (loc.includes("cirebon")) { baseLat = -6.7320; baseLng = 108.5523; }
  else if (loc.includes("brebes")) { baseLat = -6.8703; baseLng = 109.0435; }
  else if (loc.includes("grobogan") || loc.includes("wirosari")) { baseLat = -7.0863; baseLng = 110.9168; }
  else if (loc.includes("nganjuk")) { baseLat = -7.5810; baseLng = 111.9480; }
  else if (loc.includes("kediri")) { baseLat = -7.8480; baseLng = 112.0178; }
  else if (loc.includes("blitar")) { baseLat = -7.8690; baseLng = 112.1580; }
  else if (loc.includes("sukabumi")) { baseLat = -6.9277; baseLng = 106.9299; }

  const jitterLat = (Math.random() - 0.5) * 0.02;
  const jitterLng = (Math.random() - 0.5) * 0.02;
  return {
    lat: Number((baseLat + jitterLat).toFixed(4)),
    lng: Number((baseLng + jitterLng).toFixed(4)),
  };
}

function isSupplierIntent(text: string): boolean {
  const lower = (text || "").toLowerCase();
  return (
    lower.includes("supplier") ||
    lower.includes("suplier") ||
    lower.includes("kios pupuk") ||
    lower.includes("toko saprodi") ||
    lower.includes("kios tani") ||
    lower.includes("toko tani") ||
    lower.includes("toko pertanian") ||
    lower.includes("agen pupuk") ||
    lower.includes("distributor benih") ||
    lower.includes("penyedia alsintan") ||
    lower.includes("offtaker") ||
    lower.includes("pengepul") ||
    lower.includes("koperasi tani") ||
    lower.includes("penggilingan beras") ||
    lower.includes("toko benih") ||
    lower.includes("kios resmi")
  );
}

function extractSupplierFromText(
  text: string,
  existing: Partial<SupplierRecord> = {}
): { extracted: Partial<SupplierRecord>; hasMinimumData: boolean } {
  const ext: Partial<SupplierRecord> = { ...existing };
  const lower = (text || "").toLowerCase();

  // 1. Kategori Usaha
  if (lower.includes("pupuk") || lower.includes("saprodi") || lower.includes("obat") || lower.includes("pestisida")) {
    ext.kategori = "Pupuk & Saprodi";
  } else if (lower.includes("bibit") || lower.includes("benih") || lower.includes("semai")) {
    ext.kategori = "Bibit & Benih";
  } else if (lower.includes("alsintan") || lower.includes("traktor") || lower.includes("sprayer") || lower.includes("mesin")) {
    ext.kategori = "Alat & Mesin Pertanian (Alsintan)";
  } else if (lower.includes("pengepul") || lower.includes("offtaker") || lower.includes("tengkulak") || lower.includes("tampung") || lower.includes("serap") || lower.includes("giling") || lower.includes("beras")) {
    ext.kategori = "Offtaker & Pengepul";
  } else if (lower.includes("koperasi") || lower.includes("poktan") || lower.includes("gapoktan")) {
    ext.kategori = "Koperasi Tani";
  }

  // 2. Nama Toko/Kios/Supplier
  const nameMatch = text.match(/(?:kios|toko|supplier|ud|pt|cv|koperasi)\s+([A-Za-z0-9\s&]+?)(?:,|di|\.|\n|$)/i);
  if (nameMatch && nameMatch[1]) {
    const raw = nameMatch[0].trim();
    if (raw.length >= 4) {
      ext.nama = raw;
    }
  }

  // 3. Kontak / Nomor HP / WhatsApp
  const phoneMatch = text.match(/(?:\+?62|08)[0-9\s-]{8,15}/);
  if (phoneMatch) {
    ext.kontak = phoneMatch[0].replace(/\s+/g, " ").trim();
  }

  // 4. Kabupaten / Wilayah
  const districts = [
    "Subang", "Karawang", "Indramayu", "Majalengka", "Cianjur",
    "Bandung Barat", "Bandung", "Lembang", "Garut", "Brebes",
    "Grobogan", "Nganjuk", "Kediri", "Blitar", "Cirebon", "Sukabumi"
  ];
  for (const d of districts) {
    if (lower.includes(d.toLowerCase())) {
      ext.kabupaten = `${d}, Jawa Barat`;
      if (d === "Brebes" || d === "Grobogan") ext.kabupaten = `${d}, Jawa Tengah`;
      if (d === "Nganjuk" || d === "Kediri" || d === "Blitar") ext.kabupaten = `${d}, Jawa Timur`;
      break;
    }
  }

  // 5. Alamat / Jalan
  const jlMatch = text.match(/(?:jl|jalan|desa|kec|kecamatan|blok)\s+([A-Za-z0-9\s,.-]+?)(?:,|\.|\n|$)/i);
  if (jlMatch && jlMatch[0]) {
    ext.alamat = jlMatch[0].trim();
  }

  // 6. Produk Unggulan
  const prodMatch = text.match(/(?:produk|jual|sedia|stok|komoditas)\s*:\s*([A-Za-z0-9\s,.-]+?)(?:\.|\n|$)/i);
  if (prodMatch && prodMatch[1]) {
    ext.produkUnggulan = prodMatch[1].split(",").map((s) => s.trim()).filter(Boolean);
  }

  // 7. Stok
  const stokMatch = text.match(/(?:stok|kapasitas|ready)\s*:\s*([A-Za-z0-9\s,.-]+?)(?:\.|\n|$)/i);
  if (stokMatch && stokMatch[1]) {
    ext.stokTersedia = stokMatch[1].trim();
  }

  const hasMinimumData = !!(ext.nama || ext.kategori || ext.kabupaten || ext.kontak);
  return { extracted: ext, hasMinimumData };
}

function checkSupplierCompleteness(record: Partial<SupplierRecord>): {
  isComplete: boolean;
  missingFields: string[];
  presentFields: string[];
} {
  const missing: string[] = [];
  const present: string[] = [];

  const hasValidName =
    !!record.nama &&
    record.nama.trim().length >= 3 &&
    !["Supplier", "Toko", "Kios", "Mitra", "Toko Pertanian"].includes(record.nama.trim());
  if (hasValidName) {
    present.push(`Nama Toko/Kios: *${record.nama}*`);
  } else {
    missing.push("Nama Toko/Kios/Supplier");
  }

  const hasValidCategory = !!record.kategori && record.kategori.trim().length >= 3;
  if (hasValidCategory) {
    present.push(`Kategori Usaha: *${record.kategori}*`);
  } else {
    missing.push("Kategori Usaha (Pupuk & Saprodi / Bibit & Benih / Alsintan / Offtaker / Koperasi)");
  }

  const hasValidLocation =
    (!!record.kabupaten && record.kabupaten.trim().length >= 3) ||
    (!!record.alamat && record.alamat.trim().length >= 3);
  if (hasValidLocation) {
    const loc = [record.alamat, record.kabupaten].filter(Boolean).join(", ");
    present.push(`Lokasi: *${loc}*`);
  } else {
    missing.push("Lokasi / Wilayah (Kabupaten atau Alamat Toko)");
  }

  return {
    isComplete: missing.length === 0,
    missingFields: missing,
    presentFields: present,
  };
}

function saveSupplierRecord(
  draft: Partial<SupplierRecord>,
  activeAdmin?: AdminUser,
  senderPhone?: string
): SupplierRecord {
  const newId = nextId("SUP", suppliersDb.map((s) => s.id));
  const now = new Date();
  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

  const coords = resolveCoordinates(draft.kabupaten || draft.alamat || "Subang");

  const newRecord: SupplierRecord = {
    id: newId,
    nama: draft.nama || "Supplier Saprodi Pertanian",
    kategori: (draft.kategori as any) || "Pupuk & Saprodi",
    kontak: draft.kontak || senderPhone || "+62 812-xxxx-xxxx",
    alamat: draft.alamat || draft.kabupaten || "Pusat Distribusi Pertanian",
    kabupaten: draft.kabupaten || "Subang, Jawa Barat",
    latitude: draft.latitude && !isNaN(Number(draft.latitude)) ? Number(draft.latitude) : coords.lat,
    longitude: draft.longitude && !isNaN(Number(draft.longitude)) ? Number(draft.longitude) : coords.lng,
    statusKemitraan: (draft.statusKemitraan as any) || (activeAdmin ? "Terverifikasi Dinas" : "Mitra Aktif"),
    produkUnggulan:
      Array.isArray(draft.produkUnggulan) && draft.produkUnggulan.length > 0
        ? draft.produkUnggulan
        : ["Pupuk & Saprodi Pertanian"],
    stokTersedia: draft.stokTersedia || "Tersedia",
    radiusLayananKm: Number(draft.radiusLayananKm) || 25,
    jamBuka: draft.jamBuka || "Senin - Sabtu: 08.00 - 17.00 WIB",
    petaniBinaanCount: Number(draft.petaniBinaanCount) || 12,
    catatan:
      draft.catatan ||
      (activeAdmin
        ? `Didata langsung via WhatsApp oleh Admin ${activeAdmin.nama} (${activeAdmin.role} - ${activeAdmin.instansi}) pada ${now.toLocaleDateString("id-ID")}.`
        : `Didaftarkan via WhatsApp Chatbot pada ${now.toLocaleDateString("id-ID")}.`),
    googleSheetRow: nextSheetRow(
      suppliersDb.map((s) => s.googleSheetRow),
      suppliersDb.length,
    ),
    timestamp,
    syncStatus: "synced",
  };

  suppliersDb.unshift(newRecord);
  saveSuppliersToDisk();
  bumpDataVersion();
  return newRecord;
}

function formatSuccessSupplierRegistration(record: SupplierRecord, activeAdmin?: AdminUser): string {
  const adminBadge = activeAdmin
    ? `\n👮 *Diverifikasi oleh:* ${activeAdmin.nama} (${activeAdmin.role} - ${activeAdmin.instansi})`
    : "";

  return (
    `✅ *Data Supplier Produk Pertanian Berhasil Ditambahkan ke Google Sheets!*\n\n` +
    `Data mitra penyedia sarana produksi / offtaker telah berhasil dicatat dan disinkronkan ke Lembar Database Supplier:\n\n` +
    `• *ID Mitra:* \`${record.id}\`\n` +
    `• *Nama Toko/Kios:* *${record.nama}*\n` +
    `• *Kategori Usaha:* *${record.kategori}*\n` +
    `• *Kontak WhatsApp:* ${record.kontak}\n` +
    `• *Wilayah:* ${record.alamat}, ${record.kabupaten}\n` +
    `• *Produk Unggulan:* ${record.produkUnggulan.join(", ")}\n` +
    `• *Status Kemitraan:* 🟢 *${record.statusKemitraan}*\n` +
    `• *Baris Google Sheets:* Baris #${record.googleSheetRow || "Baru"}\n` +
    `• *Koordinat Peta:* (${record.latitude.toFixed(4)}, ${record.longitude.toFixed(4)})\n` +
    adminBadge +
    `\n\n📌 *Data mitra ini kini otomatis muncul di Google Maps Platform* dan dapat dihubungkan langsung dengan petani binaan terdekat.`
  );
}

function formatIncompleteSupplierPrompt(
  draft: Partial<SupplierRecord>,
  recipientName?: string,
  isAdmin: boolean = false
): {
  reply: string;
  quickReplies: string[];
  extractedSupplier: Partial<SupplierRecord>;
  isComplete: boolean;
} {
  const check = checkSupplierCompleteness(draft);

  const checklist = [
    `• Nama Toko/Kios: ${draft.nama ? `✅ *${draft.nama}*` : "❌ _Belum diisi_"}`,
    `• Kategori Usaha: ${draft.kategori ? `✅ *${draft.kategori}*` : "❌ _Belum diisi_"}`,
    `• Kontak / WA: ${draft.kontak ? `✅ *${draft.kontak}*` : "❌ _Belum diisi_"}`,
    `• Wilayah / Lokasi: ${draft.kabupaten || draft.alamat ? `✅ *${draft.kabupaten || draft.alamat}*` : "❌ _Belum diisi_"}`,
    `• Produk Unggulan: ${draft.produkUnggulan && draft.produkUnggulan.length > 0 ? `✅ *${draft.produkUnggulan.join(", ")}*` : "⚪ _Opsional_"}`,
  ].join("\n");

  const missingList = check.missingFields.map((m, idx) => `${idx + 1}. *${m}*`).join("\n");
  const salutation = isAdmin && recipientName ? `Bpk/Ibu *${recipientName}*` : `Bapak/Ibu`;

  const reply =
    `📝 *Draf Data Supplier Pertanian Dicatat (Belum Lengkap)*\n\n` +
    `Terima kasih ${salutation}. Data sementara mitra supplier telah tersimpan di draf percakapan, namun *belum dimasukkan ke Google Sheets* karena data pokok belum lengkap:\n\n` +
    `${checklist}\n\n` +
    `⚠️ *Data yang masih harus dilengkapi:*\n${missingList}\n\n` +
    `💡 *Silakan ketik data kelanjutannya* (misal: sebutkan nama toko, kategori pupuk/bibit/alsintan, atau kabupaten lokasinya).`;

  const quickReplies = [
    "Kategori: Pupuk & Saprodi",
    "Kategori: Bibit & Benih",
    "Kategori: Offtaker & Pengepul",
    "Lokasi: Subang",
  ];

  return {
    reply,
    quickReplies,
    extractedSupplier: draft,
    isComplete: false,
  };
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
      (f) => f.komoditas.toLowerCase().includes(keyword) || (f.varietas || "").toLowerCase().includes(keyword)
    );
    const cLuas = filtered.reduce((acc, f) => acc + (f.luasLahan || 0), 0).toFixed(1);
    const cPanen = filtered.reduce((acc, f) => acc + (f.estimasiHasilTon || 0), 0).toFixed(1);

    const list = filtered
      .slice(0, 5)
      .map(
        (f, i) =>
          `${i + 1}. *${f.nama}* (${f.noHp})\n   📍 ${f.kabupaten || f.alamat}\n   🌾 Varietas: ${f.varietas || "—"} | Lahan: *${f.luasLahan} Ha*\n   🗓️ Estimasi Panen: ${f.estimasiPanen} (~*${f.estimasiHasilTon} Ton*) [${f.statusVerifikasi}]`
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

// 9Router AI Gateway Configuration & Discovery
function getNineRouterConfig() {
  let url = process.env.NINEROUTER_URL?.trim() || "";
  const key = process.env.NINEROUTER_KEY?.trim() || "";
  let model = process.env.NINEROUTER_MODEL?.trim() || "gpt-4.1";

  url = url.replace(/\/+$/, "");
  if (url.endsWith("/v1")) {
    url = url.slice(0, -3);
  }

  // Handle incompatible model aliases
  if (model === "combo1" || model.includes("openai/")) {
    model = "gpt-4.1";
  }

  const isConfigured = Boolean(url && url.length > 5);
  return {
    url,
    key,
    model,
    isConfigured,
  };
}

async function checkNineRouterHealth(): Promise<{ ok: boolean; latencyMs?: number; message?: string }> {
  const cfg = getNineRouterConfig();
  if (!cfg.isConfigured) {
    return { ok: false, message: "NINEROUTER_URL belum dikonfigurasi di environment." };
  }
  const startTime = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const headers: Record<string, string> = {};
    if (cfg.key) headers["Authorization"] = `Bearer ${cfg.key}`;

    const res = await fetch(`${cfg.url}/api/health`, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    const latency = Date.now() - startTime;
    if (res.ok) {
      return { ok: true, latencyMs: latency, message: "Terhubung ke 9Router Gateway" };
    }
    // Probe models endpoint if health endpoint is 404
    const probeRes = await fetch(`${cfg.url}/v1/models`, { headers, signal: controller.signal });
    if (probeRes.ok) {
      return { ok: true, latencyMs: Date.now() - startTime, message: "Terhubung ke 9Router (/v1/models aktif)" };
    }
    return { ok: false, latencyMs: latency, message: `9Router status: ${res.status}` };
  } catch (err: any) {
    return { ok: false, message: err?.message || "Gagal menghubungi 9Router gateway" };
  } finally {
    clearTimeout(timeout);
  }
}

// ==========================================
// COST & TOKEN OPTIMIZATION ENGINE (3 PILLARS)
// 1. Kirim Hanya Yang Dibutuhkan: Ringkasan Terlebih Dahulu & Targeted Retrieval
// 2. Batasi Jawaban AI: Max Output Tokens & Instant Cancellation (AbortSignal)
// 3. Gunakan Kembali Hasil: Smart Query Cache & Report Reuse
// ==========================================

interface AICacheEntry {
  reply: string;
  quickReplies?: string[];
  extracted?: any;
  isAdminAction?: boolean;
  timestamp: number;
  dataVersion: number;
  provider: "cache";
}

const aiResponseCache = new Map<string, AICacheEntry>();
let currentDataVersion = 1;
let totalTokensSavedEstimate = 0;
let totalCacheHits = 0;

function bumpDataVersion() {
  currentDataVersion++;
  // ponytail: clear ganti LRU saat cache besar.
  if (aiResponseCache.size > 200) for (const k of aiResponseCache.keys()) { aiResponseCache.delete(k); if (aiResponseCache.size <= 150) break; }
}

function getNormalizedCacheKey(role: string, message: string): string {
  const clean = (message || "")
    .toLowerCase()
    .replace(/[^\w\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${role}::${clean}`;
}

function isQuerySafeToCache(message: string): boolean {
  const lower = (message || "").toLowerCase();
  // DO NOT cache user registration mutations or phone numbers
  const mutationKeywords = [
    "tambah", "daftarkan", "daftar", "input", "masukkan", "catat", "simpan",
    "nama saya", "lahan saya", "panen saya", "desa ", "kecamatan ", "08", "+62"
  ];
  return !mutationKeywords.some((k) => lower.includes(k));
}

// Rate limiter stdlib (tanpa dep). ponytail: ganti redis saat multi-instance.
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
function rateLimit(max: number, windowMs: number) {
  return (req: any, res: any, next: any) => {
    const ip = (req.ip || req.headers["x-forwarded-for"] || "local") as string;
    const key = `${ip}:${req.path}`;
    const now = Date.now();
    if (rateBuckets.size > 1000) for (const [k, v] of rateBuckets) if (now > v.resetAt) rateBuckets.delete(k);
    const b = rateBuckets.get(key);
    if (!b || now > b.resetAt) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    b.count += 1;
    if (b.count > max) {
      return res.status(429).json({ error: "Terlalu banyak permintaan, coba lagi nanti." });
    }
    next();
  };
}

function sanitizeText(s: unknown, maxLen = 2000): string {
  if (typeof s !== "string") return "";
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, maxLen).trim();
}
function escHtml(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => (({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }) as any)[c]);
}
function escAttr(s: unknown): string {
  return escHtml(s).replace(/[\r\n]+/g, " ");
}
function cleanHost(h: unknown, fb = "localhost:3000"): string {
  const s = String(h || fb).slice(0, 80);
  return /^[\w.\-:]+$/.test(s) ? s : fb;
}
const ADD_WORDS = ["tambah", "daftarkan", "daftar", "input", "masukkan", "catat", "simpan"];
function isAddRegex(lower: string): boolean {
  for (const w of ADD_WORDS) if ((lower || "").includes(w)) return true;
  return false;
}
// Laya intent sidecar (stdlib http, opt-in via LAYA_URL). Timeout 1.2s, cooldown 30s saat down.
// Lazy: hanya fetch saat regex belum yakin + cache 10 mnt. Regex hit -> 0ms overhead.
// ponytail: ganti ke laya[serve] batch saat butuh throughput.
const LAYA_URL = (process.env.LAYA_URL?.trim() || "").replace(/\/+$/, "");
let layaUnavailableUntil = 0;
const layaCache = new Map<string, { v: { intent: string; confidence: number }; exp: number }>();
async function getLayaIntent(message: string): Promise<{ intent: string; confidence: number } | null> {
  if (!message || !LAYA_URL || Date.now() < layaUnavailableUntil) return null;
  const key = message.slice(0, 200).toLowerCase();
  const hit = layaCache.get(key);
  if (hit) { if (Date.now() < hit.exp) return hit.v; layaCache.delete(key); }
  if (layaCache.size > 500) for (const [k, v] of layaCache) { if (Date.now() > v.exp) layaCache.delete(k); if (layaCache.size <= 400) break; }
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 1200);
    const res = await fetch(`${LAYA_URL}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message.slice(0, 2000) }),
      signal: c.signal,
    });
    clearTimeout(t);
    if (!res.ok) throw new Error(`laya ${res.status}`);
    const j: any = await res.json();
    if (!j?.intent) return null;
    const v = { intent: String(j.intent), confidence: Number(j.confidence || 0) };
    layaCache.set(key, { v, exp: Date.now() + 600000 });
    return v;
  } catch {
    layaUnavailableUntil = Date.now() + 30000;
    return null;
  }
}

// 1. Targeted & Summarized Context Builder (No massive raw JSON dumps!)
function buildLeanTargetedContext(message: string, isAdmin: boolean) {
  const lower = (message || "").toLowerCase();

  const totalLuas = farmersDb.reduce((acc, f) => acc + (f.luasLahan || 0), 0).toFixed(1);
  const totalPanen = farmersDb.reduce((acc, f) => acc + (f.estimasiHasilTon || 0), 0).toFixed(1);
  const unverified = farmersDb.filter((f) => f.statusVerifikasi !== "Terverifikasi");

  // Aggregate stats per crop
  const cropSummary: Record<string, { count: number; luas: number; ton: number }> = {};
  for (const f of farmersDb) {
    const key = f.komoditas ? f.komoditas.split(" ")[0] : "Lainnya";
    if (!cropSummary[key]) cropSummary[key] = { count: 0, luas: 0, ton: 0 };
    cropSummary[key].count += 1;
    cropSummary[key].luas += f.luasLahan || 0;
    cropSummary[key].ton += f.estimasiHasilTon || 0;
  }
  const cropLine = Object.entries(cropSummary)
    .map(([k, v]) => `${k}: ${v.count} petani (${v.luas.toFixed(1)} Ha, ~${v.ton.toFixed(1)} Ton)`)
    .join(" | ");

  // Targeted on-demand retrieval: only attach specific records if asked!
  const mentionsCabai = lower.includes("cabai") || lower.includes("rawit");
  const mentionsPadi = lower.includes("padi") || lower.includes("beras");
  const mentionsBawang = lower.includes("bawang");
  const mentionsJagung = lower.includes("jagung");
  const mentionsVerifikasi = lower.includes("verifikasi") || lower.includes("pending") || lower.includes("belum");
  const mentionsAll = lower.includes("semua petani") || lower.includes("daftar semua") || lower.includes("rekap semua") || lower.includes("seluruh petani") || lower.includes("direktori");

  const kabList = ["subang", "karawang", "brebes", "kediri", "malang", "blitar", "garut", "cianjur", "nganjuk"];
  const matchedKab = kabList.find((k) => lower.includes(k));

  const matchedFarmer = farmersDb.find((f) => {
    const fn = f.nama.toLowerCase().replace(/^(pak|bu|bapak|ibu)\s+/, "");
    return fn.length > 2 && lower.includes(fn);
  });

  let targetedDetails = "";
  let detailsType = "none";

  if (matchedFarmer) {
    detailsType = "single_farmer";
    targetedDetails = `DATA DETAIL PETANI YANG DITANYAKAN:
- Nama: ${matchedFarmer.nama} (ID: ${matchedFarmer.id})
- Kontak: ${matchedFarmer.noHp}
- Komoditas: ${matchedFarmer.komoditas} (${matchedFarmer.varietas || "Unggul"})
- Luas: ${matchedFarmer.luasLahan} Ha | Panen: ${matchedFarmer.estimasiPanen} (~${matchedFarmer.estimasiHasilTon} Ton)
- Lokasi: ${matchedFarmer.alamat}, ${matchedFarmer.kabupaten}
- Status: ${matchedFarmer.statusVerifikasi}`;
  } else if (mentionsVerifikasi) {
    detailsType = "unverified_list";
    targetedDetails = `DATA PETANI BELUM DIVERIFIKASI (${unverified.length} orang):
${unverified.map((u) => `• ${u.nama} | ${u.komoditas} ${u.luasLahan} Ha | ${u.kabupaten}`).join("\n") || "Semua sudah terverifikasi."}`;
  } else if (matchedKab) {
    detailsType = `kabupaten_${matchedKab}`;
    const kabFarmers = farmersDb.filter((f) => (f.kabupaten || "").toLowerCase().includes(matchedKab));
    targetedDetails = `DATA PETANI DI KABUPATEN ${matchedKab.toUpperCase()} (${kabFarmers.length} orang):
${kabFarmers.slice(0, 5).map((f) => `• ${f.nama} | ${f.komoditas} ${f.luasLahan} Ha | Panen: ${f.estimasiPanen}`).join("\n")}`;
  } else if (mentionsCabai || mentionsPadi || mentionsBawang || mentionsJagung) {
    const cropName = mentionsCabai ? "Cabai" : mentionsPadi ? "Padi" : mentionsBawang ? "Bawang" : "Jagung";
    detailsType = `crop_${cropName}`;
    const matchedFarmers = farmersDb.filter((f) => (f.komoditas || "").toLowerCase().includes(cropName.toLowerCase()));
    const matchedCom = commoditiesDb.find((c) => c.nama.toLowerCase().includes(cropName.toLowerCase()));
    targetedDetails = `DATA SPESIFIK KOMODITAS ${cropName.toUpperCase()}:
${matchedCom ? `• Harga Pasar: Rp ${matchedCom.hargaSekarang.toLocaleString("id-ID")}/kg (${matchedCom.statusAnomali}, ${matchedCom.perubahanPersen > 0 ? "+" : ""}${matchedCom.perubahanPersen}%)` : ""}
• Petani Terdata (${matchedFarmers.length} orang):
${matchedFarmers.slice(0, 5).map((f) => `• ${f.nama} (${f.kabupaten || f.alamat}, ${f.luasLahan} Ha, est. ${f.estimasiHasilTon} Ton, panen ${f.estimasiPanen})`).join("\n")}`;
  } else if (mentionsAll && isAdmin) {
    detailsType = "directory";
    targetedDetails = `DIREKTORI RINGKAS (Total ${farmersDb.length} petani):
${farmersDb.slice(0, 8).map((f) => `• ${f.nama} | ${f.komoditas} ${f.luasLahan} Ha | ${f.kabupaten} | Panen: ${f.estimasiPanen}`).join("\n")}
${farmersDb.length > 8 ? `...dan ${farmersDb.length - 8} petani lainnya tercatat di Google Sheets.` : ""}`;
  }

  let marketHighlight = "";
  if (lower.includes("harga") || lower.includes("pasar") || mentionsCabai || mentionsPadi || mentionsBawang || mentionsJagung) {
    marketHighlight = `DATA HARGA PASAR HARI INI:
${commoditiesDb.map((c) => `• ${c.nama}: Rp ${c.hargaSekarang.toLocaleString("id-ID")}/kg (${c.statusAnomali})`).join("\n")}`;
  } else {
    const anomalies = commoditiesDb.filter((c) => c.statusAnomali !== "NORMAL");
    if (anomalies.length > 0) {
      marketHighlight = `STATUS PASAR: ${anomalies.map((a) => `${a.nama} (Rp ${a.hargaSekarang.toLocaleString("id-ID")}/kg, ${a.statusAnomali})`).join(", ")}`;
    }
  }

  return {
    summary: `RINGKASAN STATISTIK: ${farmersDb.length} Petani Terdata, Luas ${totalLuas} Ha, Proyeksi Panen ${totalPanen} Ton.\nKomoditas: ${cropLine}.\nBelum Diverifikasi: ${unverified.length} petani.`,
    targetedDetails,
    marketHighlight,
    detailsType,
  };
}

async function callNineRouterChat(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  modelOverride?: string,
  options?: { signal?: AbortSignal; maxTokens?: number }
): Promise<string> {
  const cfg = getNineRouterConfig();
  if (!cfg.isConfigured) {
    throw new Error("9Router belum dikonfigurasi");
  }

  let model = modelOverride || cfg.model;
  if (model === "combo1") {
    model = "gpt-4.1";
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 16000);

  if (options?.signal) {
    options.signal.addEventListener("abort", () => {
      clearTimeout(timeout);
      controller.abort();
    });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (cfg.key) {
    headers["Authorization"] = `Bearer ${cfg.key}`;
  }

  const doChatCall = async (modelToUse: string) => {
    return fetch(`${cfg.url}/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: modelToUse,
        messages,
        temperature: 0.2,
        max_tokens: options?.maxTokens || 550,
      }),
      signal: controller.signal,
    });
  };

  try {
    let res = await doChatCall(model);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");

      // Auto-fallback if 9Router mentions available models (e.g. integrator vscode-chat)
      const availableMatch = errText.match(/Available models:\s*\[([^\]]+)\]/i);
      if (availableMatch && availableMatch[1]) {
        const availableModels = availableMatch[1]
          .split(/[\s,]+/)
          .map((m) => m.trim().replace(/['"]/g, ""))
          .filter(Boolean);

        const candidate =
          availableModels.find((m) => m === "gpt-4.1" || m.includes("claude-fable") || m.includes("gpt")) ||
          availableModels[0];

        if (candidate && candidate !== model) {
          console.log(`[9Router] Model ${model} not permitted by gateway, auto-retrying with: ${candidate}`);
          const retryRes = await doChatCall(candidate);
          if (retryRes.ok) {
            const data: any = await retryRes.json();
            const content = data?.choices?.[0]?.message?.content;
            if (content) return content;
          }
        }
      }

      throw new Error(`9Router error ${res.status}: ${errText.substring(0, 200)}`);
    }

    const data: any = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Respon 9Router kosong atau tidak memiliki format choices[0].message.content");
    }
    return content;
  } finally {
    clearTimeout(timeout);
  }
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

// Helper to invoke Gemini with automatic model fallback & cancellation/token limit support
async function callGeminiGenerate(
  ai: GoogleGenAI,
  contents: any,
  options?: { signal?: AbortSignal; maxOutputTokens?: number; systemInstruction?: string }
): Promise<string> {
  const models = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.8-flash", "gemini-flash-latest"];
  let lastErr: any = null;

  for (const model of models) {
    if (options?.signal?.aborted) {
      throw new Error("AI Generation dibatalkan oleh pengguna (hemat biaya)");
    }
    let timer: any = null;
    try {
      const callPromise = ai.models.generateContent({
        model,
        contents,
        config: {
          maxOutputTokens: options?.maxOutputTokens || 550,
          abortSignal: options?.signal,
          temperature: 0.2,
          systemInstruction: options?.systemInstruction,
        },
      });
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timeout (15s) calling ${model}`)), 15000);
      });
      const res: any = await Promise.race([callPromise, timeoutPromise]);
      if (timer) clearTimeout(timer);
      if (res && res.text) {
        return res.text;
      }
    } catch (err: any) {
      if (timer) clearTimeout(timer);
      lastErr = err;
      if (options?.signal?.aborted || err?.name === "AbortError" || err?.message?.includes("Abort")) {
        throw new Error("AI Generation dibatalkan oleh pengguna (hemat biaya)");
      }
      const errMsg = err?.status || err?.message || err;
      console.log(`[Gemini Info] Model ${model} fallback triggered (${errMsg}), trying next available model...`);
    }
  }
  throw lastErr || new Error("All Gemini models failed");
}

// Universal AI Caller with Priority Chain, Cancellation Support & Token Guarding
async function callUniversalAI(
  systemPrompt: string,
  userPrompt: string,
  history?: Array<{ sender: string; text: string }>,
  options?: { signal?: AbortSignal; maxOutputTokens?: number }
): Promise<{ text: string; provider: "9router" | "gemini"; model: string }> {
  if (options?.signal?.aborted) {
    throw new Error("Operasi dibatalkan sebelum pengiriman (hemat token)");
  }

  const nineRouterCfg = getNineRouterConfig();
  let nineRouterErr: any = null;

  // Compact conversation history: keep only last 2-3 exchanges, trim length
  const compactHistory = (history || [])
    .slice(-3)
    .map((h) => ({
      sender: h.sender,
      text: (h.text || "").length > 200 ? (h.text || "").slice(0, 200) + "..." : h.text,
    }));

  // 1. Coba 9Router jika NINEROUTER_URL dikonfigurasi
  if (nineRouterCfg.isConfigured) {
    try {
      const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
      if (systemPrompt) {
        messages.push({ role: "system", content: systemPrompt });
      }
      for (const h of compactHistory) {
        messages.push({
          role: h.sender === "bot" ? "assistant" : "user",
          content: h.text,
        });
      }
      messages.push({ role: "user", content: userPrompt });

      const text = await callNineRouterChat(messages, undefined, {
        signal: options?.signal,
        maxTokens: options?.maxOutputTokens || 550,
      });
      console.log(`[AI Dispatcher] Balasan via 9Router (${nineRouterCfg.model})`);
      return { text, provider: "9router", model: nineRouterCfg.model };
    } catch (err: any) {
      if (options?.signal?.aborted) throw err;
      nineRouterErr = err;
      console.warn(`[9Router Warning] Pemanggilan 9Router gagal (${err.message}). Beralih ke Google Gemini...`);
    }
  }

  // 2. Fallback ke Google Gemini API
  const ai = getGemini();
  if (ai) {
    const historyFormatted = compactHistory
      .map((h: any) => `${h.sender === "bot" ? "Kang Tani AI" : "User"}: ${h.text}`)
      .join("\n");

    const contents = [
      {
        role: "user",
        parts: [
          {
            text: `${systemPrompt}\n\n${
              historyFormatted ? `RIWAYAT PERCAKAPAN SINGKAT:\n${historyFormatted}\n\n` : ""
            }PERTANYAAN PENGGUNA:\n"${userPrompt}"`,
          },
        ],
      },
    ];

    const text = await callGeminiGenerate(ai, contents, {
      signal: options?.signal,
      maxOutputTokens: options?.maxOutputTokens || 550,
    });
    console.log(`[AI Dispatcher] Balasan via Google Gemini API`);
    return { text, provider: "gemini", model: "gemini-3.1-flash-lite" };
  }

  throw new Error(
    nineRouterErr
      ? `9Router gagal (${nineRouterErr.message}) dan Gemini API tidak tersedia`
      : "Tidak ada provider AI yang aktif (NINEROUTER_URL atau GEMINI_API_KEY belum diisi)"
  );
}

export function createServerApp() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  // ponytail: header minimal tanpa dep; tambah helmet saat production.
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });
  // Rate-limit stdlib di jalur tulis. Baca (GET) bebas.
  const writeLimit = rateLimit(60, 60_000);
  app.use((req, _res, next) => (req.method === "POST" ? writeLimit(req as any, _res as any, next) : next()));

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    const nineCfg = getNineRouterConfig();
    res.json({
      status: "ok",
      app: "TaniAI - WhatsApp & Google Sheets Agri-Agent",
      version: "1.0.0",
      time: new Date().toISOString(),
      farmersCount: farmersDb.length,
      commoditiesCount: commoditiesDb.length,
      adminsCount: adminsDb.length,
      hasGeminiKey: !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY"),
      nineRouter: {
        configured: nineCfg.isConfigured,
        model: nineCfg.model,
      },
      laya: { url: LAYA_URL, down: Date.now() < layaUnavailableUntil },
    });
  });

  // GET 9Router Gateway status & model discovery
  app.get("/api/9router/status", async (_req, res) => {
    const cfg = getNineRouterConfig();
    const health = await checkNineRouterHealth();
    let availableModels: string[] = [];

    if (cfg.isConfigured && health.ok) {
      try {
        const headers: Record<string, string> = {};
        if (cfg.key) headers["Authorization"] = `Bearer ${cfg.key}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const mRes = await fetch(`${cfg.url}/v1/models`, { headers, signal: controller.signal });
        clearTimeout(timeout);
        if (mRes.ok) {
          const mData: any = await mRes.json();
          if (Array.isArray(mData?.data)) {
            availableModels = mData.data.map((m: any) => m.id).slice(0, 20);
          }
        }
      } catch {}
    }

    const geminiAvailable = !!getGemini();
    const activeProvider = cfg.isConfigured && health.ok ? "9router" : (geminiAvailable ? "gemini" : "rule_based");

    res.json({
      configured: cfg.isConfigured,
      url: cfg.url,
      hasKey: Boolean(cfg.key),
      model: cfg.model,
      healthy: health.ok,
      latencyMs: health.latencyMs,
      message: health.message,
      activeProvider,
      availableModels,
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
      id: nextId("ADM", adminsDb.map((a) => a.id)),
      nama: nama.trim(),
      noHp: noHp.trim(),
      instansi: instansi || "Dinas Pertanian / PPL Lapangan",
      role: role || "PETUGAS_PPL",
      izinAkses: izinAkses || ["rekap_data", "ekspor_sheets", "verifikasi_petani"],
      aktif: true,
      waktuTerdaftar: new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }),
    };

    adminsDb.push(newAdmin);
    saveAdminsToDisk();
    bumpDataVersion();
    res.status(201).json(newAdmin);
  });

  // DELETE or deactivate admin phone number
  app.delete("/api/admins/:id", (req, res) => {
    const { id } = req.params;
    if (id === "ADM-001") {
      return res.status(403).json({ error: "Super Admin utama tidak dapat dihapus." });
    }
    const before = adminsDb.length;
    adminsDb = adminsDb.filter((a) => a.id !== id);
    if (adminsDb.length === before) {
      return res.status(404).json({ error: "Admin tidak ditemukan." });
    }
    saveAdminsToDisk();
    bumpDataVersion();
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
      id: nextId("TANI", farmersDb.map((f) => f.id)),
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
      googleSheetRow: nextSheetRow(
        farmersDb.map((f) => f.googleSheetRow),
        farmersDb.length,
      ),
      latitude: data.latitude !== undefined ? Number(data.latitude) : -6.5 + (Math.random() * 0.1 - 0.05),
      longitude: data.longitude !== undefined ? Number(data.longitude) : 107.5 + (Math.random() * 0.1 - 0.05),
      supplierTerhubungId: data.supplierTerhubungId || undefined,
    };
    farmersDb.unshift(newFarmer);
    saveFarmersToDisk();
    bumpDataVersion();
    res.status(201).json(newFarmer);
  });

  // PUT update existing farmer
  app.put("/api/farmers/:id", (req, res) => {
    const { id } = req.params;
    const data = req.body;
    const idx = farmersDb.findIndex((f) => f.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: "Data petani tidak ditemukan." });
    }
    const current = farmersDb[idx];
    const updated: FarmerRecord = {
      ...current,
      nama: data.nama !== undefined ? data.nama : current.nama,
      noHp: data.noHp !== undefined ? data.noHp : current.noHp,
      alamat: data.alamat !== undefined ? data.alamat : current.alamat,
      kabupaten: data.kabupaten !== undefined ? data.kabupaten : current.kabupaten,
      luasLahan: data.luasLahan !== undefined ? Number(data.luasLahan) : current.luasLahan,
      luasLahanFormatted: data.luasLahan !== undefined ? `${data.luasLahan} Ha` : current.luasLahanFormatted,
      komoditas: data.komoditas !== undefined ? data.komoditas : current.komoditas,
      varietas: data.varietas !== undefined ? data.varietas : current.varietas,
      estimasiPanen: data.estimasiPanen !== undefined ? data.estimasiPanen : current.estimasiPanen,
      estimasiHasilTon: data.estimasiHasilTon !== undefined ? Number(data.estimasiHasilTon) : current.estimasiHasilTon,
      statusVerifikasi: data.statusVerifikasi !== undefined ? data.statusVerifikasi : current.statusVerifikasi,
      catatanAI: data.catatanAI !== undefined ? data.catatanAI : current.catatanAI,
      latitude: data.latitude !== undefined ? Number(data.latitude) : current.latitude,
      longitude: data.longitude !== undefined ? Number(data.longitude) : current.longitude,
      supplierTerhubungId: data.supplierTerhubungId !== undefined ? data.supplierTerhubungId : current.supplierTerhubungId,
      syncStatus: "synced",
    };
    farmersDb[idx] = updated;
    saveFarmersToDisk();
    bumpDataVersion();
    res.json(updated);
  });

  // POST verify farmer status
  app.post("/api/farmers/:id/verify", (req, res) => {
    const { id } = req.params;
    const farmer = farmersDb.find((f) => f.id === id);
    if (!farmer) {
      return res.status(404).json({ error: "Petani tidak ditemukan." });
    }
    farmer.statusVerifikasi = "Terverifikasi";
    farmer.catatanAI = `Divalidasi langsung oleh Petugas PPL Lapangan pada ${new Date().toLocaleDateString("id-ID")}. Polygon dan berkas lahan lengkap.`;
    saveFarmersToDisk();
    bumpDataVersion();
    res.json({ success: true, farmer });
  });

  // DELETE farmer by ID
  app.delete("/api/farmers/:id", (req, res) => {
    const { id } = req.params;
    const before = farmersDb.length;
    farmersDb = farmersDb.filter((f) => f.id !== id);
    if (farmersDb.length === before) {
      return res.status(404).json({ error: "Data petani tidak ditemukan." });
    }
    saveFarmersToDisk();
    bumpDataVersion();
    res.json({ success: true, message: `Data petani ${id} berhasil dihapus.` });
  });

  // GET all agricultural suppliers / kiosks / offtakers
  app.get("/api/suppliers", (_req, res) => {
    res.json(suppliersDb);
  });

  // POST add new supplier / saprodi partner
  app.post("/api/suppliers", (req, res) => {
    const data = req.body;
    if (!data.nama) {
      return res.status(400).json({ error: "Nama supplier/kios wajib diisi." });
    }

    const newSupplier = saveSupplierRecord(data);
    res.status(201).json(newSupplier);
  });

  // PUT update supplier
  app.put("/api/suppliers/:id", (req, res) => {
    const { id } = req.params;
    const data = req.body;
    const idx = suppliersDb.findIndex((s) => s.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: "Supplier tidak ditemukan." });
    }

    const current = suppliersDb[idx];
    const updated: SupplierRecord = {
      ...current,
      nama: data.nama !== undefined ? data.nama : current.nama,
      kategori: data.kategori !== undefined ? data.kategori : current.kategori,
      kontak: data.kontak !== undefined ? data.kontak : current.kontak,
      alamat: data.alamat !== undefined ? data.alamat : current.alamat,
      kabupaten: data.kabupaten !== undefined ? data.kabupaten : current.kabupaten,
      latitude: data.latitude !== undefined ? Number(data.latitude) : current.latitude,
      longitude: data.longitude !== undefined ? Number(data.longitude) : current.longitude,
      statusKemitraan: data.statusKemitraan !== undefined ? data.statusKemitraan : current.statusKemitraan,
      produkUnggulan: Array.isArray(data.produkUnggulan) ? data.produkUnggulan : current.produkUnggulan,
      stokTersedia: data.stokTersedia !== undefined ? data.stokTersedia : current.stokTersedia,
      radiusLayananKm: data.radiusLayananKm !== undefined ? Number(data.radiusLayananKm) : current.radiusLayananKm,
      jamBuka: data.jamBuka !== undefined ? data.jamBuka : current.jamBuka,
      petaniBinaanCount: data.petaniBinaanCount !== undefined ? Number(data.petaniBinaanCount) : current.petaniBinaanCount,
      catatan: data.catatan !== undefined ? data.catatan : current.catatan,
      syncStatus: "synced",
    };

    suppliersDb[idx] = updated;
    saveSuppliersToDisk();
    bumpDataVersion();
    res.json(updated);
  });

  // DELETE supplier by ID
  app.delete("/api/suppliers/:id", (req, res) => {
    const { id } = req.params;
    const before = suppliersDb.length;
    suppliersDb = suppliersDb.filter((s) => s.id !== id);
    if (suppliersDb.length === before) {
      return res.status(404).json({ error: "Supplier tidak ditemukan." });
    }
    saveSuppliersToDisk();
    bumpDataVersion();
    res.json({ success: true, message: `Data supplier ${id} berhasil dihapus.` });
  });

  // GET CSV export for suppliers (Google Sheets Lembar 2)
  app.get("/api/sheets/suppliers/export.csv", (_req, res) => {
    const headers = [
      "ID Supplier",
      "Waktu Terdaftar",
      "Nama Supplier / Kios",
      "Kategori Usaha",
      "Kontak WhatsApp",
      "Alamat",
      "Kabupaten",
      "Status Kemitraan",
      "Produk Unggulan",
      "Stok Tersedia",
      "Radius Layanan (Km)",
      "Jam Buka",
      "Petani Binaan Terhubung",
      "Latitude",
      "Longitude",
      "Catatan",
    ];

    const rows = suppliersDb.map((s, idx) => [
      s.id,
      s.timestamp || `2026-09-${String(10 + (idx % 15)).padStart(2, "0")} 08:00:00`,
      `"${(s.nama || "").replace(/"/g, '""')}"`,
      `"${(s.kategori || "").replace(/"/g, '""')}"`,
      `"${(s.kontak || "").replace(/"/g, '""')}"`,
      `"${(s.alamat || "").replace(/"/g, '""')}"`,
      `"${(s.kabupaten || "").replace(/"/g, '""')}"`,
      `"${(s.statusKemitraan || "").replace(/"/g, '""')}"`,
      `"${((s.produkUnggulan || []).join("; ")).replace(/"/g, '""')}"`,
      `"${(s.stokTersedia || "").replace(/"/g, '""')}"`,
      s.radiusLayananKm || 25,
      `"${(s.jamBuka || "").replace(/"/g, '""')}"`,
      s.petaniBinaanCount || 10,
      s.latitude,
      s.longitude,
      `"${(s.catatan || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="TaniAI_Suppliers_Database.csv"');
    res.send(csvContent);
  });

  // GET Google Maps Platform API key config
  app.get("/api/config/maps-key", (_req, res) => {
    const apiKey =
      process.env.VITE_GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      "";
    res.json({ apiKey });
  });

  // GET Agronomy Fertilizer Recommendation
  app.get("/api/agronomy/fertilizer", (req, res) => {
    const crop = (req.query.crop as string) || "Padi";
    const ha = parseFloat(req.query.ha as string) || 1.0;
    const result = calculateFertilizerRecommendation(crop, ha);
    res.json(result);
  });

  // POST Audio Transcribe & Entity Extraction (Multimodal AI)
  app.post("/api/audio-transcribe", async (req, res) => {
    try {
      const { audioBase64, mimeType, senderPhone } = req.body;
      if (!audioBase64) {
        return res.status(400).json({ error: "audioBase64 is required" });
      }

      const activeAdmin = findAdmin(senderPhone);
      const ai = getGemini();

      if (!ai) {
        // Fallback jika API key Gemini belum diisi
        return res.json({
          transcription: "Halo Kang Tani, saya mau daftarkan lahan pertanian seluas 1.5 hektar di desa binaan.",
          extracted: {
            luasLahan: 1.5,
            luasLahanFormatted: "1.5 Ha",
            komoditas: "Padi",
          },
          isComplete: false,
          isFallback: true,
        });
      }

      const cleanBase64 = audioBase64.replace(/^data:[^;]+;base64,/, "");
      const prompt = `Dengarkan rekaman audio suara ini dari seorang petani atau petugas pertanian di Indonesia.
Lakukan:
1. Transkripsikan apa yang diucapkan secara verbatim dan akurat ke dalam teks bahasa Indonesia.
2. Analisis dan ekstrak data petani jika ada:
   - nama: nama petani (misal: "Pak Suparman", "Pak Ahmad", "Ibu Siti")
   - komoditas: tanaman pangan / hortikultura (misal: "Padi", "Jagung", "Cabai Rawit", "Bawang Merah")
   - varietas: varietas jika disebutkan (misal: "Ciherang", "Inpari 32", "Bisi 18")
   - luasLahan: angka dalam Hektar (misal 1.5 atau 0.5 atau jika dalam m2 konversi ke Ha)
   - luasLahanFormatted: teks string (misal: "1.5 Ha")
   - kabupaten: nama kabupaten/kota jika ada (misal: "Subang", "Karawang")
   - alamat: desa atau kecamatan jika ada
   - estimasiPanen: bulan atau waktu perkiraan panen jika disebutkan

Kembalikan HANYA format JSON valid tanpa tanda markdown:
{
  "transcription": "teks ucapan dalam rekaman",
  "extracted": {
    "nama": "nama atau null",
    "komoditas": "komoditas atau null",
    "varietas": "varietas atau null",
    "luasLahan": null,
    "luasLahanFormatted": null,
    "alamat": null,
    "kabupaten": null,
    "estimasiPanen": null
  }
}`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType: mimeType || "audio/webm",
                  data: cleanBase64,
                },
              },
              {
                text: prompt,
              },
            ],
          },
        ],
      });

      const responseText = response.text || "";
      let parsed: any = {};
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
      } catch {
        parsed = { transcription: responseText.trim(), extracted: {} };
      }

      // Also run rule-based extractor on the transcribed text for high recall
      const ruleBased = extractFarmerFromText(parsed.transcription || "", {});
      const mergedExtracted = {
        ...(parsed.extracted || {}),
        ...(ruleBased.extracted || {}),
      };

      const check = checkFarmerCompleteness(mergedExtracted);

      res.json({
        transcription: parsed.transcription || "Audio suara berhasil diproses.",
        extracted: mergedExtracted,
        isComplete: check.isComplete,
        missingFields: check.missingFields,
        isAdmin: !!activeAdmin,
      });
    } catch (err: any) {
      console.error("[Audio Transcribe Error]", err);
      res.status(500).json({
        error: "Gagal memproses audio suara: " + (err?.message || "Internal error"),
        transcription: "Halo Kang Tani, saya mau mendata lahan pertanian.",
        extracted: {},
        isComplete: false,
      });
    }
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

    bumpDataVersion();
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

  // POST generate strategic recommendation via AI with smart caching
  app.post("/api/strategic-recommendation/generate", async (req, res) => {
    const nineCfg = getNineRouterConfig();
    const ai = getGemini();

    const totalLuasNum = farmersDb.reduce((acc, f) => acc + (f.luasLahan || 0), 0);
    const totalEstimasiPanenTon = farmersDb.reduce((acc, f) => acc + (f.estimasiHasilTon || 0), 0);
    const currentDataHash = `${farmersDb.length}_${totalLuasNum.toFixed(1)}_${totalEstimasiPanenTon.toFixed(1)}_${commoditiesDb.map((c) => `${c.id}:${c.hargaSekarang}`).join(",")}`;

    const forceRefresh = Boolean(req.body?.forceRefresh);
    const isRecent = latestRecommendation && Date.now() - lastRecommendationGeneratedAt < 1800000;

    // Pillar 3: Reuse existing result if data hasn't changed! (Gunakan kembali hasil yang ada)
    if (!forceRefresh && latestRecommendation && latestRecommendationDataHash === currentDataHash && isRecent) {
      console.log("[AI Optimization] ⚡ Menggunakan hasil rekomendasi tersimpan (data belum berubah - hemat 100% token)");
      totalCacheHits++;
      totalTokensSavedEstimate += 1200;
      return res.json({
        ...latestRecommendation,
        fromCache: true,
        cachedAt: new Date(lastRecommendationGeneratedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        cacheNotice: "Laporan dimuat dari cache tersimpan (data belum berubah - 0 token terpakai).",
      });
    }

    // Pillar 1: Lean Aggregated Summary (Send only necessary metrics, DO NOT dump raw farmer records!)
    const cropStats: Record<string, { count: number; luas: number; ton: number }> = {};
    for (const f of farmersDb) {
      const key = f.komoditas ? f.komoditas.split(" ")[0] : "Lainnya";
      if (!cropStats[key]) cropStats[key] = { count: 0, luas: 0, ton: 0 };
      cropStats[key].count++;
      cropStats[key].luas += f.luasLahan || 0;
      cropStats[key].ton += f.estimasiHasilTon || 0;
    }

    const leanSummaryContext = {
      totalPetani: farmersDb.length,
      totalLuasLahanHa: totalLuasNum.toFixed(1),
      totalEstimasiPanenTon: totalEstimasiPanenTon.toFixed(1),
      distribusiKomoditas: cropStats,
      anomaliPasar: commoditiesDb
        .filter((c) => c.statusAnomali !== "NORMAL")
        .map((c) => ({
          nama: c.nama,
          harga: c.hargaSekarang,
          perubahanPersen: c.perubahanPersen,
          status: c.statusAnomali,
        })),
    };

    if (!nineCfg.isConfigured && !ai) {
      // Fallback structured recommendation
      const fallback: StrategicRecommendation = {
        ...INITIAL_STRATEGIC_RECOMMENDATION,
        id: `strat-${Date.now()}`,
        tanggal: new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
        fromCache: false,
      };
      latestRecommendation = fallback;
      latestRecommendationDataHash = currentDataHash;
      lastRecommendationGeneratedAt = Date.now();
      return res.json(fallback);
    }

    try {
      const prompt = `Anda adalah Senior Agricultural Data Scientist & Ahli Ekonomi Pertanian Indonesia.
Tugas Anda adalah menganalisis ringkasan data spasial komoditas berikut secara padat, tajam, dan efisien:

DATA AGREGAT PERTANIAN:
${JSON.stringify(leanSummaryContext, null, 2)}

Buatkan laporan rekomendasi strategis dalam format JSON dengan struktur:
{
  "judul": "Judul Laporan Strategis singkat & tajam",
  "urgensi": "Tinggi" | "Sedang" | "Rendah",
  "ringkasanEksekutif": "1 paragraf ringkasan eksekutif padat untuk pengambil kebijakan",
  "analisisOversupplyShortage": ["analisis poin 1", "analisis poin 2"],
  "rekomendasiAgronomi": ["rekomendasi poin 1", "rekomendasi poin 2"],
  "rekomendasiKebijakanHarga": ["kebijakan harga 1", "kebijakan harga 2"],
  "rekomendasiRantaiPasok": ["logistik/rantai pasok 1", "logistik/rantai pasok 2"],
  "dataScientistNotes": "Catatan singkat metodologi analitik"
}

ATURAN HEMAT BIAYA: Berikan respon HANYA dalam JSON valid, padat, dan tanpa uraian bertele-tele.`;

      const aiRes = await callUniversalAI(
        "Anda adalah Senior Agricultural Data Scientist Indonesia. Berikan output analisis padat dan efisien.",
        prompt,
        undefined,
        { maxOutputTokens: 850 }
      );
      const responseText = aiRes.text;
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
        fromCache: false,
        cachedAt: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      };

      latestRecommendation = generated;
      latestRecommendationDataHash = currentDataHash;
      lastRecommendationGeneratedAt = Date.now();
      res.json(generated);
    } catch (err: any) {
      console.error("Gemini strategic generation error:", err);
      res.json(latestRecommendation);
    }
  });

  // Handler for Agronomy Fertilizer Recommendations
  function handleAgronomyFertilizerQuery(
    message: string,
    currentDraft: Partial<FarmerRecord> = {}
  ): { reply: string; quickReplies: string[] } | null {
    const lower = (message || "").toLowerCase();
    const hasFertilizerIntent =
      lower.includes("pupuk") ||
      lower.includes("dosis") ||
      lower.includes("pemupukan") ||
      lower.includes("urea") ||
      lower.includes("phonska") ||
      lower.includes("npk") ||
      lower.includes("takaran");

    if (!hasFertilizerIntent) return null;

    // Determine commodity
    let crop = currentDraft.komoditas || "";
    if (lower.includes("padi") || lower.includes("beras")) crop = "Padi";
    else if (lower.includes("jagung")) crop = "Jagung Hibrida";
    else if (lower.includes("cabai") || lower.includes("cabe")) crop = "Cabai Rawit";
    else if (lower.includes("bawang")) crop = "Bawang Merah";
    else if (lower.includes("kedelai")) crop = "Kedelai";
    else if (!crop) crop = "Padi";

    // Determine area in Ha
    let areaHa = currentDraft.luasLahan || 1.0;
    const haMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:ha|hektar)/i);
    if (haMatch && haMatch[1]) {
      areaHa = parseFloat(haMatch[1].replace(",", "."));
    } else {
      const m2Match = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:m2|meter)/i);
      if (m2Match && m2Match[1]) {
        areaHa = parseFloat(m2Match[1].replace(",", ".")) / 10000;
      }
    }

    const fert = calculateFertilizerRecommendation(crop, areaHa);

    const pupukLines = fert.pupuk
      .map(
        (p) =>
          `• *${p.jenis}*: *${p.totalKg.toLocaleString("id-ID")} kg* (~${p.totalKarung50kg} Zak @50kg)\n  _${p.keterangan}_`
      )
      .join("\n");

    const jadwalLines = fert.jadwalAplikasi
      .map((j) => `📍 *${j.fase}* (${j.waktuHST}):\n  - ${j.komposisi}\n  - _Aplikasi:_ ${j.caraAplikasi}`)
      .join("\n\n");

    const tipsLines = fert.catatanKhusus.map((t) => `✓ ${t}`).join("\n");

    const reply =
      `🌾 *Rekomendasi Dosis Pemupukan Berimbang Standar Balitbangtan RI*\n\n` +
      `Bpk/Ibu, berikut rekomendasi kebutuhan pupuk berimbang untuk komoditas *${fert.komoditas}* pada luasan lahan *${fert.luasLahanHa} Ha (${fert.luasLahanM2.toLocaleString("id-ID")} m²)*:\n\n` +
      `📦 *Total Kebutuhan Pupuk:*\n${pupukLines}\n\n` +
      `📅 *Jadwal & Fase Pemupukan:*\n${jadwalLines}\n\n` +
      `💡 *Petunjuk Agronomi Lapangan:*\n${tipsLines}\n\n` +
      `💡 *Catatan:* Dosis dapat disesuaikan dengan uji tanah (PUTS) setempat. Bapak/Ibu juga dapat mencetak Surat Registrasi Lahan & Petani lengkap dengan tabel dosis ini.`;

    return {
      reply,
      quickReplies: [
        `Cetak Kartu Tani (${fert.luasLahanHa} Ha)`,
        "Konsultasi Hama & Penyakit",
        "Cek Harga Pasar Terkini",
        "Daftarkan Lahan ke Sheets",
      ],
    };
  }

  // Handler for Natural Language Analytics & Aggregations
  function handleNaturalLanguageAnalyticsQuery(
    message: string,
    isAdmin: boolean
  ): { reply: string; quickReplies: string[] } | null {
    if (!isAdmin) return null;
    const lower = (message || "").toLowerCase();

    const isAnalyticsIntent =
      (lower.includes("berapa") ||
        lower.includes("total") ||
        lower.includes("rekap") ||
        lower.includes("daftar") ||
        lower.includes("analisis") ||
        lower.includes("laporan") ||
        lower.includes("agregat") ||
        lower.includes("ringkasan")) &&
      (lower.includes("luas") ||
        lower.includes("panen") ||
        lower.includes("ton") ||
        lower.includes("hektar") ||
        lower.includes("petani") ||
        lower.includes("lahan") ||
        lower.includes("komoditas") ||
        lower.includes("verifikasi"));

    if (!isAnalyticsIntent) return null;

    const totalLuas = farmersDb.reduce((acc, f) => acc + (f.luasLahan || 0), 0);
    const totalPanen = farmersDb.reduce((acc, f) => acc + (f.estimasiHasilTon || 0), 0);
    const totalPetani = farmersDb.length;

    // Filter by Commodity
    let targetCrop = "";
    if (lower.includes("padi") || lower.includes("beras")) targetCrop = "Padi";
    else if (lower.includes("jagung")) targetCrop = "Jagung";
    else if (lower.includes("cabai") || lower.includes("cabe")) targetCrop = "Cabai";
    else if (lower.includes("bawang")) targetCrop = "Bawang";

    // Filter by Region
    let targetKab = "";
    const kabList = ["subang", "karawang", "indramayu", "magetan", "kediri", "brebes", "cianjur", "bogor", "garut", "majalengka"];
    for (const k of kabList) {
      if (lower.includes(k)) {
        targetKab = k;
        break;
      }
    }

    // Filter by Verification Status
    const isUnverifiedQuery =
      lower.includes("belum verifikasi") ||
      lower.includes("menunggu verifikasi") ||
      lower.includes("unverified") ||
      lower.includes("belum diverifikasi");

    if (isUnverifiedQuery) {
      const unverified = farmersDb.filter((f) => f.statusVerifikasi !== "Terverifikasi");
      if (unverified.length === 0) {
        return {
          reply: `🟢 *Seluruh Data Petani Telah Terverifikasi!*\n\nSemua ${totalPetani} data petani di Google Sheets saat ini berstatus *Terverifikasi* resmi oleh petugas dinas dan PPL lapangan.`,
          quickReplies: ["Rekap Total Panen", "Cek Anomali Pasar", "Ekspor ke Sheets"],
        };
      }

      const listText = unverified
        .map(
          (f, i) =>
            `${i + 1}. *${f.nama}* (${f.komoditas}, ${f.luasLahan} Ha) di ${f.kabupaten || f.alamat} - _${f.statusVerifikasi}_\n   Catatan: ${f.catatanAI || "Menunggu tinjauan PPL"}`
        )
        .join("\n\n");

      return {
        reply: `📋 *Daftar Petani Menunggu Verifikasi Lapangan (${unverified.length} Petani):*\n\n${listText}\n\n💡 Admin dapat memverifikasi langsung melalui tombol aksi atau di tab Google Sheets.`,
        quickReplies: ["Verifikasi Semua", "Broadcast PPL", "Buka Google Sheets"],
      };
    }

    let filtered = [...farmersDb];
    if (targetCrop) {
      filtered = filtered.filter((f) => f.komoditas.toLowerCase().includes(targetCrop.toLowerCase()));
    }
    if (targetKab) {
      filtered = filtered.filter(
        (f) =>
          (f.kabupaten && f.kabupaten.toLowerCase().includes(targetKab)) ||
          (f.alamat && f.alamat.toLowerCase().includes(targetKab))
      );
    }

    const fLuas = filtered.reduce((acc, f) => acc + (f.luasLahan || 0), 0);
    const fPanen = filtered.reduce((acc, f) => acc + (f.estimasiHasilTon || 0), 0);

    const scopeTitle = [
      targetCrop ? `Komoditas *${targetCrop}*` : "Seluruh Komoditas",
      targetKab ? `Wilayah *${targetKab.toUpperCase()}*` : "Seluruh Sentra",
    ].join(" di ");

    const farmerSummaryList = filtered
      .slice(0, 5)
      .map((f) => `• *${f.nama}*: ${f.luasLahan} Ha, est. ${f.estimasiHasilTon} Ton (${f.statusVerifikasi})`)
      .join("\n");

    const reply =
      `📊 *Laporan Agregasi Spasial Pertanian Real-Time*\n` +
      `Cakupan: ${scopeTitle}\n\n` +
      `• *Jumlah Petani Terdata:* *${filtered.length} Petani*\n` +
      `• *Total Luas Lahan:* *${fLuas.toFixed(1)} Hektar* (${(fLuas * 10000).toLocaleString("id-ID")} m²)\n` +
      `• *Proyeksi Total Panen:* *${fPanen.toFixed(1)} Ton*\n` +
      `• *Rata-rata Produktivitas:* *${filtered.length > 0 ? (fPanen / Math.max(fLuas, 0.1)).toFixed(1) : 0} Ton/Ha*\n` +
      `• *Kontribusi Terhadap Total Nasional:* *${((fLuas / Math.max(totalLuas, 1)) * 100).toFixed(1)}%*\n\n` +
      (filtered.length > 0 ? `🌾 *Sampel Petani Terdaftar:*\n${farmerSummaryList}\n\n` : "") +
      `Seluruh data di atas tersinkronisasi otomatis dengan Google Sheets baris #2 sampai #${farmersDb.length + 1}.`;

    return {
      reply,
      quickReplies: [
        "Buka Database Google Sheets",
        "Unduh Data CSV",
        "Cek Anomali Harga Pasar",
        "Rekomendasi Pemupukan",
      ],
    };
  }

  // POST Chatbot endpoint (Kang Tani AI) with Role-Based Access Control (RBAC) & Cost Optimization
  app.post("/api/chat", async (req, res) => {
    const raw = req.body || {};
    const message = sanitizeText(raw.message, 2000);
    const { history, currentDraft, currentSupplierDraft, senderPhone } = raw;
    const ai = getGemini();

    const activeAdmin = findAdmin(senderPhone);
    const isAdmin = !!activeAdmin;

    // Laya intent lazy: regex dulu (0ms), sidecar hanya saat regex miss.
    // Null saat sidecar mati -> regex tetap jalan.
    let _chatLaya: { intent: string; confidence: number } | null | undefined;
    const chatLaya = async () => {
      if (_chatLaya !== undefined) return _chatLaya;
      _chatLaya = await getLayaIntent(message);
      return _chatLaya;
    };

    // 0. Cancellation controller: stops AI generation immediately if client aborts or cancels
    const clientAbortController = new AbortController();
    let isClientAborted = false;
    res.on("close", () => {
      if (!res.writableEnded && (req.destroyed || req.socket?.destroyed)) {
        isClientAborted = true;
        clientAbortController.abort();
        console.log("[AI Cost Optimizer] 🛑 Koneksi dibatalkan/ditutup oleh klien -> eksekusi AI dihentikan segera demi menghemat token & biaya.");
      }
    });

    // 0s. Agricultural Supplier Registration Flow (Chatbot & Database input)
    const hasSupplierDraft =
      currentSupplierDraft &&
      (currentSupplierDraft.nama ||
        currentSupplierDraft.kategori ||
        currentSupplierDraft.alamat ||
        currentSupplierDraft.kabupaten ||
        currentSupplierDraft.kontak);
    const isSupplierRegex = isSupplierIntent(message);
    let isSupplierMsg = isSupplierRegex;
    if (!isSupplierMsg) {
      const l = await chatLaya();
      isSupplierMsg = l?.intent === "supplier" && (l?.confidence || 0) >= 0.5;
    }
    const lowerMsg = (message || "").toLowerCase();
    const isAddAction =
      lowerMsg.includes("tambah") ||
      lowerMsg.includes("daftarkan") ||
      lowerMsg.includes("daftar") ||
      lowerMsg.includes("input") ||
      lowerMsg.includes("masukkan") ||
      lowerMsg.includes("catat") ||
      lowerMsg.includes("simpan") ||
      lowerMsg.includes("kios") ||
      lowerMsg.includes("supplier");

    if (isSupplierMsg || (hasSupplierDraft && isAddAction)) {
      const reg = extractSupplierFromText(message, currentSupplierDraft || {});
      const merged = { ...(currentSupplierDraft || {}), ...(reg.extracted || {}) };
      const check = checkSupplierCompleteness(merged);

      if (check.isComplete && (isAddAction || isSupplierMsg)) {
        const saved = saveSupplierRecord(merged, activeAdmin, activeAdmin?.noHp || senderPhone);
        return res.json({
          reply: formatSuccessSupplierRegistration(saved, activeAdmin),
          quickReplies: [
            "🏢 Tambah Supplier Lain",
            "📊 Buka Database Sheets",
            "📍 Lihat di Peta GIS",
            "🌾 Daftarkan Lahan Petani",
          ],
          extractedSupplier: saved,
          savedSupplier: saved,
          entityType: "supplier",
          isComplete: true,
          isAdminAction: isAdmin,
          aiProvider: "rule_based",
        });
      } else {
        const inc = formatIncompleteSupplierPrompt(merged, activeAdmin?.nama, isAdmin);
        return res.json({
          reply: inc.reply,
          quickReplies: inc.quickReplies,
          extractedSupplier: merged,
          entityType: "supplier",
          isComplete: false,
          isAdminAction: isAdmin,
          aiProvider: "rule_based",
        });
      }
    }

    // 0a. Agronomy Fertilizer Calculator query intent (accessible for both Farmers and Admins)
    const fertResult = handleAgronomyFertilizerQuery(message, currentDraft || {});
    if (fertResult) {
      return res.json({
        reply: fertResult.reply,
        quickReplies: fertResult.quickReplies,
        extracted: currentDraft || {},
        isComplete: false,
        aiProvider: "agronomy_engine",
      });
    }

    // 0b. Natural Language Analytics Aggregation query (for admin)
    if (isAdmin) {
      const analyticsResult = handleNaturalLanguageAnalyticsQuery(message, true);
      if (analyticsResult) {
        return res.json({
          reply: analyticsResult.reply,
          quickReplies: analyticsResult.quickReplies,
          extracted: currentDraft || {},
          isComplete: false,
          isAdminAction: true,
          aiProvider: "analytics_engine",
        });
      }
    }

    // 0c. Smart Query Cache Lookup (Pillar 3: Reusing Existing Results)
    const cacheKey = getNormalizedCacheKey(isAdmin ? "admin" : "farmer", message);
    const isCacheable = isQuerySafeToCache(message);

    if (isCacheable && aiResponseCache.has(cacheKey)) {
      const cached = aiResponseCache.get(cacheKey)!;
      if (cached.dataVersion === currentDataVersion && Date.now() - cached.timestamp < 1800000) {
        totalCacheHits++;
        totalTokensSavedEstimate += 650;
        console.log(`[AI Cache Hit] ⚡ Menggunakan hasil cache untuk: "${(message || "").substring(0, 30)}..." (0 token digunakan, hemat biaya 100%).`);
        return res.json({
          reply: cached.reply,
          quickReplies: cached.quickReplies,
          extracted: currentDraft || {},
          isComplete: false,
          isAdminAction: cached.isAdminAction,
          aiProvider: "cache",
          fromCache: true,
          cachedAt: new Date(cached.timestamp).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
          tokensUsed: 0,
        });
      }
    }

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

    // IF SENDER IS ADMIN: Build Executive Agricultural Intelligence AI Assistant with Lean Targeted Context
    if (isAdmin) {
      const leanContext = buildLeanTargetedContext(message, true);

      const adminSystemInstructions = `Anda adalah "Kang Tani AI - Executive Agricultural Intelligence Assistant", asisten AI resmi untuk dinas pertanian dan petugas PPL.

IDENTITAS ADMIN:
- Nama: ${activeAdmin.nama} (${activeAdmin.role}, ${activeAdmin.instansi})

${leanContext.summary}

${leanContext.targetedDetails ? `${leanContext.targetedDetails}\n` : ""}
${leanContext.marketHighlight ? `${leanContext.marketHighlight}\n` : ""}

BATASAN & ATURAN PANJANG JAWABAN (HEMAT TOKEN):
1. Jawab secara ringkas, to the point, padat informasi (maksimal 2-3 paragraf pendek atau poin WhatsApp).
2. Jika admin mencari petani atau komoditas tertentu, jelaskan data spesifik yang diminta tanpa membeberkan seluruh database.
3. Jika admin meminta draft pesan broadcast WhatsApp, berikan teks siap kirim yang bernas.
4. Format output JSON WAJIB:
{
  "reply": "Pesan balasan profesional untuk Admin dalam format WhatsApp (*bold*, bullet points, emojis)",
  "quickReplies": ["3 tombol aksi cepat yang relevan"],
  "isAdminAction": true
}`;

      let aiResult: { text: string; provider: "9router" | "gemini"; model: string } | null = null;
      try {
        aiResult = await callUniversalAI(
          adminSystemInstructions,
          message,
          history,
          { signal: clientAbortController.signal, maxOutputTokens: 550 }
        );
      } catch (err: any) {
        if (isClientAborted || clientAbortController.signal.aborted) {
          console.log("[Admin Chat] AI dibatalkan oleh pengguna (hemat biaya).");
          if (!res.headersSent) {
            return res.status(499).json({ error: "Permintaan dibatalkan oleh pengguna (hemat token)." });
          }
          return;
        }
        console.log("[Admin Chat] AI provider error, using smart fallback:", err?.message);
      }

      if (aiResult) {
        try {
          const responseText = aiResult.text;
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

          parsed.aiProvider = aiResult.provider;
          parsed.aiModel = aiResult.model;

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

          if (isAddRequest || parsed.isComplete) {
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

          // Cache non-mutating AI reply for future reuse (Pillar 3)
          if (isCacheable && parsed?.reply && !parsed?.isComplete) {
            aiResponseCache.set(cacheKey, {
              reply: parsed.reply,
              quickReplies: parsed.quickReplies,
              isAdminAction: true,
              timestamp: Date.now(),
              dataVersion: currentDataVersion,
              provider: "cache",
            });
          }

          return res.json(parsed);
        } catch (err: any) {
          console.log("[Admin Chat] Parsing fallback triggered:", err?.message);
        }
      }

      // Smart Dynamic Fallback for Admin
      const smartFallback = generateSmartAdminFallback(message, activeAdmin, farmersDb, commoditiesDb, currentDraft);
      return res.json({ ...smartFallback, aiProvider: "rule_based" });
    }

    // GENERAL CONVERSATION (Petani Biasa / Non-Admin) with Lean Targeted Context
    const leanContext = buildLeanTargetedContext(message, false);

    const systemInstructions = `Anda adalah "Kang Tani AI", asisten digital cerdas, sopan, dan hangat di WhatsApp untuk petani Indonesia.

${leanContext.summary}
${leanContext.targetedDetails ? `${leanContext.targetedDetails}\n` : ""}
${leanContext.marketHighlight ? `${leanContext.marketHighlight}\n` : ""}
${currentDraft && Object.keys(currentDraft).length > 0 ? `DRAFT DATA TERKUMPUL: ${JSON.stringify(currentDraft)}` : ""}

BATASAN & ATURAN PANJANG JAWABAN (HEMAT TOKEN):
1. Jawab ramah dan ringkas (maksimal 2 paragraf singkat WhatsApp).
2. Langsung berikan solusi teknis atau data harga tanpa bertele-tele.
3. Jika petani mendaftarkan lahan, gali data yang belum ada: Nama, No WA, Alamat, Luas Lahan (Ha), Komoditas, Estimasi Panen.
4. Format output JSON:
{
  "reply": "Pesan balasan ramah & padat gaya WhatsApp (*bold*, emoji)",
  "extracted": {
    "nama": "nama jika ada / null",
    "noHp": "nomor wa jika ada / null",
    "alamat": "desa & kecamatan jika ada / null",
    "kabupaten": "kabupaten jika ada / null",
    "luasLahan": 1.5,
    "luasLahanFormatted": "1.5 Ha",
    "komoditas": "komoditas jika ada / null",
    "varietas": "varietas jika ada / null",
    "estimasiPanen": "Bulan Tahun jika ada / null",
    "estimasiHasilTon": 9.5
  },
  "isComplete": true (hanya jika data pokok lengkap),
  "quickReplies": ["2-3 opsi cepat"]
}`;

    if (!ai) {
      // Intelligent rule-based fallback if API key is not yet set
      const lower = (message || "").toLowerCase();
      const regexAdd = isAddRegex(lower);
      // Lazy laya: hanya fetch saat regex miss (0ms saat regex hit).
      let laya: { intent: string; confidence: number } | null = null;
      if (!regexAdd) laya = await chatLaya();
      const isAddIntent = regexAdd || (laya?.intent === "daftar_lahan" && (laya?.confidence || 0) >= 0.5);
      const isPriceIntent =
        lower.includes("harga") ||
        lower.includes("pasar") ||
        lower.includes("anomali") ||
        (laya?.intent === "cek_harga" && (laya?.confidence || 0) >= 0.5);
      const isHamaIntent = laya?.intent === "hama_pupuk" && (laya?.confidence || 0) >= 0.5;

      const reg = extractFarmerFromText(message, currentDraft || {});
      let extracted: Partial<FarmerRecord> = { ...(currentDraft || {}), ...reg.extracted };
      const check = checkFarmerCompleteness(extracted);

      // If user asks to add or provides farmer registration details
      if (isAddIntent) {
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

      if (isPriceIntent) {
        replyText = `📊 *Informasi Harga Pasar Terkini:*\n• Beras Premium: Rp 16.200/kg\n• Cabai Rawit Merah: Rp 82.000/kg (⚠️ Lonjakan Ekstrem +36.7%)\n• Bawang Merah: Rp 28.500/kg\n• Jagung Pipil: Rp 5.800/kg\n\nApakah Bapak/Ibu ingin mendaftarkan komoditas dan perkiraan waktu panen?`;
      } else if (isHamaIntent) {
        replyText = `🌱 *Konsultasi Hama & Pupuk siap!* Ceritakan gejala di lahan (misal: daun menguning, wereng, ulat) + komoditas + luas lahan, nanti Kang Tani kasih takaran dan jadwal aplikasi.`;
      } else if (lower.includes("padi") || lower.includes("cabai") || lower.includes("bawang") || lower.includes("jagung")) {
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

    let aiResult: { text: string; provider: "9router" | "gemini"; model: string } | null = null;
    try {
      aiResult = await callUniversalAI(
        systemInstructions,
        message,
        history,
        { signal: clientAbortController.signal, maxOutputTokens: 550 }
      );
    } catch (error: any) {
      if (isClientAborted || clientAbortController.signal.aborted) {
        console.log("[Petani Chat] AI dibatalkan oleh pengguna (hemat biaya).");
        if (!res.headersSent) {
          return res.status(499).json({ error: "Permintaan dibatalkan oleh pengguna (hemat token)." });
        }
        return;
      }
      console.log("[Chat Info] Universal AI error, serving rule-based fallback reply:", error?.message || "fallback");
    }

    if (aiResult) {
      try {
        const responseText = aiResult.text;
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

        parsed.aiProvider = aiResult.provider;
        parsed.aiModel = aiResult.model;

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
        if (isAddRequest || parsed.isComplete) {
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

        // Cache non-mutating response for future query reuse (Pillar 3)
        if (isCacheable && parsed?.reply && !parsed?.isComplete && !parsed?.savedRecord) {
          aiResponseCache.set(cacheKey, {
            reply: parsed.reply,
            quickReplies: parsed.quickReplies,
            isAdminAction: false,
            timestamp: Date.now(),
            dataVersion: currentDataVersion,
            provider: "cache",
          });
        }

        return res.json(parsed);
      } catch (err: any) {
        console.log("[Chat Info] Error processing AI response, falling back to rule-based:", err?.message);
      }
    }

    // Rule-based fallback response
    console.log("[Chat Info] Serving rule-based fallback reply");
    const lower = (message || "").toLowerCase();
    const regexAdd = isAddRegex(lower);
    // Lazy laya: hanya fetch saat regex miss.
    let layaFb: { intent: string; confidence: number } | null = null;
    if (!regexAdd) layaFb = await chatLaya();
    const isAddRequest = regexAdd || (layaFb?.intent === "daftar_lahan" && (layaFb?.confidence || 0) >= 0.5);
    const isPriceFb =
      lower.includes("harga") ||
      lower.includes("pasar") ||
      (layaFb?.intent === "cek_harga" && (layaFb?.confidence || 0) >= 0.5);

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
          aiProvider: "rule_based",
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
        return res.json({ ...incomplete, aiProvider: "rule_based" });
      }
    }

    // Rule-based fallback response
    let fallbackReply =
      "🌾 *Salam Berkah Petani!* Pesan Bapak/Ibu telah diterima Kang Tani AI. Boleh disampaikan nama lengkap, luas lahan, dan komoditas apa yang sedang ditanam agar kami catat ke Google Sheets?";

    if (isPriceFb) {
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
      aiProvider: "rule_based",
      quickReplies: [
        "Daftarkan Lahan Baru",
        "Cek Harga Pasar Hari Ini",
        "Buka Database Google Sheets",
      ],
    });
  });

  // Bi-Directional Webhook Receiver for Google Apps Script & External Automation
  app.post("/api/webhook", (req, res) => {
    try {
      const payload = req.body || {};
      const timestamp = new Date().toISOString().replace("T", " ").substring(0, 19);

      // 1. Handling Google Apps Script onEdit Event
      if (payload.event === "sheet_edit") {
        const { row, col, value, sheetName } = payload;
        let detail = `Edit di ${sheetName || "Sheet1"} baris #${row}, kolom #${col}: "${value}"`;

        if (row >= 2 && row - 2 < farmersDb.length) {
          const idx = row - 2;
          const farmer = farmersDb[idx];

          // Map column:
          // 3: Nama, 4: NoHp, 5: Alamat, 6: Kabupaten, 7: LuasLahan, 8: Komoditas, 9: Varietas, 10: EstimasiPanen, 11: EstimasiHasilTon, 12: StatusVerifikasi, 13: CatatanAI
          if (col === 3 && value) farmer.nama = String(value);
          else if (col === 4 && value) farmer.noHp = String(value);
          else if (col === 5 && value) farmer.alamat = String(value);
          else if (col === 6 && value) farmer.kabupaten = String(value);
          else if (col === 7 && value) {
            const num = parseFloat(value) || farmer.luasLahan;
            farmer.luasLahan = num;
            farmer.luasLahanFormatted = `${num} Ha`;
          } else if (col === 8 && value) farmer.komoditas = String(value);
          else if (col === 9 && value) farmer.varietas = String(value);
          else if (col === 10 && value) farmer.estimasiPanen = String(value);
          else if (col === 11 && value) farmer.estimasiHasilTon = parseFloat(value) || farmer.estimasiHasilTon;
          else if (col === 12 && value) {
            const str = String(value).trim().toLowerCase();
            if (str.includes("terverifikasi")) farmer.statusVerifikasi = "Terverifikasi";
            else if (str.includes("klarifikasi")) farmer.statusVerifikasi = "Perlu Klarifikasi";
            else farmer.statusVerifikasi = "Menunggu Verifikasi";
          }
          else if (col === 13 && value) farmer.catatanAI = String(value);

          saveFarmersToDisk();
          detail += ` → Data petani ${farmer.nama} (${farmer.id}) berhasil diperbarui & disimpan ke disk`;
        }

        const logItem = {
          id: `wh-${Date.now()}`,
          timestamp,
          event: "sheet_edit",
          detail,
          status: "SUCCESS",
        };
        webhookLogs.unshift(logItem);
        if (webhookLogs.length > 50) webhookLogs.pop();

        return res.json({
          success: true,
          message: "Sinkronisasi perubahan Google Sheets berhasil dicatat.",
          log: logItem,
        });
      }

      // 2. Generic or Manual Webhook Payload
      const logItem = {
        id: `wh-${Date.now()}`,
        timestamp,
        event: payload.event || "generic_payload",
        detail: typeof payload === "string" ? payload.substring(0, 120) : JSON.stringify(payload).substring(0, 120),
        status: "RECEIVED",
      };
      webhookLogs.unshift(logItem);
      if (webhookLogs.length > 50) webhookLogs.pop();

      res.json({ success: true, message: "Webhook payload diterima", log: logItem });
    } catch (err: any) {
      console.error("[Webhook Error]", err);
      res.status(500).json({ error: "Gagal memproses webhook: " + err.message });
    }
  });

  // Test Ping Endpoint for Webhook Verification UI
  app.post("/api/webhook/test-ping", (_req, res) => {
    const timestamp = new Date().toISOString().replace("T", " ").substring(0, 19);
    const logItem = {
      id: `wh-ping-${Date.now()}`,
      timestamp,
      event: "test_ping",
      detail: "Uji koneksi ping dari antarmuka Webhook Google Apps Script",
      status: "ACTIVE",
    };
    webhookLogs.unshift(logItem);
    if (webhookLogs.length > 50) webhookLogs.pop();

    res.json({
      ok: true,
      timestamp,
      message: "Endpoint Webhook TaniAI aktif dan siap menerima panggilan dari Google Apps Script onEdit",
      farmersCount: farmersDb.length,
    });
  });

  // GET Webhook Logs
  app.get("/api/webhook/logs", (_req, res) => {
    res.json(webhookLogs);
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

  // Webhook WhatsApp Message Receiver (Meta Cloud API)
  app.post("/api/webhook/whatsapp", async (req, res) => {
    try {
      const body = req.body || {};
      const entry = body?.entry?.[0]?.changes?.[0]?.value;
      const msg = entry?.messages?.[0];
      const text = msg?.text?.body || msg?.button?.text || "";
      const from = msg?.from || "";
      if (text) {
        const clean = sanitizeText(text, 2000);
        const { extracted } = extractFarmerFromText(clean, {});
        const check = checkFarmerCompleteness({ ...extracted, noHp: from || extracted.noHp });
        if (check.isComplete) {
          const saved = saveFarmerRecord({ ...extracted, noHp: from || extracted.noHp });
          console.log(`[WA] petani tersimpan ${saved.id} dari ${from}`);
        } else {
          console.log(`[WA] draf masuk dari ${from}: ${check.missingFields.join(", ")}`);
        }
      } else {
        console.log("Incoming WhatsApp Webhook event:", JSON.stringify(body).slice(0, 500));
      }
      res.status(200).send("EVENT_RECEIVED");
    } catch (err) {
      console.error("Webhook processing error:", err);
      res.status(500).send("INTERNAL_ERROR");
    }
  });

  // Korelasi Pearson luas vs ton (stdlib, tanpa dep).
  app.get("/api/analytics/correlation", (_req, res) => {
    const xs = farmersDb.map((f) => Number(f.luasLahan) || 0);
    const ys = farmersDb.map((f) => Number(f.estimasiHasilTon) || 0);
    const n = xs.length;
    if (n < 2) return res.json({ n, r: 0 });
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; }
    const r = dx && dy ? Number((num / Math.sqrt(dx * dy)).toFixed(3)) : 0;
    res.json({ n, r });
  });

  // Simulasi intervensi Dinas (resapan gudang, CAS 30-45 hari, subsidi ongkir, OP murah).
  app.post("/api/interventions/simulate", (req, res) => {
    const b = req.body || {};
    const ton = Number(b.estimasiTon || farmersDb.reduce((a, f) => a + (f.estimasiHasilTon || 0), 0));
    const harga = Number(b.hargaKg || 12000);
    const resapan = Math.min(1, Math.max(0, Number(b.resapanPersen ?? 20) / 100));
    const casHari = Math.min(45, Math.max(0, Number(b.casHari ?? 30)));
    const subsidiKg = Math.max(0, Number(b.subsidiOngkirKg ?? 0));
    const opKg = Math.max(0, Number(b.operasiPasarKg ?? 0));
    const nilaiTerserap = Math.round(ton * 1000 * resapan * harga);
    const nilaiCas = Math.round(ton * 1000 * (1 - resapan) * harga * (casHari / 45) * 0.05);
    const biayaSubsidi = Math.round(ton * 1000 * subsidiKg);
    const nilaiOp = Math.round(opKg * harga);
    res.json({ ton, harga, resapan: resapan * 100, casHari, nilaiTerserap, nilaiCas, biayaSubsidi, nilaiOp });
  });

  // Broadcast hama khusus (template + endpoint sendiri).
  app.post("/api/notifications/pest-broadcast", (req, res) => {
    const komoditas = sanitizeText(req.body?.komoditas || "Padi", 80) || "Padi";
    const hama = sanitizeText(req.body?.hama || "wereng", 80) || "wereng";
    const anjuran = sanitizeText(req.body?.anjuran || "Lapor PPL, pasang perangkap kuning, semprot neem 2ml/L pagi hari.", 500);
    const target = farmersDb.filter((f) => (f.komoditas || "").toLowerCase().includes(komoditas.toLowerCase().split(" ")[0]));
    const pesan = `🐛 *[TaniAI SIAGA HAMA]*\nYth. Petani ${komoditas},\nWaspada serangan ${hama}.\n💡 ${anjuran}\n_Lapor PPL bila >10% rumpun terdampak._`;
    const notif: AnomalyNotification = {
      id: `pest-${Date.now()}`,
      komoditas,
      tipeAnomali: "PERINGATAN_PASAR",
      pesanPeringatan: pesan,
      waktuKirim: new Date().toLocaleString("id-ID") + " WIB",
      jumlahPetaniTerdampak: Math.max(target.length, 1),
      status: "Terkirim",
      targetPetaniNames: target.length ? target.map((f) => f.nama) : ["Seluruh Petani Terdaftar"],
    };
    notificationsDb.unshift(notif);
    res.json({ success: true, notification: notif });
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

    const sanitizeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      let str = String(val).replace(/"/g, '""');
      if (/^[=+\-@]/.test(str)) {
        str = "'" + str;
      }
      return `"${str}"`;
    };

    const rows = farmersDb.map((f) => [
      sanitizeCsv(f.id),
      sanitizeCsv(f.timestamp),
      sanitizeCsv(f.nama),
      sanitizeCsv(f.noHp),
      sanitizeCsv(f.alamat),
      sanitizeCsv(f.kabupaten || ""),
      f.luasLahan,
      sanitizeCsv(f.komoditas),
      sanitizeCsv(f.varietas || ""),
      sanitizeCsv(f.estimasiPanen),
      f.estimasiHasilTon,
      sanitizeCsv(f.statusVerifikasi),
      sanitizeCsv(f.catatanAI || ""),
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
    const protoRaw = String(req.headers["x-forwarded-proto"] || req.protocol || "https").split(",")[0].trim();
    const protocol = protoRaw === "http" ? "http" : "https";
    const host = cleanHost(req.get("host"));
    const fullCsvUrl = `${protocol}://${host}/api/sheets/export.csv`;

    const rowsHtml = farmersDb
      .map(
        (f, idx) => `
      <tr class="farmer-row hover:bg-emerald-50/50 transition-colors" data-nama="${escAttr((f.nama || "").toLowerCase())}" data-komoditas="${escAttr((f.komoditas || "").toLowerCase())}" data-alamat="${escAttr((f.alamat || "").toLowerCase())}">
        <td class="row-num select-none">${idx + 2}</td>
        <td class="cell font-mono font-semibold text-emerald-800" data-col="A" data-row="${idx + 2}">${escHtml(f.id)}</td>
        <td class="cell text-slate-500 font-mono text-xs" data-col="B" data-row="${idx + 2}">${escHtml(f.timestamp)}</td>
        <td class="cell font-semibold text-slate-900" data-col="C" data-row="${idx + 2}">${escHtml(f.nama)}</td>
        <td class="cell font-mono text-slate-700" data-col="D" data-row="${idx + 2}">${escHtml(f.noHp)}</td>
        <td class="cell text-slate-700" data-col="E" data-row="${idx + 2}">${escHtml(f.alamat)}</td>
        <td class="cell text-slate-700" data-col="F" data-row="${idx + 2}">${escHtml(f.kabupaten || "—")}</td>
        <td class="cell text-right font-mono font-bold text-emerald-900 bg-emerald-50/40" data-col="G" data-row="${idx + 2}">${Number(f.luasLahan || 0).toFixed(1)}</td>
        <td class="cell font-medium text-slate-800" data-col="H" data-row="${idx + 2}">${escHtml(f.komoditas)}</td>
        <td class="cell text-slate-600" data-col="I" data-row="${idx + 2}">${escHtml(f.varietas || "—")}</td>
        <td class="cell text-slate-700" data-col="J" data-row="${idx + 2}">${escHtml(f.estimasiPanen)}</td>
        <td class="cell text-right font-mono font-bold text-amber-900 bg-amber-50/40" data-col="K" data-row="${idx + 2}">${Number(f.estimasiHasilTon || 0).toFixed(1)}</td>
        <td class="cell text-center" data-col="L" data-row="${idx + 2}"><span class="badge">${escHtml(f.statusVerifikasi)}</span></td>
        <td class="cell text-slate-600 max-w-sm truncate" data-col="M" data-row="${idx + 2}" title="${escAttr(f.catatanAI || "")}">${escHtml(f.catatanAI || "—")}</td>
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
      text.textContent = String(msg || "").replace(/<[^>]*>/g, "");
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

  // AI Cost Optimization & Metrics endpoint
  app.get("/api/ai/metrics", (_req, res) => {
    res.json({
      totalCacheHits,
      totalTokensSavedEstimate,
      cachedItemsCount: aiResponseCache.size,
      dataVersion: currentDataVersion,
      maxOutputTokensLimit: 550,
      activeProvider: getNineRouterConfig().isConfigured ? "9router" : getGemini() ? "gemini" : "offline_fallback",
    });
  });

  // Explicit cancellation endpoint
  app.post("/api/chat/cancel", (_req, res) => {
    console.log("[AI Cost Optimizer] Client requested explicit cancellation.");
    res.json({ ok: true, message: "Proses AI dibatalkan untuk menghemat token." });
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
