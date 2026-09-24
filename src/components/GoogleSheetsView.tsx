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
  MapPin,
  Building2,
  Store,
  Users,
  PackageCheck,
  Phone,
  HelpCircle,
  Info,
  Check,
} from 'lucide-react';
import { FarmerRecord, SupplierRecord } from '../types';
import { GoogleSheetsOnlineModal } from './GoogleSheetsOnlineModal';
import { GoogleDriveSheetsConnector } from './GoogleDriveSheetsConnector';

interface GoogleSheetsViewProps {
  farmers: FarmerRecord[];
  suppliers?: SupplierRecord[];
  onAddFarmer: () => void;
  onAddSupplier?: () => void;
  onDeleteFarmer: (id: string) => void;
  onDeleteSupplier?: (id: string) => void;
  onRefresh: () => void;
  loading: boolean;
}

export const GoogleSheetsView: React.FC<GoogleSheetsViewProps> = ({
  farmers,
  suppliers = [],
  onAddFarmer,
  onAddSupplier,
  onDeleteFarmer,
  onDeleteSupplier,
  onRefresh,
  loading,
}) => {
  const [activeTab, setActiveTab] = useState<'farmers' | 'suppliers'>('farmers');
  const [searchQuery, setSearchQuery] = useState('');
  const [commodityFilter, setCommodityFilter] = useState('Semua');
  const [supplierCategoryFilter, setSupplierCategoryFilter] = useState('Semua');
  const [isOnlineModalOpen, setIsOnlineModalOpen] = useState(false);
  const [showSyncInfo, setShowSyncInfo] = useState(true);
  const [copiedFormulaType, setCopiedFormulaType] = useState<'farmers' | 'suppliers' | null>(null);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  const getFormula = (type: 'farmers' | 'suppliers') => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const path = type === 'farmers' ? '/api/sheets/export.csv' : '/api/sheets/suppliers/export.csv';
    return `=IMPORTDATA("${origin}${path}")`;
  };

  const handleCopyFormula = (type: 'farmers' | 'suppliers') => {
    const formula = getFormula(type);
    navigator.clipboard.writeText(formula);
    setCopiedFormulaType(type);
    setSyncToast(`✅ Rumus ${type === 'farmers' ? 'Data Petani' : 'Data Supplier'} disalin! Tempel (Ctrl+V) di sel A1 Google Sheets.`);
    setTimeout(() => {
      setCopiedFormulaType(null);
      setSyncToast(null);
    }, 4500);
  };

  // Filtered farmers
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

  // Filtered suppliers
  const filteredSuppliers = suppliers.filter((s) => {
    const matchesSearch =
      s.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.alamat.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.kabupaten && s.kabupaten.toLowerCase().includes(searchQuery.toLowerCase())) ||
      s.kategori.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.produkUnggulan && s.produkUnggulan.some((p) => p.toLowerCase().includes(searchQuery.toLowerCase())));

    const matchesCategory =
      supplierCategoryFilter === 'Semua' || s.kategori === supplierCategoryFilter;

    return matchesSearch && matchesCategory;
  });

  // Calculate totals
  const totalLahan = farmers.reduce((acc, f) => acc + (f.luasLahan || 0), 0);
  const totalPanen = farmers.reduce((acc, f) => acc + (f.estimasiHasilTon || 0), 0);
  const totalPetaniTerhubung = suppliers.reduce((acc, s) => acc + (s.petaniBinaanCount || 0), 0);

  const handleExportCSV = () => {
    if (activeTab === 'farmers') {
      window.open('/api/sheets/export.csv', '_blank');
    } else {
      window.open('/api/sheets/suppliers/export.csv', '_blank');
    }
  };

  const handleOpenLiveWebSheets = () => {
    window.open('/api/sheets/live-view', '_blank');
  };

  const handleOpenGoogleSheets = () => {
    setIsOnlineModalOpen(true);
  };

  return (
    <div className="app-shell space-y-5 animate-fade-in">
      {/* Top Banner & Actions */}
      <div className="card p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                <span>Database Pertanian (Google Sheets Live)</span>
                <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-medium border border-emerald-300">
                  Real-Time Two-Way Sync
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Pencatatan data petani, lahan budidaya, serta supplier produk pertanian (saprodi/offtaker) terintegrasi langsung ke Google Sheets & WhatsApp Chatbot.
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
            title={`Ekspor ${activeTab === 'farmers' ? 'Petani' : 'Supplier'} ke CSV`}
          >
            <Download className="w-4 h-4 text-emerald-700" />
            <span>Ekspor CSV {activeTab === 'farmers' ? 'Petani' : 'Supplier'}</span>
          </button>

          <button
            onClick={handleOpenLiveWebSheets}
            className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white transition cursor-pointer text-xs font-semibold flex items-center space-x-1.5 shadow-sm"
            title="Buka web spreadsheet live di tab baru yang langsung terisi lengkap database petani & supplier"
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

          {activeTab === 'farmers' ? (
            <button
              onClick={onAddFarmer}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition cursor-pointer text-xs font-semibold flex items-center space-x-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Petani</span>
            </button>
          ) : (
            <button
              onClick={onAddSupplier}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition cursor-pointer text-xs font-semibold flex items-center space-x-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Supplier</span>
            </button>
          )}
        </div>
      </div>

      {/* Direct Google Drive & Sheets 1P Workspace Connector */}
      <GoogleDriveSheetsConnector farmers={farmers} suppliers={suppliers} />

      {/* Sync Toast Notification */}
      {syncToast && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-2.5 rounded-xl text-xs font-medium flex items-center justify-between shadow-xs animate-fadeIn">
          <div className="flex items-center space-x-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{syncToast}</span>
          </div>
          <button
            onClick={() => setSyncToast(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Google Drive & Sheets Sync Explanation Card */}
      {showSyncInfo && (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4 sm:p-5 shadow-xs relative">
          <button
            onClick={() => setShowSyncInfo(false)}
            className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 p-1 rounded-lg text-xs cursor-pointer"
            title="Tutup panduan ini"
          >
            ✕
          </button>

          <div className="flex items-start space-x-3.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="space-y-2 flex-1 pr-6">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  Panduan Sinkronisasi: Mengapa Sheet Baru di Google Drive Terbuka Kosong?
                </h3>
                <span className="px-2 py-0.5 bg-emerald-200/80 text-emerald-900 text-[10px] font-bold rounded-full">
                  100% Data Tersedia di Server
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Ketika Anda membuat/membuka file Google Sheets baru melalui browser (seperti di <code>docs.google.com</code>), Google secara standar membuka halaman kosong tanpa isi. Seluruh data <strong>{farmers.length} petani</strong> dan <strong>{suppliers.length} mitra supplier</strong> tersimpan aktif di backend dan siap ditarik dengan 3 cara instan berikut:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                {/* Method 1 */}
                <div className="bg-white/90 border border-emerald-200 rounded-xl p-3 shadow-2xs space-y-2">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-800">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px] font-bold">1</span>
                    <span>Formula Live Sync (=IMPORTDATA)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Tempelkan rumus ini di sel <strong>A1</strong> Google Sheets baru Anda. Data akan terisi seketika dan otomatis terupdate saat data baru masuk:
                  </p>
                  <div className="flex items-center space-x-1.5 pt-1">
                    <button
                      onClick={() => handleCopyFormula('farmers')}
                      className="flex-1 px-2 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold rounded-lg flex items-center justify-center space-x-1 shadow-2xs transition cursor-pointer"
                    >
                      {copiedFormulaType === 'farmers' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>Salin Rumus Petani</span>
                    </button>
                    <button
                      onClick={() => handleCopyFormula('suppliers')}
                      className="flex-1 px-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold rounded-lg flex items-center justify-center space-x-1 shadow-2xs transition cursor-pointer"
                    >
                      {copiedFormulaType === 'suppliers' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>Salin Rumus Supplier</span>
                    </button>
                  </div>
                </div>

                {/* Method 2 */}
                <div className="bg-white/90 border border-emerald-200 rounded-xl p-3 shadow-2xs space-y-2">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800">
                    <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 flex items-center justify-center text-[10px] font-bold">2</span>
                    <span>Buka Live Web Spreadsheet</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Lihat tampilan spreadsheet mandiri TaniAI yang sudah terisi 100% data lengkap secara interaktif langsung di tab browser:
                  </p>
                  <button
                    onClick={handleOpenLiveWebSheets}
                    className="w-full px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold rounded-lg flex items-center justify-center space-x-1 shadow-2xs transition cursor-pointer mt-1"
                  >
                    <ExternalLink className="w-3 h-3 text-emerald-400" />
                    <span>Buka Web Spreadsheet (Terisi Penuh)</span>
                  </button>
                </div>

                {/* Method 3 */}
                <div className="bg-white/90 border border-emerald-200 rounded-xl p-3 shadow-2xs space-y-2">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800">
                    <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 flex items-center justify-center text-[10px] font-bold">3</span>
                    <span>Ekspor File CSV Master</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Unduh file CSV master lalu pilih menu <em>File &gt; Import &gt; Upload</em> pada Google Sheets akun Google Drive Anda:
                  </p>
                  <div className="flex items-center space-x-1.5 pt-1">
                    <a
                      href="/api/sheets/export.csv"
                      download
                      className="flex-1 px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-semibold rounded-lg flex items-center justify-center space-x-1 border border-slate-300 transition cursor-pointer"
                    >
                      <Download className="w-3 h-3 text-emerald-700" />
                      <span>CSV Petani</span>
                    </a>
                    <a
                      href="/api/sheets/suppliers/export.csv"
                      download
                      className="flex-1 px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-semibold rounded-lg flex items-center justify-center space-x-1 border border-slate-300 transition cursor-pointer"
                    >
                      <Download className="w-3 h-3 text-blue-700" />
                      <span>CSV Supplier</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Spreadsheet Formula Bar & Status Bar Simulation */}
      <div className="bg-slate-100 rounded-xl border border-slate-300 overflow-hidden shadow-inner">
        {/* Workbook Title Bar */}
        <div className="bg-slate-200/80 px-4 py-1.5 border-b border-slate-300 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center space-x-4">
            <span className="font-mono font-bold text-slate-700">TaniAI_Database_Master.gsheet</span>
            <span className="text-[11px] text-emerald-700 bg-emerald-100/80 px-2 py-0.2 rounded border border-emerald-300 flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
              <span>Semua perubahan disimpan ke Google Drive & Cloud Database</span>
            </span>
          </div>
          <div className="flex items-center space-x-3 text-[11px]">
            {activeTab === 'farmers' ? (
              <>
                <span>Total: <strong>{farmers.length} Petani</strong></span>
                <span>Total Lahan: <strong>{totalLahan.toFixed(1)} Ha</strong></span>
                <span>Estimasi Panen: <strong>{totalPanen.toFixed(1)} Ton</strong></span>
              </>
            ) : (
              <>
                <span>Total: <strong>{suppliers.length} Mitra Supplier</strong></span>
                <span>Petani Binaan: <strong>{totalPetaniTerhubung} Petani</strong></span>
              </>
            )}
          </div>
        </div>

        {/* Formula Bar */}
        <div className="bg-white px-3 py-1.5 flex items-center space-x-2 border-b border-slate-200 text-xs">
          <span className="font-mono text-slate-400 font-bold px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200">
            fx
          </span>
          <span className="font-mono text-slate-600 truncate flex-1">
            {activeTab === 'farmers'
              ? '=FILTER(TaniAI_Farmers!A2:M, TaniAI_Farmers!Status="Terverifikasi") • Sinkronisasi otomatis dari Meta Cloud WhatsApp'
              : '=QUERY(TaniAI_Suppliers!A2:N, "SELECT A,C,D,E,F,G,H,I WHERE D is not null") • Jejaring Rantai Pasok Saprodi & Offtaker'}
          </span>
        </div>

        {/* Filters and Search */}
        <div className="p-3 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-slate-200">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === 'farmers'
                  ? 'Cari nama petani, desa, komoditas...'
                  : 'Cari nama supplier, produk, kategori, lokasi...'
              }
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            {activeTab === 'farmers' ? (
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
                <option value="Kedelai">Kedelai</option>
              </select>
            ) : (
              <select
                value={supplierCategoryFilter}
                onChange={(e) => setSupplierCategoryFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Semua">Semua Kategori ({suppliers.length})</option>
                <option value="Pupuk & Saprodi">Pupuk & Saprodi</option>
                <option value="Bibit & Benih">Bibit & Benih</option>
                <option value="Alat & Mesin Pertanian (Alsintan)">Alsintan</option>
                <option value="Offtaker & Pengepul">Offtaker & Pengepul</option>
                <option value="Koperasi Tani">Koperasi Tani</option>
              </select>
            )}
          </div>
        </div>

        {/* Tab 1: Farmers Table */}
        {activeTab === 'farmers' && (
          <div className="overflow-x-auto max-h-[520px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100 text-slate-600 sticky top-0 border-b border-slate-300 select-none shadow-2xs z-10">
                <tr>
                  <th className="py-2.5 px-3 font-mono font-bold text-center border-r border-slate-200 w-12 bg-slate-200/60">
                    #
                  </th>
                  <th className="py-2.5 px-3 font-semibold border-r border-slate-200">ID Petani</th>
                  <th className="py-2.5 px-3 font-semibold border-r border-slate-200">Waktu Terdaftar</th>
                  <th className="py-2.5 px-3 font-semibold border-r border-slate-200">Nama Petani</th>
                  <th className="py-2.5 px-3 font-semibold border-r border-slate-200">No. WhatsApp</th>
                  <th className="py-2.5 px-3 font-semibold border-r border-slate-200">Komoditas</th>
                  <th className="py-2.5 px-3 font-semibold border-r border-slate-200 text-right">Luas (Ha)</th>
                  <th className="py-2.5 px-3 font-semibold border-r border-slate-200 text-right">Est. Panen (Ton)</th>
                  <th className="py-2.5 px-3 font-semibold border-r border-slate-200">Waktu Panen</th>
                  <th className="py-2.5 px-3 font-semibold border-r border-slate-200">Wilayah / Kabupaten</th>
                  <th className="py-2.5 px-3 font-semibold border-r border-slate-200 text-center">Status</th>
                  <th className="py-2.5 px-3 font-semibold text-center w-20">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono text-[11px] bg-white">
                {filteredFarmers.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-8 text-center text-slate-400 font-sans">
                      Tidak ada data petani yang cocok dengan pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredFarmers.map((f, index) => (
                    <tr key={f.id} className="hover:bg-emerald-50/40 transition">
                      <td className="py-2 px-3 text-center border-r border-slate-200 text-slate-400 bg-slate-50/50">
                        {f.googleSheetRow || index + 2}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 font-bold text-slate-700">
                        {f.id}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 text-slate-500 whitespace-nowrap">
                        {f.timestamp || '2026-09-18 09:12:00'}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 font-sans font-semibold text-slate-900">
                        {f.nama}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 text-slate-600">
                        {f.noHp}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 font-sans">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {f.komoditas} {f.varietas ? `(${f.varietas})` : ''}
                        </span>
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 text-right font-bold text-slate-800">
                        {f.luasLahanFormatted || `${f.luasLahan} Ha`}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 text-right font-bold text-emerald-700">
                        {f.estimasiHasilTon || 0} Ton
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 font-sans text-slate-600">
                        {f.estimasiPanen}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 font-sans text-slate-700">
                        {f.alamat}, {f.kabupaten}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 text-center font-sans">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            f.statusVerifikasi === 'Terverifikasi'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {f.statusVerifikasi}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          {f.latitude && f.longitude && (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${f.latitude},${f.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-slate-400 hover:text-emerald-600 p-1 rounded transition"
                              title={`Lihat Koordinat di Google Maps (${f.latitude}, ${f.longitude})`}
                            >
                              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                            </a>
                          )}
                          <button
                            onClick={() => onDeleteFarmer(f.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded transition cursor-pointer"
                            title="Hapus baris data"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Suppliers Table */}
        {activeTab === 'suppliers' && (
          <div className="overflow-x-auto max-h-[520px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100 text-slate-600 sticky top-0 border-b border-slate-300 select-none shadow-2xs z-10">
                <tr>
                  <th className="py-2.5 px-3 font-mono font-bold text-center border-r border-slate-200 w-12 bg-slate-200/60">
                    #
                  </th>
                  <th className="py-2.5 px-3 font-semibold border-r border-slate-200">ID Mitra</th>
                  <th className="py-2.5 px-3 font-semibold border-r border-slate-200">Waktu Registrasi</th>
                  <th className="py-2.5 px-3 font-semibold border-r border-slate-200">Nama Toko / Supplier</th>
                  <th className="py-2.5 px-3 font-semibold border-r border-slate-200">Kategori Usaha</th>
                  <th className="py-2.5 px-3 font-semibold border-r border-slate-200">Kontak WhatsApp</th>
                  <th className="py-2.5 px-3 font-semibold border-r border-slate-200">Alamat & Kabupaten</th>
                  <th className="py-2.5 px-3 font-semibold border-r border-slate-200">Produk Unggulan</th>
                  <th className="py-2.5 px-3 font-semibold border-r border-slate-200">Stok Tersedia</th>
                  <th className="py-2.5 px-3 font-semibold border-r border-slate-200 text-center">Status</th>
                  <th className="py-2.5 px-3 font-semibold border-r border-slate-200 text-right">Radius (Km)</th>
                  <th className="py-2.5 px-3 font-semibold border-r border-slate-200 text-center">Petani Binaan</th>
                  <th className="py-2.5 px-3 font-semibold text-center w-20">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono text-[11px] bg-white">
                {filteredSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-8 text-center text-slate-400 font-sans">
                      Tidak ada data supplier produk pertanian yang cocok dengan pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredSuppliers.map((s, index) => (
                    <tr key={s.id} className="hover:bg-blue-50/40 transition">
                      <td className="py-2 px-3 text-center border-r border-slate-200 text-slate-400 bg-slate-50/50">
                        {s.googleSheetRow || index + 2}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 font-bold text-blue-700">
                        {s.id}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 text-slate-500 whitespace-nowrap">
                        {s.timestamp || '2026-09-19 10:00:00'}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 font-sans font-semibold text-slate-900">
                        {s.nama}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 font-sans">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${
                            s.kategori === 'Pupuk & Saprodi'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : s.kategori === 'Bibit & Benih'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : s.kategori === 'Alat & Mesin Pertanian (Alsintan)'
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : s.kategori === 'Offtaker & Pengepul'
                              ? 'bg-purple-50 text-purple-800 border-purple-200'
                              : 'bg-teal-50 text-teal-800 border-teal-200'
                          }`}
                        >
                          {s.kategori}
                        </span>
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 text-slate-600">
                        {s.kontak}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 font-sans text-slate-700 max-w-[180px] truncate" title={`${s.alamat}, ${s.kabupaten}`}>
                        {s.alamat}, {s.kabupaten}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 font-sans text-slate-700 max-w-[200px] truncate" title={(s.produkUnggulan || []).join(', ')}>
                        {(s.produkUnggulan || []).join(', ')}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 font-sans font-medium text-slate-700">
                        {s.stokTersedia}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 text-center font-sans">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            s.statusKemitraan === 'Terverifikasi Dinas'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {s.statusKemitraan}
                        </span>
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 text-right font-bold text-slate-800">
                        {s.radiusLayananKm || 25} km
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 text-center font-bold text-slate-700">
                        {s.petaniBinaanCount || 0}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          {s.latitude && s.longitude && (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${s.latitude},${s.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-slate-400 hover:text-blue-600 p-1 rounded transition"
                              title={`Lihat Koordinat di Google Maps (${s.latitude}, ${s.longitude})`}
                            >
                              <MapPin className="w-3.5 h-3.5 text-blue-600" />
                            </a>
                          )}
                          {onDeleteSupplier && (
                            <button
                              onClick={() => onDeleteSupplier(s.id)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded transition cursor-pointer"
                              title="Hapus supplier"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Google Sheets Workbook Tab Navigation (Authentic Bottom Tabs) */}
        <div className="bg-slate-200 px-3 py-1.5 border-t border-slate-300 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setActiveTab('farmers')}
              className={`px-3 py-1.5 rounded-t-lg font-semibold text-xs transition cursor-pointer flex items-center space-x-1.5 border-t border-x ${
                activeTab === 'farmers'
                  ? 'bg-white text-emerald-900 border-slate-300 shadow-xs'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300/70 border-transparent'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Lembar 1: Basis Data Petani & Lahan</span>
              <span className="ml-1 px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] rounded-full font-mono">
                {farmers.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('suppliers')}
              className={`px-3 py-1.5 rounded-t-lg font-semibold text-xs transition cursor-pointer flex items-center space-x-1.5 border-t border-x ${
                activeTab === 'suppliers'
                  ? 'bg-white text-blue-900 border-slate-300 shadow-xs'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300/70 border-transparent'
              }`}
            >
              <Store className="w-3.5 h-3.5 text-blue-600" />
              <span>Lembar 2: Supplier Produk Pertanian</span>
              <span className="ml-1 px-1.5 py-0.2 bg-blue-100 text-blue-800 text-[10px] rounded-full font-mono">
                {suppliers.length}
              </span>
            </button>
          </div>

          <div className="text-[11px] text-slate-500 font-sans hidden sm:block">
            {activeTab === 'farmers'
              ? `Menampilkan ${filteredFarmers.length} dari ${farmers.length} data petani`
              : `Menampilkan ${filteredSuppliers.length} dari ${suppliers.length} data supplier`}
          </div>
        </div>

        {/* Footer info bar */}
        <div className="bg-slate-50 px-4 py-2 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span>Terhubung via Google Sheets API v4 & Webhook Meta WhatsApp</span>
          </div>
          <div className="text-[11px]">
            TaniAI Integrated Agriculture Ecosystem • Database Petani & Supplier Terverifikasi
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
