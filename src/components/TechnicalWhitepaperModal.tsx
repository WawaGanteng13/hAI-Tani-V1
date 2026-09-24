import React, { useState } from 'react';
import {
  FileText,
  Download,
  Printer,
  X,
  Workflow,
  Layers,
  Cpu,
  Database,
  CheckCircle2,
  ShieldCheck,
  Users,
  Sprout,
  BarChart3,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  MessageSquare,
  FileSpreadsheet
} from 'lucide-react';
import { generateArchitecturePdf } from '../utils/generateArchitecturePdf';

interface TechnicalWhitepaperModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TechnicalWhitepaperModal: React.FC<TechnicalWhitepaperModalProps> = ({ isOpen, onClose }) => {
  const [activeSection, setActiveSection] = useState<'flowchart' | 'architecture' | 'utilities' | 'database'>('flowchart');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  if (!isOpen) return null;

  const handleDownloadPdf = () => {
    setIsGeneratingPdf(true);
    try {
      generateArchitecturePdf();
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    } finally {
      setTimeout(() => setIsGeneratingPdf(false), 1200);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 print:p-0 print:bg-white">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden print:max-h-none print:shadow-none print:border-none">
        
        {/* Header Bar */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 print:bg-white print:text-slate-900 print:border-b-2 print:border-slate-300">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-bold">Dokumentasi Teknis, Arsitektur & Flowchart TaniAI</h2>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] px-2 py-0.5 rounded-full font-mono">
                  Official PDF Export
                </span>
              </div>
              <p className="text-xs text-slate-400 print:text-slate-600">
                Whitepaper Resmi: Digital Architecture, Data Flowchart, & Spesifikasi Sistematis
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 print:hidden">
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition shadow-md shadow-emerald-700/20 cursor-pointer disabled:opacity-50"
              title="Unduh file PDF resmi ke komputer"
            >
              <Download className={`w-4 h-4 ${isGeneratingPdf ? 'animate-bounce' : ''}`} />
              <span>{isGeneratingPdf ? 'Membuat PDF...' : 'Unduh Dokumen PDF'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium px-3 py-2 rounded-xl transition cursor-pointer border border-slate-700"
              title="Cetak atau Simpan PDF via Browser"
            >
              <Printer className="w-4 h-4 text-slate-300" />
              <span className="hidden sm:inline">Cetak</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sub-nav tabs for interactive review */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-2.5 flex items-center justify-between overflow-x-auto print:hidden">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveSection('flowchart')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeSection === 'flowchart'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Workflow className="w-3.5 h-3.5" />
              <span>Flowchart & Validasi Data</span>
            </button>

            <button
              onClick={() => setActiveSection('architecture')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeSection === 'architecture'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Digital Architecture (4-Tier)</span>
            </button>

            <button
              onClick={() => setActiveSection('utilities')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeSection === 'utilities'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Kegunaan Lengkap Pemangku Kepentingan</span>
            </button>

            <button
              onClick={() => setActiveSection('database')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeSection === 'database'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Skema Data & Google Sheets</span>
            </button>
          </div>

          <span className="text-[11px] text-slate-500 font-mono hidden md:inline">
            Status: Format Standar PDF Siap Unduh
          </span>
        </div>

        {/* Modal Body / Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 print:overflow-visible print:p-0 print:space-y-6">
          
          {/* Executive Summary Banner */}
          <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-100/50 p-5 rounded-2xl border border-emerald-200/80">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold tracking-wider text-emerald-800 uppercase bg-emerald-200/60 px-2.5 py-0.5 rounded-full">
                  Dokumen Arsitektur & Pitching Resmi
                </span>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 mt-2">
                  TaniAI: Conversational Agriculture Intelligence Ecosystem
                </h3>
                <p className="text-xs sm:text-sm text-slate-700 mt-1 max-w-3xl leading-relaxed">
                  Platform integrasi WhatsApp, Gemini AI, dan Google Sheets dua arah yang memampukan petani mandiri mendata lahan, berkonsultasi agronomi, dan memantau transparansi harga pasar harian, sekaligus menyediakan sistem peringatan dini (Early Warning System) anomali pasokan pangan bagi Dinas Pertanian daerah.
                </p>
              </div>
              <button
                onClick={handleDownloadPdf}
                className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-700 text-xs font-bold rounded-xl border border-emerald-300 shadow-xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .PDF</span>
              </button>
            </div>
          </div>

          {/* SECTION 1: FLOWCHART */}
          {(activeSection === 'flowchart' || activeSection === 'architecture' || activeSection === 'utilities' || activeSection === 'database') && (
            <div className={`space-y-4 ${activeSection !== 'flowchart' ? 'hidden print:block' : ''}`}>
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center space-x-2">
                  <Workflow className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-bold text-slate-900 text-base">1. Flowchart Alur Kerja & Validasi Kelengkapan (Conversational Flow)</h3>
                </div>
                <span className="text-xs text-slate-500 font-mono">Bagan Alir Sistem</span>
              </div>

              {/* Visual Flowchart Cards */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 relative">
                {/* Step 1 */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center">1</span>
                      <MessageSquare className="w-4 h-4 text-emerald-600" />
                    </div>
                    <h4 className="font-bold text-xs text-slate-900">Pesan Masuk WhatsApp</h4>
                    <p className="text-[11px] text-slate-600 mt-1">Petani/PPL kirim teks atau pesan suara santai.</p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-200 text-[10px] text-slate-500 font-mono">
                    Webhook Trigger
                  </div>
                </div>

                {/* Step 2 */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center">2</span>
                      <Cpu className="w-4 h-4 text-indigo-600" />
                    </div>
                    <h4 className="font-bold text-xs text-slate-900">NLP Entity Extraction</h4>
                    <p className="text-[11px] text-slate-600 mt-1">Gemini AI memetakan nama, komoditas, luas, dan wilayah.</p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-200 text-[10px] text-indigo-600 font-mono">
                    JSON Entity Mapping
                  </div>
                </div>

                {/* Step 3 (Decision Point) */}
                <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3.5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="w-6 h-6 rounded-full bg-amber-200 text-amber-900 text-xs font-bold flex items-center justify-center">3</span>
                      <ShieldCheck className="w-4 h-4 text-amber-700" />
                    </div>
                    <h4 className="font-bold text-xs text-amber-950">Validasi 4 Bidang Pokok</h4>
                    <p className="text-[11px] text-amber-800 mt-1">Nama, Komoditas, Luas (&gt;0), & Wilayah lengkap?</p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-amber-200 text-[10px] font-bold text-amber-700">
                    Decision Branching
                  </div>
                </div>

                {/* Step 4 (Branch A: Incomplete) */}
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="w-6 h-6 rounded-full bg-rose-200 text-rose-800 text-xs font-bold flex items-center justify-center">❌</span>
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                    </div>
                    <h4 className="font-bold text-xs text-rose-950">Jika Belum Lengkap</h4>
                    <p className="text-[11px] text-rose-700 mt-1">Simpan draf session, tahan insert database, minta field kurang via chat.</p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-rose-200 text-[10px] text-rose-700 font-mono">
                    Draft Session Kept
                  </div>
                </div>

                {/* Step 5 (Branch B: Complete) */}
                <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3.5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="w-6 h-6 rounded-full bg-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-center">✅</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <h4 className="font-bold text-xs text-emerald-950">Jika 100% Lengkap</h4>
                    <p className="text-[11px] text-emerald-700 mt-1">Generate ID TANI-xxx, simpan database, append baris Sheets & Dashboard.</p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-emerald-200 text-[10px] text-emerald-700 font-mono">
                    Live Synced to Sheets
                  </div>
                </div>
              </div>

              {/* Detailed Explanation */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs space-y-2 text-slate-700">
                <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>Mekanisme Anti-Sampah Data (Zero-Garbage Principle):</span>
                </div>
                <p>
                  Data registrasi petani hanya akan disinkronkan ke Google Sheets dan dihitung dalam proyeksi panen apabila telah melewati validasi 4 data pokok. Jika pengguna hanya menyebut nama tanpa komoditas atau luas lahan, asisten AI secara otomatis menahan proses penyimpanan, menyimpan data sementara di <em>conversation memory</em>, lalu memberikan panduan interaktif melalui daftar periksa (checklist) yang mudah dimengerti petani.
                </p>
              </div>
            </div>
          )}

          {/* SECTION 2: DIGITAL ARCHITECTURE */}
          {(activeSection === 'architecture' || activeSection === 'flowchart' || activeSection === 'utilities' || activeSection === 'database') && (
            <div className={`space-y-4 ${activeSection !== 'architecture' ? 'hidden print:block' : ''}`}>
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center space-x-2">
                  <Layers className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-bold text-slate-900 text-base">2. Digital Architecture Blueprint (4-Tier Enterprise Structure)</h3>
                </div>
                <span className="text-xs text-slate-500 font-mono">Arsitektur Modular</span>
              </div>

              <div className="space-y-3">
                {/* Tier 1 */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-md">Tier 1</span>
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900">Presentation & Ingestion Layer (Kanal Pengguna)</h4>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">WhatsApp / React Web UI</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1.5">
                    <strong>Komponen:</strong> WhatsApp Cloud API / Webhook Router, Single Page Dashboard (React 19, Vite, Tailwind CSS), Audio Note Waveform Transcriber.
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    <em>Peran:</em> Menerima input multikanal (chat, voice note, keyboard), merender visualisasi grafis sebaran lahan, dan memberikan audio-feedback status operasi.
                  </p>
                </div>

                {/* Tier 2 */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="bg-slate-200 text-slate-800 text-[11px] font-bold px-2 py-0.5 rounded-md">Tier 2</span>
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900">API Gateway & RBAC Security Layer (Gerbang Keamanan)</h4>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">Express.js / Phone Whitelist</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1.5">
                    <strong>Komponen:</strong> Express.js REST API, Role-Based Access Control (RBAC), Phone Number Whitelist Validator, Rate Limiter & Sanitizer.
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    <em>Peran:</em> Memverifikasi apakah pengirim adalah Petani Umum atau Petugas Penyuluh Lapangan (PPL)/Kepala Dinas berwenang sebelum mengeksekusi aksi khusus.
                  </p>
                </div>

                {/* Tier 3 */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="bg-indigo-100 text-indigo-800 text-[11px] font-bold px-2 py-0.5 rounded-md">Tier 3</span>
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900">AI Cognitive & Validation Engine (Mesin Pemroses Cerdas)</h4>
                    </div>
                    <span className="text-[10px] font-mono text-indigo-600">Google Gemini 2.5 + Regex</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1.5">
                    <strong>Komponen:</strong> Google Gemini SDK, Agricultural Entity Extractor, Strict Completeness State Machine, Rule-Based Fallback Engine.
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    <em>Peran:</em> Menganalisis dialek petani, memetakan luasan hektar/meter persegi, mengidentifikasi varietas bibit, dan melakukan validasi kelengkapan data.
                  </p>
                </div>

                {/* Tier 4 */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2 py-0.5 rounded-md">Tier 4</span>
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900">Storage, Analytical Sync & Broadcast Layer (Basis Data & Aksi)</h4>
                    </div>
                    <span className="text-[10px] font-mono text-amber-700">Google Sheets V4 / Alert Bus</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1.5">
                    <strong>Komponen:</strong> Google Sheets V4 Two-Way Sync API, In-Memory/Persistent Store, Early Supply Anomaly Calculator, Push Broadcast Notification Queue.
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    <em>Peran:</em> Menuliskan record petani ke baris spreadsheet aktif, memicu kalkulasi proyeksi tonase panen, dan mengirim peringatan dini krisis pangan daerah.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 3: UTILITIES & USE CASES */}
          {(activeSection === 'utilities' || activeSection === 'flowchart' || activeSection === 'architecture' || activeSection === 'database') && (
            <div className={`space-y-4 ${activeSection !== 'utilities' ? 'hidden print:block' : ''}`}>
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-bold text-slate-900 text-base">3. Kegunaan Lengkap Aplikasi / Agen AI Berdasarkan Pemangku Kepentingan</h3>
                </div>
                <span className="text-xs text-slate-500 font-mono">Use Cases & Matrix Nilai</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Petani */}
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40">
                  <div className="flex items-center space-x-2 text-emerald-800 font-bold text-xs sm:text-sm mb-2">
                    <Sprout className="w-4 h-4 text-emerald-600" />
                    <span>A. Bagi Petani & Kelompok Tani (Poktan)</span>
                  </div>
                  <ul className="text-xs text-slate-700 space-y-1.5 list-disc list-inside">
                    <li><strong>Konsultasi Hama 24/7:</strong> Menanyakan gejala serangan wereng, patek, atau ulat dan memperoleh rekomendasi takaran pestisida alami.</li>
                    <li><strong>Pendaftaran Lahan Cepat:</strong> Cukup mengetik pesan singkat atau kirim voice note tanpa perlu form registrasi berbelit.</li>
                    <li><strong>Transparansi Harga Pasar:</strong> Mengetahui harga acuan gabah, cabai, dan bawang di pasar induk agar terhindar dari tengkulak.</li>
                    <li><strong>Akses Subsidi Tepat Sasaran:</strong> Terdaftar secara resmi di database binaan dinas untuk prioritas pupuk bersubsidi.</li>
                  </ul>
                </div>

                {/* PPL */}
                <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40">
                  <div className="flex items-center space-x-2 text-blue-800 font-bold text-xs sm:text-sm mb-2">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span>B. Bagi Petugas Penyuluh Lapangan (PPL)</span>
                  </div>
                  <ul className="text-xs text-slate-700 space-y-1.5 list-disc list-inside">
                    <li><strong>Pendataan Lahan Hands-Free:</strong> PPL dapat merekam data binaan saat mengendarai motor di pematang sawah via voice note.</li>
                    <li><strong>Otomasi Administrasi Kantor:</strong> Menghapus tugas malam hari mengetik ulang ratusan buku catatan petani ke Microsoft Excel.</li>
                    <li><strong>Verifikasi Sekali Klik:</strong> Mengesahkan status lahan petani dari "Menunggu Verifikasi" menjadi "Terverifikasi" langsung via chat WA.</li>
                    <li><strong>Broadcast Informasi Cuaca:</strong> Meneruskan imbauan waspada cuaca ekstrem serentak ke kelompok tani binaan.</li>
                  </ul>
                </div>

                {/* Dinas Pertanian */}
                <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/40">
                  <div className="flex items-center space-x-2 text-purple-800 font-bold text-xs sm:text-sm mb-2">
                    <BarChart3 className="w-4 h-4 text-purple-600" />
                    <span>C. Bagi Dinas Pertanian & Pemerintah Daerah</span>
                  </div>
                  <ul className="text-xs text-slate-700 space-y-1.5 list-disc list-inside">
                    <li><strong>Executive Supply Dashboard:</strong> Mengetahui estimasi total panen (Tonase) komoditas strategis per kecamatan/kabupaten.</li>
                    <li><strong>Early Warning System (EWS):</strong> Menerima peringatan otomatis apabila pasokan cabai rawit atau bawang diproyeksikan defisit.</li>
                    <li><strong>Simulasi Intervensi Pasar:</strong> Menguji efektivitas operasi pasar murah dan subsidi ongkos angkut sebelum anggaran dicairkan.</li>
                    <li><strong>Satu Data Pertanian (Single Source of Truth):</strong> Sinkron langsung dengan Google Sheets yang dapat diaudit oleh BPS atau Kementan.</li>
                  </ul>
                </div>

                {/* Data Scientist */}
                <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/40">
                  <div className="flex items-center space-x-2 text-indigo-800 font-bold text-xs sm:text-sm mb-2">
                    <Cpu className="w-4 h-4 text-indigo-600" />
                    <span>D. Bagi Data Scientist & Analis Ketahanan Pangan</span>
                  </div>
                  <ul className="text-xs text-slate-700 space-y-1.5 list-disc list-inside">
                    <li><strong>Dataset Bersih Siap Pakai:</strong> Berkat validasi 4-tier, data lapangan tidak memiliki entri kosong atau ambigu.</li>
                    <li><strong>Model Prediksi Regresi Panen:</strong> Menghitung rasio yield per hektar berdasarkan varietas benih dan zona geografis.</li>
                    <li><strong>Open Webhook Architecture:</strong> Mudah diintegrasikan dengan sensor IoT cuaca, drone pertanian, atau citra satelit Sentinel.</li>
                    <li><strong>Analisis Spasial Komoditas:</strong> Mengidentifikasi kluster sentra komoditas potensial baru di Jawa Barat & Jawa Tengah.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 4: DATABASE & GOOGLE SHEETS */}
          {(activeSection === 'database' || activeSection === 'flowchart' || activeSection === 'architecture' || activeSection === 'utilities') && (
            <div className={`space-y-4 ${activeSection !== 'database' ? 'hidden print:block' : ''}`}>
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center space-x-2">
                  <Database className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-bold text-slate-900 text-base">4. Kamus Data & Pemetaan Dua Arah Google Sheets</h3>
                </div>
                <span className="text-xs text-slate-500 font-mono">Database Schema</span>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="min-w-full text-left text-xs divide-y divide-slate-200">
                  <thead className="bg-slate-50 text-slate-700 font-bold">
                    <tr>
                      <th className="px-3 py-2.5">Field</th>
                      <th className="px-3 py-2.5">Tipe</th>
                      <th className="px-3 py-2.5">Kolom Google Sheets</th>
                      <th className="px-3 py-2.5">Aturan Validasi & Deskripsi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-600">
                    <tr className="bg-white">
                      <td className="px-3 py-2 font-mono font-bold text-emerald-700">id</td>
                      <td className="px-3 py-2">String</td>
                      <td className="px-3 py-2">Kolom A (ID Registrasi)</td>
                      <td className="px-3 py-2">Format TANI-001 s/d TANI-999, berurutan otomatis</td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td className="px-3 py-2 font-mono font-bold text-emerald-700">nama</td>
                      <td className="px-3 py-2">String</td>
                      <td className="px-3 py-2">Kolom C (Nama Petani)</td>
                      <td className="px-3 py-2">Wajib &gt; 2 karakter, tidak boleh placeholder generik</td>
                    </tr>
                    <tr className="bg-white">
                      <td className="px-3 py-2 font-mono font-bold text-emerald-700">komoditas</td>
                      <td className="px-3 py-2">String</td>
                      <td className="px-3 py-2">Kolom H (Komoditas)</td>
                      <td className="px-3 py-2">Padi, Cabai Rawit, Bawang Merah, Jagung Hibrida, dll.</td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td className="px-3 py-2 font-mono font-bold text-emerald-700">luasLahan</td>
                      <td className="px-3 py-2">Float</td>
                      <td className="px-3 py-2">Kolom G (Luas Lahan Ha)</td>
                      <td className="px-3 py-2">Angka riil dalam Hektar (otomatis konversi dari m²/ru/bata)</td>
                    </tr>
                    <tr className="bg-white">
                      <td className="px-3 py-2 font-mono font-bold text-emerald-700">kabupaten</td>
                      <td className="px-3 py-2">String</td>
                      <td className="px-3 py-2">Kolom F (Kabupaten)</td>
                      <td className="px-3 py-2">Wilayah administratif untuk pemetaan geospasial dinas</td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td className="px-3 py-2 font-mono font-bold text-emerald-700">estimasiHasilTon</td>
                      <td className="px-3 py-2">Float</td>
                      <td className="px-3 py-2">Kolom K (Estimasi Ton)</td>
                      <td className="px-3 py-2">Dihitung otomatis: Luas × Rasio Produktivitas Komoditas</td>
                    </tr>
                    <tr className="bg-white">
                      <td className="px-3 py-2 font-mono font-bold text-emerald-700">statusVerifikasi</td>
                      <td className="px-3 py-2">Enum</td>
                      <td className="px-3 py-2">Kolom L (Verifikasi)</td>
                      <td className="px-3 py-2">"Terverifikasi" (oleh Admin PPL) / "Menunggu Verifikasi"</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Footer Bar */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 print:hidden">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Dokumen Teknis Siap Cetak & Pitching Investor / Dinas Pertanian</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isGeneratingPdf ? 'Memproses PDF...' : 'Download File PDF (.pdf)'}</span>
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-medium transition cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
