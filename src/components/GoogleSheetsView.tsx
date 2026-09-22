import React, { useState } from 'react';
import {
  Table,
  Search,
  Download,
  Plus,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Filter,
  FileSpreadsheet,
  Layers,
  Sparkles,
  Trash2,
  Share2,
  Copy,
  Eye,
} from 'lucide-react';
import { FarmerRecord } from '../types';
import { GoogleSheetsOnlineModal } from './GoogleSheetsOnlineModal';

interface GoogleSheetsViewProps {
  farmers: FarmerRecord[];
  onAddFarmer: () => void;
  onDeleteFarmer: (id: string) => void;
  onRefresh: () => void;
  loading: boolean;
}

export const GoogleSheetsView: React.FC<GoogleSheetsViewProps> = ({
  farmers,
  onAddFarmer,
  onDeleteFarmer,
  onRefresh,
  loading,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [commodityFilter, setCommodityFilter] = useState('Semua');
  const [isOnlineModalOpen, setIsOnlineModalOpen] = useState(false);

  // Filtered records
  const filteredFarmers = farmers.filter((f) => {
    const matchesSearch =
      f.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.alamat.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.kabupaten && f.kabupaten.toLowerCase().includes(searchQuery.toLowerCase())) ||
      f.komoditas.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCommodity =
      commodityFilter === 'Semua' ||
      f.komoditas.toLowerCase().includes(commodityFilter.toLowerCase());

    return matchesSearch && matchesCommodity;
  });

  // Calculate totals
  const totalLahan = farmers.reduce((acc, f) => acc + (f.luasLahan || 0), 0);
  const totalPanen = farmers.reduce((acc, f) => acc + (f.estimasiHasilTon || 0), 0);

  const handleExportCSV = () => {
    window.open('/api/sheets/export.csv', '_blank');
  };

  const handleOpenLiveWebSheets = () => {
    window.open('/api/sheets/live-view', '_blank');
  };

  const handleOpenGoogleSheets = () => {
    setIsOnlineModalOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto py-4 space-y-5">
      {/* Top Banner & Actions */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                <span>Database Petani & Lahan (Google Sheets Live)</span>
                <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-medium border border-emerald-300">
                  Real-Time Sync Active
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Data yang dihimpun otomatis dari WhatsApp Chatbot langsung disinkronkan ke baris spreadsheet untuk kebutuhan riset Data Scientist.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 transition cursor-pointer text-xs flex items-center space-x-1"
            title="Refresh data dari server"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 transition cursor-pointer text-xs font-semibold flex items-center space-x-1.5"
          >
            <Download className="w-4 h-4 text-emerald-700" />
            <span>Ekspor CSV</span>
          </button>

          <button
            onClick={handleOpenLiveWebSheets}
            className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white transition cursor-pointer text-xs font-semibold flex items-center space-x-1.5 shadow-sm"
            title="Buka web spreadsheet live di tab baru yang langsung terisi lengkap database petani"
          >
            <ExternalLink className="w-4 h-4 text-emerald-300" />
            <span>Buka di Google Sheets Web</span>
          </button>

          <button
            onClick={handleOpenGoogleSheets}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white transition cursor-pointer text-xs font-semibold flex items-center space-x-1.5 shadow-sm"
          >
            <Eye className="w-4 h-4 text-emerald-400" />
            <span>Pratinjau Spreadsheet</span>
          </button>

          <button
            onClick={onAddFarmer}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition cursor-pointer text-xs font-semibold flex items-center space-x-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Petani</span>
          </button>
        </div>
      </div>

      {/* Spreadsheet Formula Bar & Status Bar Simulation */}
      <div className="bg-slate-100 rounded-xl border border-slate-300 overflow-hidden shadow-inner">
        <div className="bg-slate-200/80 px-4 py-1.5 border-b border-slate-300 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center space-x-4">
            <span className="font-mono font-bold text-slate-700">TaniAI_Database_Master.gsheet</span>
            <span className="text-[11px] text-emerald-700 bg-emerald-100/80 px-2 py-0.2 rounded border border-emerald-300 flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
              <span>Semua perubahan disimpan ke Google Drive</span>
            </span>
          </div>
          <div className="flex items-center space-x-3 text-[11px]">
            <span>Total: <strong>{farmers.length} Baris</strong></span>
            <span>Total Lahan: <strong>{totalLahan.toFixed(1)} Ha</strong></span>
            <span>Estimasi Panen: <strong>{totalPanen.toFixed(1)} Ton</strong></span>
          </div>
        </div>

        {/* Formula Bar */}
        <div className="bg-white px-3 py-1.5 flex items-center space-x-2 border-b border-slate-200 text-xs">
          <span className="font-mono text-slate-400 font-bold px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200">
            fx
          </span>
          <span className="font-mono text-slate-600 truncate flex-1">
            =FILTER(TaniAI_Farmers!A2:M, TaniAI_Farmers!Status=&quot;Terverifikasi&quot;) &bull; Sinkronisasi otomatis dari Meta Cloud WhatsApp
          </span>
        </div>

        {/* Filters and search */}
        <div className="p-3 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-slate-200">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama, desa, komoditas..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <span className="text-xs text-slate-500 flex items-center space-x-1 shrink-0">
              <Filter className="w-3.5 h-3.5" />
              <span>Komoditas:</span>
            </span>
            <select
              value={commodityFilter}
              onChange={(e) => setCommodityFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="Semua">Semua Komoditas ({farmers.length})</option>
              <option value="Padi">Padi</option>
              <option value="Cabai">Cabai</option>
              <option value="Bawang">Bawang Merah</option>
              <option value="Jagung">Jagung</option>
            </select>
          </div>
        </div>

        {/* Spreadsheet Data Table */}
        <div className="overflow-x-auto bg-white">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 font-semibold text-[11px]">
                <th className="p-2 border-r border-slate-300 w-10 text-center bg-slate-200/70 text-slate-500 font-mono">#</th>
                <th className="p-2.5 border-r border-slate-200">ID Petani</th>
                <th className="p-2.5 border-r border-slate-200">Nama Petani</th>
                <th className="p-2.5 border-r border-slate-200">Kontak WhatsApp</th>
                <th className="p-2.5 border-r border-slate-200">Alamat / Desa & Kab</th>
                <th className="p-2.5 border-r border-slate-200 text-right">Luas Lahan (Ha)</th>
                <th className="p-2.5 border-r border-slate-200">Komoditas & Varietas</th>
                <th className="p-2.5 border-r border-slate-200">Estimasi Panen</th>
                <th className="p-2.5 border-r border-slate-200 text-right">Taksiran (Ton)</th>
                <th className="p-2.5 border-r border-slate-200">Status Verifikasi</th>
                <th className="p-2.5 border-r border-slate-200">Google Sheets Sync</th>
                <th className="p-2.5 border-r border-slate-200 min-w-[220px]">Catatan / Rekomendasi AI</th>
                <th className="p-2.5 text-center w-16">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-sans">
              {filteredFarmers.length === 0 ? (
                <tr>
                  <td colSpan={13} className="text-center py-12 text-slate-400">
                    <Table className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p>Tidak ada data petani yang cocok dengan pencarian.</p>
                  </td>
                </tr>
              ) : (
                filteredFarmers.map((f, idx) => (
                  <tr
                    key={f.id}
                    className="hover:bg-emerald-50/40 transition group text-slate-800"
                  >
                    {/* Row Index */}
                    <td className="p-2 text-center bg-slate-50 text-slate-400 font-mono border-r border-slate-200 text-[10px]">
                      {idx + 2}
                    </td>

                    {/* ID */}
                    <td className="p-2.5 font-mono font-medium text-emerald-800 border-r border-slate-200 whitespace-nowrap">
                      {f.id}
                    </td>

                    {/* Nama */}
                    <td className="p-2.5 font-semibold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                      {f.nama}
                    </td>

                    {/* No WhatsApp */}
                    <td className="p-2.5 text-slate-600 border-r border-slate-200 whitespace-nowrap font-mono text-[11px]">
                      {f.noHp}
                    </td>

                    {/* Alamat */}
                    <td className="p-2.5 text-slate-700 border-r border-slate-200 max-w-[200px] truncate" title={`${f.alamat}, ${f.kabupaten || ''}`}>
                      {f.alamat}
                      {f.kabupaten && <span className="text-slate-400 block text-[10px]">{f.kabupaten}</span>}
                    </td>

                    {/* Luas Lahan */}
                    <td className="p-2.5 font-mono font-semibold text-slate-900 border-r border-slate-200 text-right whitespace-nowrap">
                      {f.luasLahan} Ha
                    </td>

                    {/* Komoditas */}
                    <td className="p-2.5 border-r border-slate-200 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {f.komoditas}
                      </span>
                      {f.varietas && (
                        <span className="block text-[10px] text-slate-500 mt-0.5">
                          var. {f.varietas}
                        </span>
                      )}
                    </td>

                    {/* Estimasi Panen */}
                    <td className="p-2.5 text-slate-700 border-r border-slate-200 whitespace-nowrap">
                      {f.estimasiPanen}
                    </td>

                    {/* Estimasi Tonase */}
                    <td className="p-2.5 font-mono font-semibold text-slate-900 border-r border-slate-200 text-right whitespace-nowrap">
                      {f.estimasiHasilTon} Ton
                    </td>

                    {/* Status Verifikasi */}
                    <td className="p-2.5 border-r border-slate-200 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                          f.statusVerifikasi === 'Terverifikasi'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{f.statusVerifikasi}</span>
                      </span>
                    </td>

                    {/* Sync Status */}
                    <td className="p-2.5 border-r border-slate-200 whitespace-nowrap text-center">
                      <span className="inline-flex items-center space-x-1 text-[11px] text-emerald-700 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                        <span>Real-Time</span>
                      </span>
                    </td>

                    {/* Catatan AI */}
                    <td className="p-2.5 text-slate-600 border-r border-slate-200 text-[11px] leading-relaxed">
                      {f.catatanAI || '—'}
                    </td>

                    {/* Action */}
                    <td className="p-2.5 text-center">
                      <button
                        onClick={() => onDeleteFarmer(f.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded transition cursor-pointer"
                        title="Hapus baris data"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info bar */}
        <div className="bg-slate-50 px-4 py-2 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span>Terhubung via Google Sheets API v4 & Webhook Meta WhatsApp</span>
          </div>
          <div className="text-[11px]">
            Menampilkan {filteredFarmers.length} dari {farmers.length} entitas petani terdaftar
          </div>
        </div>
      </div>

      {/* Online Spreadsheet Modal */}
      <GoogleSheetsOnlineModal
        isOpen={isOnlineModalOpen}
        onClose={() => setIsOnlineModalOpen(false)}
        farmers={farmers}
        onRefresh={onRefresh}
      />
    </div>
  );
};
