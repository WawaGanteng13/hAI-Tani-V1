import React, { useState } from 'react';
import {
  X,
  Download,
  Copy,
  ExternalLink,
  Check,
  Search,
  Filter,
  RefreshCw,
  FileSpreadsheet,
  Plus,
  Share2,
  Table as TableIcon,
  HelpCircle,
} from 'lucide-react';
import { FarmerRecord } from '../types';

interface GoogleSheetsOnlineModalProps {
  isOpen: boolean;
  onClose: () => void;
  farmers: FarmerRecord[];
  onRefresh: () => void;
}

export const GoogleSheetsOnlineModal: React.FC<GoogleSheetsOnlineModalProps> = ({
  isOpen,
  onClose,
  farmers,
  onRefresh,
}) => {
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: string; val: string }>({
    row: 2,
    col: 'C',
    val: farmers[0]?.nama || '',
  });
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const totalLuas = farmers.reduce((acc, f) => acc + (f.luasLahan || 0), 0);
  const totalTon = farmers.reduce((acc, f) => acc + (f.estimasiHasilTon || 0), 0);

  const filteredFarmers = farmers.filter(
    (f) =>
      f.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.komoditas.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.kabupaten && f.kabupaten.toLowerCase().includes(searchQuery.toLowerCase())) ||
      f.alamat.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCopyTSV = () => {
    const headers = [
      'ID Petani',
      'Waktu Registrasi',
      'Nama Petani',
      'No. WhatsApp',
      'Alamat / Desa',
      'Kabupaten',
      'Luas Lahan (Ha)',
      'Komoditas',
      'Varietas',
      'Estimasi Panen',
      'Estimasi Hasil (Ton)',
      'Status Verifikasi',
      'Catatan AI Rekomendasi',
    ];

    const rows = farmers.map((f) => [
      f.id,
      f.timestamp,
      f.nama,
      f.noHp,
      f.alamat,
      f.kabupaten || '',
      f.luasLahan,
      f.komoditas,
      f.varietas || '',
      f.estimasiPanen,
      f.estimasiHasilTon,
      f.statusVerifikasi,
      f.catatanAI || '',
    ]);

    const tsvContent = [headers.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n');
    navigator.clipboard.writeText(tsvContent);
    setCopied(true);
    setNoticeMessage('✅ Seluruh baris data tabel berhasil disalin ke clipboard! Siap di-paste (Ctrl+V) langsung ke Google Sheets.');
    setTimeout(() => {
      setCopied(false);
      setNoticeMessage(null);
    }, 4000);
  };

  const handleOpenLiveWebSheets = () => {
    window.open('/api/sheets/live-view', '_blank');
  };

  const handleCopyImportFormula = () => {
    const origin = window.location.origin;
    const formula = `=IMPORTDATA("${origin}/api/sheets/export.csv")`;
    navigator.clipboard.writeText(formula);
    setNoticeMessage(`✅ Rumus Live Sync berhasil disalin: ${formula} — Tempelkan di sel A1 Google Sheets.`);
    setTimeout(() => setNoticeMessage(null), 5000);
  };

  const handleOpenDocsGoogle = () => {
    handleCopyTSV();
    const origin = window.location.origin;
    const formula = `=IMPORTDATA("${origin}/api/sheets/export.csv")`;
    setNoticeMessage(
      `🌐 Membuka Google Sheets baru... Data sudah di clipboard (Ctrl+V di sel A1) atau gunakan rumus: ${formula}`
    );
    window.open('https://docs.google.com/spreadsheets/create', '_blank');
    setTimeout(() => setNoticeMessage(null), 7000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-7xl shadow-2xl border border-slate-300 flex flex-col h-[92vh] overflow-hidden">
        {/* Google Sheets Brand Top Header */}
        <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold shadow-sm">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-800 text-base">Petani_TaniAI_2026</span>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-300">
                  Google Sheets Live Sync
                </span>
              </div>
              {/* Fake Google Sheets Menus */}
              <div className="flex items-center space-x-3 text-xs text-slate-600 mt-0.5 font-normal">
                <span className="hover:text-emerald-700 cursor-pointer">File</span>
                <span className="hover:text-emerald-700 cursor-pointer">Edit</span>
                <span className="hover:text-emerald-700 cursor-pointer">Tampilan</span>
                <span className="hover:text-emerald-700 cursor-pointer">Sisipkan</span>
                <span className="hover:text-emerald-700 cursor-pointer">Format</span>
                <span className="hover:text-emerald-700 cursor-pointer">Data</span>
                <span className="hover:text-emerald-700 cursor-pointer">Alat</span>
                <span className="hover:text-emerald-700 cursor-pointer">Ekstensi</span>
                <span className="text-slate-400 text-[11px] ml-2 hidden md:inline">
                  Tersimpan otomatis ke Google Drive Cloud
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopyTSV}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition cursor-pointer"
              title="Salin tabel untuk langsung dipaste (Ctrl+V) ke Google Sheets baru"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copied ? 'Tersalin!' : 'Salin TSV'}</span>
            </button>

            <button
              onClick={handleCopyImportFormula}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition cursor-pointer hidden md:flex"
              title="Salin rumus =IMPORTDATA untuk Google Sheets"
            >
              <span>Rumus =IMPORTDATA</span>
            </button>

            <a
              href="/api/sheets/export.csv"
              download
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh CSV</span>
            </a>

            {/* Primary Action: Opens the live web spreadsheet preloaded with full data */}
            <button
              onClick={handleOpenLiveWebSheets}
              className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition cursor-pointer"
              title="Membuka web spreadsheet live yang langsung terisi lengkap database petani"
            >
              <ExternalLink className="w-3.5 h-3.5 text-emerald-300" />
              <span>Buka di Google Sheets Web</span>
            </button>

            <button
              onClick={handleOpenDocsGoogle}
              className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium flex items-center space-x-1 transition cursor-pointer"
              title="Buka docs.google.com dengan panduan paste instan"
            >
              <span className="hidden lg:inline">Buka di docs.google.com</span>
              <span className="lg:hidden">docs.google</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notice Message Banner */}
        {noticeMessage && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 flex items-center justify-between text-xs text-emerald-900 animate-fadeIn">
            <span className="font-medium flex items-center space-x-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{noticeMessage}</span>
            </span>
            <button
              onClick={() => setNoticeMessage(null)}
              className="text-emerald-700 hover:text-emerald-950 text-xs ml-4 cursor-pointer font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Toolbar & Formula Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-3 w-full sm:w-auto">
            {/* Cell Coordinate Box */}
            <div className="bg-white border border-slate-300 rounded px-2.5 py-1 font-mono text-slate-700 font-semibold text-xs min-w-[50px] text-center shadow-2xs">
              {selectedCell.col}
              {selectedCell.row}
            </div>

            {/* Formula fx indicator */}
            <div className="flex items-center text-slate-400 font-serif italic text-sm select-none">
              fx
            </div>

            {/* Formula input text */}
            <div className="bg-white border border-slate-300 rounded px-3 py-1 text-slate-800 text-xs flex-1 sm:w-96 font-mono truncate shadow-2xs">
              {selectedCell.val}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari dalam spreadsheet..."
                className="pl-8 pr-3 py-1 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 w-48 sm:w-60"
              />
            </div>
            <button
              onClick={onRefresh}
              className="p-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
              title="Refresh data real-time"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Informative Banner */}
        <div className="bg-emerald-50/80 border-b border-emerald-200/80 px-4 py-1.5 flex items-center justify-between text-xs text-emerald-900">
          <div className="flex items-center space-x-2 truncate">
            <span className="font-semibold">📊 Lembar Kerja Aktif:</span>
            <span className="bg-emerald-200/70 text-emerald-900 px-2 py-0.5 rounded font-mono text-[11px]">
              Lahan_Petani_Master ({farmers.length} Baris Data Tersinkron)
            </span>
            <span className="hidden md:inline text-emerald-700 text-[11px]">
              &bull; Total Lahan: <strong>{totalLuas.toFixed(1)} Ha</strong> &bull; Total Panen: <strong>{totalTon.toFixed(1)} Ton</strong>
            </span>
          </div>
          <div className="text-[11px] text-emerald-700 hidden sm:block">
            Klik sel mana saja untuk melihat isi formula/teks
          </div>
        </div>

        {/* Spreadsheet Data Grid */}
        <div className="flex-1 overflow-auto bg-white select-text">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-300 sticky top-0 z-10">
                <th className="w-10 p-1.5 border-r border-slate-300 text-center bg-slate-200 font-mono text-[11px] select-none">
                  #
                </th>
                <th className="p-2 border-r border-slate-300 text-left min-w-[90px] font-mono">
                  <span className="text-[10px] text-slate-400 block font-normal">A</span>
                  ID Petani
                </th>
                <th className="p-2 border-r border-slate-300 text-left min-w-[130px] font-mono">
                  <span className="text-[10px] text-slate-400 block font-normal">B</span>
                  Waktu Registrasi
                </th>
                <th className="p-2 border-r border-slate-300 text-left min-w-[160px] font-mono">
                  <span className="text-[10px] text-slate-400 block font-normal">C</span>
                  Nama Petani
                </th>
                <th className="p-2 border-r border-slate-300 text-left min-w-[130px] font-mono">
                  <span className="text-[10px] text-slate-400 block font-normal">D</span>
                  Nomor WhatsApp
                </th>
                <th className="p-2 border-r border-slate-300 text-left min-w-[180px] font-mono">
                  <span className="text-[10px] text-slate-400 block font-normal">E</span>
                  Alamat / Desa
                </th>
                <th className="p-2 border-r border-slate-300 text-left min-w-[120px] font-mono">
                  <span className="text-[10px] text-slate-400 block font-normal">F</span>
                  Kabupaten
                </th>
                <th className="p-2 border-r border-slate-300 text-right min-w-[100px] font-mono bg-emerald-50/40">
                  <span className="text-[10px] text-slate-400 block font-normal">G</span>
                  Luas Lahan (Ha)
                </th>
                <th className="p-2 border-r border-slate-300 text-left min-w-[140px] font-mono">
                  <span className="text-[10px] text-slate-400 block font-normal">H</span>
                  Komoditas
                </th>
                <th className="p-2 border-r border-slate-300 text-left min-w-[120px] font-mono">
                  <span className="text-[10px] text-slate-400 block font-normal">I</span>
                  Varietas
                </th>
                <th className="p-2 border-r border-slate-300 text-left min-w-[120px] font-mono">
                  <span className="text-[10px] text-slate-400 block font-normal">J</span>
                  Estimasi Panen
                </th>
                <th className="p-2 border-r border-slate-300 text-right min-w-[110px] font-mono bg-amber-50/40">
                  <span className="text-[10px] text-slate-400 block font-normal">K</span>
                  Hasil (Ton)
                </th>
                <th className="p-2 border-r border-slate-300 text-center min-w-[120px] font-mono">
                  <span className="text-[10px] text-slate-400 block font-normal">L</span>
                  Status Verifikasi
                </th>
                <th className="p-2 border-r border-slate-300 text-left min-w-[240px] font-mono">
                  <span className="text-[10px] text-slate-400 block font-normal">M</span>
                  Catatan AI Rekomendasi
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredFarmers.map((farmer, idx) => {
                const rowNum = idx + 2; // Row 1 is header
                return (
                  <tr
                    key={farmer.id}
                    className="hover:bg-emerald-50/30 border-b border-slate-200 transition-colors"
                  >
                    <td className="p-1.5 border-r border-slate-300 text-center bg-slate-100 text-slate-500 font-mono text-[11px] select-none font-semibold">
                      {rowNum}
                    </td>

                    {/* Col A: ID */}
                    <td
                      onClick={() => setSelectedCell({ row: rowNum, col: 'A', val: farmer.id })}
                      className={`p-2 border-r border-slate-200 font-mono text-emerald-700 font-semibold cursor-pointer ${
                        selectedCell.row === rowNum && selectedCell.col === 'A'
                          ? 'bg-emerald-100/80 outline-2 outline-emerald-600'
                          : ''
                      }`}
                    >
                      {farmer.id}
                    </td>

                    {/* Col B: Timestamp */}
                    <td
                      onClick={() => setSelectedCell({ row: rowNum, col: 'B', val: farmer.timestamp })}
                      className={`p-2 border-r border-slate-200 text-slate-500 text-[11px] cursor-pointer ${
                        selectedCell.row === rowNum && selectedCell.col === 'B'
                          ? 'bg-emerald-100/80 outline-2 outline-emerald-600'
                          : ''
                      }`}
                    >
                      {farmer.timestamp}
                    </td>

                    {/* Col C: Nama */}
                    <td
                      onClick={() => setSelectedCell({ row: rowNum, col: 'C', val: farmer.nama })}
                      className={`p-2 border-r border-slate-200 font-medium text-slate-900 cursor-pointer ${
                        selectedCell.row === rowNum && selectedCell.col === 'C'
                          ? 'bg-emerald-100/80 outline-2 outline-emerald-600'
                          : ''
                      }`}
                    >
                      {farmer.nama}
                    </td>

                    {/* Col D: No HP */}
                    <td
                      onClick={() => setSelectedCell({ row: rowNum, col: 'D', val: farmer.noHp })}
                      className={`p-2 border-r border-slate-200 font-mono text-slate-600 cursor-pointer ${
                        selectedCell.row === rowNum && selectedCell.col === 'D'
                          ? 'bg-emerald-100/80 outline-2 outline-emerald-600'
                          : ''
                      }`}
                    >
                      {farmer.noHp}
                    </td>

                    {/* Col E: Alamat */}
                    <td
                      onClick={() => setSelectedCell({ row: rowNum, col: 'E', val: farmer.alamat })}
                      className={`p-2 border-r border-slate-200 text-slate-700 truncate max-w-xs cursor-pointer ${
                        selectedCell.row === rowNum && selectedCell.col === 'E'
                          ? 'bg-emerald-100/80 outline-2 outline-emerald-600'
                          : ''
                      }`}
                    >
                      {farmer.alamat}
                    </td>

                    {/* Col F: Kabupaten */}
                    <td
                      onClick={() => setSelectedCell({ row: rowNum, col: 'F', val: farmer.kabupaten || '' })}
                      className={`p-2 border-r border-slate-200 text-slate-700 cursor-pointer ${
                        selectedCell.row === rowNum && selectedCell.col === 'F'
                          ? 'bg-emerald-100/80 outline-2 outline-emerald-600'
                          : ''
                      }`}
                    >
                      {farmer.kabupaten || '—'}
                    </td>

                    {/* Col G: Luas Lahan */}
                    <td
                      onClick={() =>
                        setSelectedCell({
                          row: rowNum,
                          col: 'G',
                          val: `${farmer.luasLahan}`,
                        })
                      }
                      className={`p-2 border-r border-slate-200 text-right font-mono font-semibold text-emerald-800 bg-emerald-50/20 cursor-pointer ${
                        selectedCell.row === rowNum && selectedCell.col === 'G'
                          ? 'bg-emerald-100/80 outline-2 outline-emerald-600'
                          : ''
                      }`}
                    >
                      {farmer.luasLahan.toFixed(1)}
                    </td>

                    {/* Col H: Komoditas */}
                    <td
                      onClick={() => setSelectedCell({ row: rowNum, col: 'H', val: farmer.komoditas })}
                      className={`p-2 border-r border-slate-200 font-medium text-slate-800 cursor-pointer ${
                        selectedCell.row === rowNum && selectedCell.col === 'H'
                          ? 'bg-emerald-100/80 outline-2 outline-emerald-600'
                          : ''
                      }`}
                    >
                      {farmer.komoditas}
                    </td>

                    {/* Col I: Varietas */}
                    <td
                      onClick={() => setSelectedCell({ row: rowNum, col: 'I', val: farmer.varietas || '' })}
                      className={`p-2 border-r border-slate-200 text-slate-600 cursor-pointer ${
                        selectedCell.row === rowNum && selectedCell.col === 'I'
                          ? 'bg-emerald-100/80 outline-2 outline-emerald-600'
                          : ''
                      }`}
                    >
                      {farmer.varietas || '—'}
                    </td>

                    {/* Col J: Estimasi Panen */}
                    <td
                      onClick={() => setSelectedCell({ row: rowNum, col: 'J', val: farmer.estimasiPanen })}
                      className={`p-2 border-r border-slate-200 text-slate-700 cursor-pointer ${
                        selectedCell.row === rowNum && selectedCell.col === 'J'
                          ? 'bg-emerald-100/80 outline-2 outline-emerald-600'
                          : ''
                      }`}
                    >
                      {farmer.estimasiPanen}
                    </td>

                    {/* Col K: Estimasi Hasil (Ton) */}
                    <td
                      onClick={() =>
                        setSelectedCell({
                          row: rowNum,
                          col: 'K',
                          val: `${farmer.estimasiHasilTon}`,
                        })
                      }
                      className={`p-2 border-r border-slate-200 text-right font-mono font-semibold text-amber-800 bg-amber-50/20 cursor-pointer ${
                        selectedCell.row === rowNum && selectedCell.col === 'K'
                          ? 'bg-emerald-100/80 outline-2 outline-emerald-600'
                          : ''
                      }`}
                    >
                      {farmer.estimasiHasilTon.toFixed(1)}
                    </td>

                    {/* Col L: Status */}
                    <td
                      onClick={() => setSelectedCell({ row: rowNum, col: 'L', val: farmer.statusVerifikasi })}
                      className={`p-2 border-r border-slate-200 text-center cursor-pointer ${
                        selectedCell.row === rowNum && selectedCell.col === 'L'
                          ? 'bg-emerald-100/80 outline-2 outline-emerald-600'
                          : ''
                      }`}
                    >
                      <span className="inline-block px-2 py-0.5 text-[10px] font-semibold rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {farmer.statusVerifikasi}
                      </span>
                    </td>

                    {/* Col M: Catatan AI */}
                    <td
                      onClick={() => setSelectedCell({ row: rowNum, col: 'M', val: farmer.catatanAI || '' })}
                      className={`p-2 border-r border-slate-200 text-slate-600 truncate max-w-sm cursor-pointer ${
                        selectedCell.row === rowNum && selectedCell.col === 'M'
                          ? 'bg-emerald-100/80 outline-2 outline-emerald-600'
                          : ''
                      }`}
                    >
                      {farmer.catatanAI || '—'}
                    </td>
                  </tr>
                );
              })}

              {/* Total Formula Row (Row N+1) */}
              <tr className="bg-slate-100/90 font-bold border-t-2 border-slate-300 text-slate-800">
                <td className="p-1.5 border-r border-slate-300 text-center bg-slate-200 font-mono text-[11px] select-none">
                  {filteredFarmers.length + 2}
                </td>
                <td className="p-2 border-r border-slate-200 font-mono text-emerald-800" colSpan={5}>
                  ∑ FORMULA TOTAL REKAPITULASI ( =SUM )
                </td>
                <td className="p-2 border-r border-slate-200 text-right font-mono text-slate-500 text-[10px]">
                  Ha (Total)
                </td>
                <td
                  onClick={() =>
                    setSelectedCell({
                      row: filteredFarmers.length + 2,
                      col: 'G',
                      val: `=SUM(G2:G${filteredFarmers.length + 1}) [Hasil: ${totalLuas.toFixed(1)} Ha]`,
                    })
                  }
                  className="p-2 border-r border-slate-200 text-right font-mono text-emerald-900 bg-emerald-100/70 cursor-pointer"
                >
                  {totalLuas.toFixed(1)} Ha
                </td>
                <td className="p-2 border-r border-slate-200" colSpan={3}>
                  Rata-rata Lahan: {(totalLuas / (farmers.length || 1)).toFixed(2)} Ha/Petani
                </td>
                <td
                  onClick={() =>
                    setSelectedCell({
                      row: filteredFarmers.length + 2,
                      col: 'K',
                      val: `=SUM(K2:K${filteredFarmers.length + 1}) [Hasil: ${totalTon.toFixed(1)} Ton]`,
                    })
                  }
                  className="p-2 border-r border-slate-200 text-right font-mono text-amber-900 bg-amber-100/70 cursor-pointer"
                >
                  {totalTon.toFixed(1)} Ton
                </td>
                <td className="p-2 border-r border-slate-200 text-center text-slate-500 text-[11px]" colSpan={2}>
                  Data Scientist Ready
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer Tabs Bar (Like Google Sheets bottom) */}
        <div className="bg-slate-100 border-t border-slate-200 px-4 py-1.5 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-1">
            <button className="p-1 hover:bg-slate-200 rounded text-slate-600">
              <Plus className="w-3.5 h-3.5" />
            </button>
            <div className="bg-white border-t-2 border-emerald-600 px-3 py-1 text-xs font-semibold text-slate-800 rounded-t shadow-xs flex items-center space-x-2">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Lahan_Petani_Master</span>
            </div>
            <div className="px-3 py-1 text-xs text-slate-500 hover:bg-slate-200 rounded cursor-pointer hidden sm:block">
              Rekap_Komoditas
            </div>
            <div className="px-3 py-1 text-xs text-slate-500 hover:bg-slate-200 rounded cursor-pointer hidden sm:block">
              Analisis_Harga_HAP
            </div>
          </div>

          <div className="text-[11px] text-slate-500 flex items-center space-x-2">
            <span>
              Menampilkan {filteredFarmers.length} dari {farmers.length} baris data
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
