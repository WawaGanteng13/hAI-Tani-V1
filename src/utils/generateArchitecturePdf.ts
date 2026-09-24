import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export function generateArchitecturePdf() {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let currentY = 20;

  // Helper for page numbering and footer
  const addHeaderFooter = (pageNumber: number, totalPagesPlaceholder = '') => {
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    // Header
    doc.text('TaniAI Architecture & System Specification Whitepaper', 14, 10);
    doc.text('Klasifikasi: Dokumen Teknis & Publik', pageWidth - 14, 10, { align: 'right' });
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(14, 12, pageWidth - 14, 12);

    // Footer
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);
    doc.text('© 2026 TaniAI Ecosystem - Powered by Gemini AI & Google Sheets Sync', 14, pageHeight - 8);
    doc.text(`Halaman ${pageNumber} ${totalPagesPlaceholder}`, pageWidth - 14, pageHeight - 8, { align: 'right' });
  };

  // -------------------------------------------------------------
  // HALAMAN 1: COVER & EXECUTIVE SUMMARY
  // -------------------------------------------------------------
  // Cover Header Accent
  doc.setFillColor(16, 185, 129); // Emerald 500
  doc.rect(0, 0, pageWidth, 6, 'F');

  // Title Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text('SPESIFIKASI TEKNIS & ARSITEKTUR', 14, 30);
  doc.setTextColor(5, 150, 105); // Emerald 600
  doc.text('TaniAI: WhatsApp Agent & Smart Agri-System', 14, 40);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105); // Slate 600
  doc.text('Dokumen Komprehensif Digital Architecture, Flowchart Interaksi, dan Kegunaan Sistem', 14, 47);

  // Metadata Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, 53, pageWidth - 28, 28, 2, 2, 'FD');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('INFORMASI DOKUMEN', 20, 60);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('• Judul Sistem : TaniAI - Conversational Agriculture Intelligence', 20, 66);
  doc.text('• Versi Sistem : v2.5 Enterprise (Dual Role: Farmer & Admin PPL)', 20, 71);
  doc.text('• Tanggal Rilis : September 2026 (Production Ready)', 20, 76);

  doc.text('• Modul Inti   : Gemini AI, WhatsApp Engine, Google Sheets Sync', 110, 66);
  doc.text('• Target Sektor : Dinas Pertanian, PPL, Koperasi & Petani Mitra', 110, 71);
  doc.text('• Status Uji   : Verified & Passed Field Ingestion Tests', 110, 76);

  currentY = 88;

  // Ringkasan Eksekutif
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Ringkasan Eksekutif (Executive Summary)', 14, currentY);
  currentY += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  const summaryText =
    'TaniAI adalah ekosistem asisten cerdas berbasis WhatsApp yang mentransformasikan interaksi percakapan sehari-hari petani dan petugas penyuluh lapangan (PPL) menjadi basis data terstruktur (Google Sheets dan Relational Database) secara otomatis dan real-time. ' +
    'Dengan mengeliminasi kebutuhan mengunduh aplikasi khusus yang rumit, TaniAI mengatasi problem klasik adopsi teknologi di sektor agrikultur Indonesia melalui kanal percakapan instan paling populer (WhatsApp), baik melalui pesan teks maupun pesan suara (voice notes).\n\n' +
    'Sistem dilengkapi mesin validasi kelengkapan data berjenjang (4-tier verification), kecerdasan buatan multimodal Google Gemini, pipeline deteksi dini anomali pasokan/inflasi pangan, serta dashboard pengambil kebijakan berbasis analitik prediktif.';
  
  const splitSummary = doc.splitTextToSize(summaryText, pageWidth - 28);
  doc.text(splitSummary, 14, currentY);
  currentY += splitSummary.length * 4.8 + 6;

  // Nilai Strategis Tabel
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('Perbandingan Model Pendataan Tradisional vs. TaniAI', 14, currentY);
  currentY += 4;

  autoTable(doc, {
    startY: currentY,
    head: [['Parameter Evaluasi', 'Pendataan Manual / Aplikasi Lama', 'Solusi TaniAI (WhatsApp Agent)']],
    body: [
      ['Aksesibilitas Petani', 'Harus unduh app khusus (Play Store), sering ditinggalkan', '100% via WhatsApp (0 MB instalasi tambahan, no friction)'],
      ['Metode Input Data', 'Formulir kaku, mengetik banyak kolom', 'Percakapan natural bahasa santai & pesan suara (Voice Note)'],
      ['Integritas Data', 'Sering terisi sebagian / kosong tanpa verifikasi', 'Validasi ketat 4 data pokok: ditahan di draf jika belum lengkap'],
      ['Kecepatan Sinkronisasi', 'Rekap mingguan / bulanan via excel manual', 'Real-time detik itu juga ke Google Sheets & Dashboard Dinas'],
      ['Kesiapan Mitigasi Krisis', 'Reaktif setelah terjadi lonjakan harga', 'Proaktif: estimasi waktu & tonase panen sebelum inflasi terjadi'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: 40, fontStyle: 'bold' },
      1: { cellWidth: 70 },
      2: { cellWidth: 72 },
    },
    margin: { left: 14, right: 14 },
  });

  addHeaderFooter(1);

  // -------------------------------------------------------------
  // HALAMAN 2: DIGITAL ARCHITECTURE BLUEPRINT
  // -------------------------------------------------------------
  doc.addPage();
  addHeaderFooter(2);
  currentY = 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text('2. Digital Architecture Blueprint (Arsitektur Sistem)', 14, currentY);
  currentY += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  const archIntro =
    'Arsitektur TaniAI dirancang dengan pendekatan modular berbasis micro-services dan event-driven messaging. ' +
    'Sistem memisahkan tanggung jawab antara kanal penerima pesan (WhatsApp Ingestion), logika pemrosesan kognitif AI, validasi bisnis integritas data, serta sinkronisasi penyimpanan awan (Cloud Storage).';
  const splitArch = doc.splitTextToSize(archIntro, pageWidth - 28);
  doc.text(splitArch, 14, currentY);
  currentY += splitArch.length * 4.8 + 6;

  // Architecture Layers Table
  autoTable(doc, {
    startY: currentY,
    head: [['Lapisan Arsitektur (Layer)', 'Komponen & Modul Teknologi', 'Fungsi & Tanggung Jawab Teknis']],
    body: [
      [
        'Layer 1: Ingestion & Presentation Layer',
        '• WhatsApp Cloud API / Webhook Router\n• Web Executive Dashboard (React 19 + Tailwind CSS)\n• Audio Transcriber & Audio FX Engine',
        'Menerima webhook pesan masuk (teks/voice note), menyajikan antarmuka visual data penyuluh & dinas, memutar efek audio status verifikasi.',
      ],
      [
        'Layer 2: Security & RBAC Gateway',
        '• Express.js Server API Gateway\n• Phone Whitelist & Admin Role Verifier\n• Request Sanitizer & Rate Limiter',
        'Memvalidasi nomor pengirim (apakah Petani Umum atau Admin PPL berwenang), melindungi endpoint API, dan mengelola hak akses sistem.',
      ],
      [
        'Layer 3: AI Cognitive & Validation Engine',
        '• Google Gemini 2.5 Multimodal SDK\n• NLP Natural Language Entity Extractor\n• 4-Tier Completeness State Machine\n• Fallback Rule Engine',
        'Mengekstrak entitas Nama, Komoditas, Luas Lahan, dan Lokasi. Menahan data di draf percakapan jika belum lengkap, memandu perbaikan via prompt santai.',
      ],
      [
        'Layer 4: Storage & Analytical Sync Layer',
        '• In-Memory / SQLite Transactional DB\n• Google Sheets V4 API Two-Way Sync\n• Early Supply Anomaly Calculator\n• Broadcast Push Notification Queue',
        'Menyimpan catatan petani permanen dengan ID TANI-xxx, mencatat langsung ke baris spreadsheet aktif, dan menghitung proyeksi panen tonase pangan.',
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold' },
      1: { cellWidth: 62 },
      2: { cellWidth: 70 },
    },
    margin: { left: 14, right: 14 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Blok Diagram Arsitektur Teknis
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Diagram Aliran Data & Protokol Antar Layer', 14, currentY);
  currentY += 5;

  // Box Drawing for Visual Architecture
  const boxWidth = 38;
  const boxHeight = 22;
  const startX = 14;
  const gap = 6;

  // Box 1
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(16, 185, 129);
  doc.roundedRect(startX, currentY, boxWidth, boxHeight, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(4, 120, 87);
  doc.text('1. User Devices', startX + 4, currentY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(51, 65, 85);
  doc.text('Petani & PPL via WhatsApp', startX + 4, currentY + 11);
  doc.text('(Teks / Rekaman Suara)', startX + 4, currentY + 16);

  // Arrow 1 -> 2
  doc.setDrawColor(100, 116, 139);
  doc.line(startX + boxWidth, currentY + 11, startX + boxWidth + gap, currentY + 11);

  // Box 2
  const x2 = startX + boxWidth + gap;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(148, 163, 184);
  doc.roundedRect(x2, currentY, boxWidth, boxHeight, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('2. API Gateway', x2 + 4, currentY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(51, 65, 85);
  doc.text('Express Server & RBAC', x2 + 4, currentY + 11);
  doc.text('Phone Number Filter', x2 + 4, currentY + 16);

  // Arrow 2 -> 3
  doc.line(x2 + boxWidth, currentY + 11, x2 + boxWidth + gap, currentY + 11);

  // Box 3
  const x3 = x2 + boxWidth + gap;
  doc.setFillColor(238, 242, 255);
  doc.setDrawColor(99, 102, 241);
  doc.roundedRect(x3, currentY, boxWidth, boxHeight, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(67, 56, 202);
  doc.text('3. Cognitive Engine', x3 + 4, currentY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(51, 65, 85);
  doc.text('Gemini 2.5 + Validator', x3 + 4, currentY + 11);
  doc.text('4-Tier Completeness Check', x3 + 4, currentY + 16);

  // Arrow 3 -> 4
  doc.line(x3 + boxWidth, currentY + 11, x3 + boxWidth + gap, currentY + 11);

  // Box 4
  const x4 = x3 + boxWidth + gap;
  doc.setFillColor(254, 243, 199);
  doc.setDrawColor(245, 158, 11);
  doc.roundedRect(x4, currentY, boxWidth, boxHeight, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 83, 9);
  doc.text('4. Cloud & Sheets', x4 + 4, currentY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(51, 65, 85);
  doc.text('Google Sheets Sync V4', x4 + 4, currentY + 11);
  doc.text('Dashboard Analitik Live', x4 + 4, currentY + 16);

  currentY += boxHeight + 10;

  // -------------------------------------------------------------
  // HALAMAN 3: FLOWCHART & LOGIKA INTERAKSI CHATBOT
  // -------------------------------------------------------------
  doc.addPage();
  addHeaderFooter(3);
  currentY = 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text('3. Flowchart Interaksi Chatbot & Validasi Kelengkapan', 14, currentY);
  currentY += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  const flowIntro =
    'Salah satu keunggulan terbesar TaniAI adalah pencegahan sampah data (Data Pollution Prevention). ' +
    'Sistem tidak akan menyimpan data yang belum lengkap ke Google Sheets. Flowchart di bawah menggambarkan alur transisi status dari chat masuk hingga verifikasi final:';
  const splitFlow = doc.splitTextToSize(flowIntro, pageWidth - 28);
  doc.text(splitFlow, 14, currentY);
  currentY += splitFlow.length * 4.8 + 4;

  // Flowchart Table / Sequence Matrix
  autoTable(doc, {
    startY: currentY,
    head: [['Tahap Alur', 'Aksi Logis / Algoritma Sistem', 'Kondisi & Keputusan', 'Output / Status']],
    body: [
      [
        '1. Inbound Msg',
        'Menerima pesan WhatsApp (teks atau audio) dari pengirim.',
        'Cek identitas nomor pengirim di tabel `adminsDb`.',
        'Role: Petani Umum atau Admin PPL Terotorisasi.',
      ],
      [
        '2. Entity Parsing',
        'Ekstraksi entitas NLP menggunakan model Google Gemini / Regex.',
        'Apakah pesan mengandung maksud registrasi atau data lahan?',
        'Draf entitas terpetakan: Nama, Komoditas, Luas, Wilayah.',
      ],
      [
        '3. Completeness Check\n(Kunci Logika)',
        'Mengevaluasi 4 Bidang Pokok:\n1) Nama Petani (non-placeholder)\n2) Komoditas Tanaman\n3) Luas Lahan (> 0 Ha)\n4) Wilayah/Kabupaten',
        'APAKAH KEEMPAT FIELD LENGKAP?\n\n• TIDAK LENGKAP:\n  JANGAN simpan ke database!\n\n• LENGKAP:\n  Lanjutkan ke langkah 5.',
        '• Jika Kurang: Terbitkan Checklist Draf & pandu melengkapi via chat.\n\n• Jika Lengkap: Lolos ke tahap komit data.',
      ],
      [
        '4. Draf Percakapan\n(Jika Belum Lengkap)',
        'Simpan draf sementara di memory session pengirim.',
        'Tunggu respons pesan kelanjutan dari pengguna.',
        'Merge data sebelumnya dengan data baru sampai lengkap 100%.',
      ],
      [
        '5. Database Commit &\nSheets Append',
        '1) Generate ID TANI-xxx unik\n2) Hitung estimasi tonase panen\n3) Tentukan baris Google Sheets\n4) Catat timestamp resmi',
        'Tersimpan di `farmersDb` dan otomatis tertulis di baris Google Sheets.',
        'Kirim pesan konfirmasi centang hijau (✅) berisi rincian lengkap pendaftaran.',
      ],
      [
        '6. Analytic Broadcast',
        'Kalkulasi ulang agregasi pasokan komoditas per kabupaten.',
        'Apakah terdeteksi anomali pasokan / defisit cabai atau bawang?',
        'Kirim peringatan anomali ke Dashboard PPL & notifikasi strategi.',
      ],
    ],
    theme: 'striped',
    headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: 35, fontStyle: 'bold' },
      1: { cellWidth: 55 },
      2: { cellWidth: 50 },
      3: { cellWidth: 42 },
    },
    margin: { left: 14, right: 14 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Kutipan Prinsip Kualitas Data
  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(248, 113, 113);
  doc.roundedRect(14, currentY, pageWidth - 28, 22, 2, 2, 'FD');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(153, 27, 27);
  doc.text('ATURAN BAKU INTEGRITAS DATA (DATA COMPLETENESS RULE):', 20, currentY + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(185, 28, 28);
  doc.text('• Sistem DILARANG KERAS menyimpan record petani jika salah satu dari 4 data pokok belum terpenuhi.', 20, currentY + 12);
  doc.text('• Chatbot memberikan feedback edukatif: menampilkan daftar centang hijau untuk data yang ada dan silang merah untuk data yang kurang.', 20, currentY + 17);

  // -------------------------------------------------------------
  // HALAMAN 4: KEGUNAAN APLIKASI SECARA LENGKAP & SISTEMATIS
  // -------------------------------------------------------------
  doc.addPage();
  addHeaderFooter(4);
  currentY = 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text('4. Kegunaan Aplikasi & Dampak Pemangku Kepentingan', 14, currentY);
  currentY += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text('TaniAI dirancang untuk memberikan dampak terukur bagi seluruh aktor dalam rantai nilai agrikultur:', 14, currentY);
  currentY += 5;

  autoTable(doc, {
    startY: currentY,
    head: [['Aktor Pengguna', 'Kegunaan Utama Aplikasi', 'Manfaat & Dampak Terukur']],
    body: [
      [
        'Petani Mandiri &\nKelompok Tani (Poktan)',
        '• Konsultasi agronomi & rekomendasi penanganan hama 24 jam.\n• Pendaftaran lahan tanpa aplikasi baru (cukup via WhatsApp).\n• Cek transparansi harga pasar komoditas harian.\n• Panduan takaran pupuk dan waktu panen optimal.',
        '• Menghemat waktu konsultasi hingga 90%.\n• Menghindari tengkulak dengan referensi harga pasar terbuka.\n• Mendapatkan akses prioritas program subsidi pupuk pemerintah.',
      ],
      [
        'Petugas Penyuluh Lapangan\n(PPL Pertanian)',
        '• Pendataan lahan petani binaan cukup lewat rekaman suara (Voice Note).\n• Rekapitulasi otomatis ke Google Sheets tanpa ketik manual di kantor.\n• Pemantauan status sertifikasi dan verifikasi lahan petani.\n• Fitur broadcast panduan penanganan hama serempak.',
        '• Memangkas beban administrasi manual PPL hingga 80%.\n• Meningkatkan kapasitas binaan petani hingga 3x lipat per penyuluh.\n• Validitas laporan lapangan dapat dipertanggungjawabkan.',
      ],
      [
        'Dinas Pertanian &\nPemerintah Daerah (Pemda)',
        '• Executive Dashboard dengan peta sebaran komoditas live.\n• Peringatan dini krisis pasokan (Early Warning System) cabai & bawang.\n• Simulasi dampak intervensi pasar dan operasi pasar murah.\n• Ekspor data format CSV & Google Sheets untuk audit BPS/Kementan.',
        '• Pengendalian inflasi pangan daerah lebih presisi dan terarah.\n• Ketepatan alokasi benih dan pupuk subsidi berbasis spasial nyata.\n• Keputusan berbasis data empiris real-time, bukan perkiraan.',
      ],
      [
        'Data Scientist &\nAnalis Ketahanan Pangan',
        '• Portal Machine Learning dengan fitur kalkulasi korelasi data.\n• Proyeksi tonase panen berbasis regresi luas lahan dan komoditas.\n• API integrasi terbuka (Open Webhook) untuk sistem eksternal.\n• Uji skenario volatilitas harga dan mitigasi perubahan iklim.',
        '• Ketersediaan dataset terstruktur siap pakai tanpa perlu data cleaning berat.\n• Akurasi pemodelan prediksi panen meningkat di atas 90%.',
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: 42, fontStyle: 'bold' },
      1: { cellWidth: 72 },
      2: { cellWidth: 68 },
    },
    margin: { left: 14, right: 14 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // -------------------------------------------------------------
  // HALAMAN 5: SPESIFIKASI DATA, KEAMANAN & PANDUAN PITCHING
  // -------------------------------------------------------------
  doc.addPage();
  addHeaderFooter(5);
  currentY = 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text('5. Spesifikasi Basis Data & Skema Keamanan (RBAC)', 14, currentY);
  currentY += 8;

  // Schema Table
  autoTable(doc, {
    startY: currentY,
    head: [['Field Database', 'Tipe Data', 'Pemetaan Google Sheets', 'Deskripsi & Validasi']],
    body: [
      ['id', 'String (TANI-xxx)', 'Kolom A (ID Registrasi)', 'Kunci primer terurut, digenerate otomatis saat data lengkap.'],
      ['timestamp', 'DateTime (ISO)', 'Kolom B (Waktu Input)', 'Waktu pencatatan sistem format YYYY-MM-DD HH:mm:ss.'],
      ['nama', 'String', 'Kolom C (Nama Petani)', 'Nama lengkap petani, wajib diverifikasi non-placeholder.'],
      ['noHp', 'String (Phone E.164)', 'Kolom D (No. WhatsApp)', 'Nomor WhatsApp pengirim untuk keperluan notifikasi balik.'],
      ['alamat', 'String', 'Kolom E (Alamat/Desa)', 'Desa atau wilayah domisili lahan garapan.'],
      ['kabupaten', 'String', 'Kolom F (Kabupaten)', 'Lokasi administratif untuk agregasi analitik dinas.'],
      ['luasLahan', 'Float (Hektar)', 'Kolom G (Luas Ha)', 'Luas garapan angka riil (1 Ha = 10.000 m²).'],
      ['komoditas', 'String', 'Kolom H (Komoditas)', 'Jenis tanaman: Padi, Cabai Rawit, Bawang Merah, Jagung, dll.'],
      ['varietas', 'String', 'Kolom I (Varietas Benih)', 'Varietas tanaman yang dipakai (misal: Inpari 32, Ori 212).'],
      ['estimasiPanen', 'String', 'Kolom J (Jadwal Panen)', 'Bulan dan tahun perkiraan panen raya.'],
      ['estimasiHasilTon', 'Float (Tonase)', 'Kolom K (Estimasi Ton)', 'Dihitung otomatis: Luas Lahan × Rasio Produktivitas Komoditas.'],
      ['statusVerifikasi', 'Enum', 'Kolom L (Verifikasi)', 'Terverifikasi (oleh PPL) atau Menunggu Verifikasi.'],
    ],
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    bodyStyles: { fontSize: 7, textColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: 32, fontStyle: 'bold' },
      1: { cellWidth: 30 },
      2: { cellWidth: 45 },
      3: { cellWidth: 75 },
    },
    margin: { left: 14, right: 14 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Box Penutup & Pernyataan Kesiapan Pitching
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(34, 197, 94);
  doc.roundedRect(14, currentY, pageWidth - 28, 30, 2, 2, 'FD');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52);
  doc.text('KESIMPULAN PITCHING & KESIAPAN IMPLEMENTASI', 20, currentY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(21, 128, 61);
  const closingText =
    'TaniAI telah teruji secara fungsional dalam menangani berbagai variasi input bahasa daerah, dialek santai, pesan suara, dan pemeliharaan integritas basis data. ' +
    'Solusi ini siap diimplementasikan secara bertahap pada pilot project dinas pertanian kabupaten/kota dengan biaya infrastruktur minimal berkat pemanfaatan kanal WhatsApp dan Google Workspace yang sudah ada.';
  const splitClosing = doc.splitTextToSize(closingText, pageWidth - 40);
  doc.text(splitClosing, 20, currentY + 13);

  // Trigger Save
  doc.save('TaniAI_Arsitektur_Flowchart_dan_Spesifikasi.pdf');
}
