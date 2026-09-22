export interface FarmerRecord {
  id: string;
  timestamp: string;
  nama: string;
  noHp: string;
  alamat: string;
  kabupaten?: string;
  luasLahan: number; // in Hectares (Ha)
  luasLahanFormatted: string; // e.g., "1.5 Ha (15.000 m²)"
  komoditas: string;
  varietas?: string;
  estimasiPanen: string; // e.g., "Oktober 2026"
  estimasiHasilTon: number; // in Ton
  statusVerifikasi: 'Terverifikasi' | 'Menunggu Verifikasi' | 'Perlu Klarifikasi';
  catatanAI?: string;
  syncStatus: 'synced' | 'pending' | 'failed';
  googleSheetRow?: number;
}

export interface MarketCommodity {
  id: string;
  nama: string;
  kategori: 'Pangan Pokok' | 'Hortikultura' | 'Palawija' | 'Perkebunan';
  hargaSekarang: number; // Rp per Kg
  hargaKemarin: number;
  hargaAcuanPemerintah: number; // HAP / HET
  perubahanPersen: number;
  statusAnomali: 'NORMAL' | 'LONJAKAN_EKSTREM' | 'PENURUNAN_DRASTIS' | 'PERINGATAN_FLUKTUASI';
  daerahSampel: string;
  tanggalUpdate: string;
  pesanAnomali?: string;
  rekomendasiPetani: string;
  tren7Hari: { tanggal: string; harga: number }[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot' | 'system';
  text: string;
  timestamp: string;
  type?: 'text' | 'form_confirm' | 'price_alert' | 'image' | 'voice_note';
  extractedData?: Partial<FarmerRecord>;
  quickReplies?: string[];
  imageUrl?: string;
  audioDuration?: string;
  transcription?: string;
}

export interface AnomalyNotification {
  id: string;
  komoditas: string;
  tipeAnomali: 'LONJAKAN_EKSTREM' | 'PENURUNAN_DRASTIS' | 'PERINGATAN_PASAR';
  pesanPeringatan: string;
  waktuKirim: string;
  jumlahPetaniTerdampak: number;
  status: 'Terkirim' | 'Dijadwalkan' | 'Pending';
  targetPetaniNames: string[];
}

export interface StrategicRecommendation {
  id: string;
  tanggal: string;
  judul: string;
  urgensi: 'Tinggi' | 'Sedang' | 'Rendah';
  ringkasanEksekutif: string;
  analisisOversupplyShortage: string[];
  rekomendasiAgronomi: string[];
  rekomendasiKebijakanHarga: string[];
  rekomendasiRantaiPasok: string[];
  dataScientistNotes: string;
}

export interface AdminUser {
  id: string;
  nama: string;
  noHp: string;
  instansi: string;
  role: 'ADMIN_UTAMA' | 'PETUGAS_PPL' | 'DATA_SCIENTIST';
  izinAkses: string[];
  aktif: boolean;
  waktuTerdaftar: string;
}

