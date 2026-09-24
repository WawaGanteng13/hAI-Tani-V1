import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Search,
  UploadCloud,
  LogOut,
  FolderOpen,
  Plus,
  ShieldCheck,
  Check,
  Calendar,
  Layers,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  logoutGoogle,
  listUserSpreadsheets,
  syncToGoogleSpreadsheet,
  createNewSpreadsheet,
  DriveSpreadsheetFile,
  getAccessToken,
} from '../services/googleWorkspaceService';
import { FarmerRecord, SupplierRecord } from '../types';

interface GoogleDriveSheetsConnectorProps {
  farmers: FarmerRecord[];
  suppliers: SupplierRecord[];
  onDataRefreshed?: () => void;
}

export const GoogleDriveSheetsConnector: React.FC<GoogleDriveSheetsConnectorProps> = ({
  farmers,
  suppliers,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [spreadsheets, setSpreadsheets] = useState<DriveSpreadsheetFile[]>([]);
  const [isLoadingSheets, setIsLoadingSheets] = useState(false);
  const [selectedSheetId, setSelectedSheetId] = useState<string>('');
  const [customSheetUrlOrId, setCustomSheetUrlOrId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string; time: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Mandatory Confirmation Dialog State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  useEffect(() => {
    const unsubscribe = initAuth(
      (authUser, authToken) => {
        setUser(authUser);
        setToken(authToken);
        fetchSheets(authToken);
      },
      () => {
        setUser(null);
        setToken(null);
        setSpreadsheets([]);
      }
    );
    return () => unsubscribe();
  }, []);

  const fetchSheets = async (authToken: string) => {
    setIsLoadingSheets(true);
    setErrorMsg(null);
    try {
      const files = await listUserSpreadsheets(authToken);
      setSpreadsheets(files);
      if (files.length > 0 && !selectedSheetId) {
        setSelectedSheetId(files[0].id);
      }
    } catch (err: any) {
      console.error('Error listing spreadsheets:', err);
      setErrorMsg(err?.message || 'Gagal mengambil daftar spreadsheet dari Google Drive Anda.');
    } finally {
      setIsLoadingSheets(false);
    }
  };

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setErrorMsg(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setToken(res.accessToken);
        await fetchSheets(res.accessToken);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMsg(err?.message || 'Gagal masuk dengan Google.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logoutGoogle();
    setUser(null);
    setToken(null);
    setSpreadsheets([]);
    setSelectedSheetId('');
    setSyncResult(null);
  };

  const handleCreateNewSheet = async () => {
    const currentToken = token || getAccessToken();
    if (!currentToken) return;

    setIsCreatingNew(true);
    setErrorMsg(null);
    try {
      const title = `TaniAI_Database_Petani_${new Date().toLocaleDateString('id-ID').replace(/\//g, '-')}`;
      const newSheet = await createNewSpreadsheet(currentToken, title);
      setSpreadsheets((prev) => [newSheet, ...prev]);
      setSelectedSheetId(newSheet.id);
      setSyncResult({
        success: true,
        message: `Spreadsheet baru "${newSheet.name}" berhasil dibuat di Google Drive Anda. Siap disinkronkan!`,
        time: new Date().toLocaleTimeString('id-ID'),
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal membuat spreadsheet baru di Google Drive.');
    } finally {
      setIsCreatingNew(false);
    }
  };

  const getEffectiveSheetId = (): string => {
    if (customSheetUrlOrId.trim()) {
      const input = customSheetUrlOrId.trim();
      // Check if user pasted a full google docs URL: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
      const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        return match[1];
      }
      return input;
    }
    return selectedSheetId;
  };

  const handleConfirmSync = async () => {
    setShowConfirmModal(false);
    const targetId = getEffectiveSheetId();
    const currentToken = token || getAccessToken();

    if (!targetId || !currentToken) {
      setErrorMsg('Pilih atau masukkan ID spreadsheet tujuan terlebih dahulu.');
      return;
    }

    setIsSyncing(true);
    setErrorMsg(null);
    try {
      const res = await syncToGoogleSpreadsheet(currentToken, targetId, farmers, suppliers);
      setSyncResult({
        success: true,
        message: `Berhasil menulis ${farmers.length} data petani & ${suppliers.length} supplier langsung ke file Google Sheets Anda!`,
        time: res.timestamp,
      });
    } catch (err: any) {
      console.error('Sync failed:', err);
      setErrorMsg(err?.message || 'Gagal melakukan sinkronisasi ke Google Sheets.');
    } finally {
      setIsSyncing(false);
    }
  };

  const filteredSheets = spreadsheets.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedSheet = spreadsheets.find((s) => s.id === getEffectiveSheetId());

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
      {/* Header */}
      <div className="bg-slate-900 text-white p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-inner">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-white tracking-tight">
                Integrasi Langsung Google Drive & Sheets
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                1P Workspace OAuth
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Hubungkan akun Google Anda untuk membaca & menulis data pertanian langsung ke file Spreadsheet di Google Drive
            </p>
          </div>
        </div>

        {user ? (
          <div className="flex items-center space-x-3 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
            {user.photoURL ? (
              <img src={user.photoURL} alt={user.displayName || 'User'} className="w-7 h-7 rounded-full border border-emerald-400" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-emerald-700 flex items-center justify-center text-xs font-bold text-white">
                {(user.displayName || user.email || 'U')[0].toUpperCase()}
              </div>
            )}
            <div className="text-left">
              <div className="text-xs font-semibold text-white line-clamp-1">{user.displayName || 'Google User'}</div>
              <div className="text-[10px] text-slate-400 line-clamp-1">{user.email}</div>
            </div>
            <button
              onClick={handleLogout}
              className="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg transition cursor-pointer"
              title="Keluar dari Google"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 rounded-xl font-semibold text-xs flex items-center justify-center space-x-2 shadow-sm transition border border-slate-300 cursor-pointer shrink-0 disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            </svg>
            <span>{isLoggingIn ? 'Menghubungkan...' : 'Login dengan Akun Google'}</span>
          </button>
        )}
      </div>

      {/* Main Body */}
      <div className="p-4 sm:p-6 space-y-4">
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold">Perhatian:</span> {errorMsg}
            </div>
          </div>
        )}

        {syncResult && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs flex items-start justify-between shadow-2xs">
            <div className="flex items-start space-x-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-emerald-950">Sinkronisasi Berhasil ({syncResult.time})</div>
                <div className="mt-0.5 text-emerald-800">{syncResult.message}</div>
              </div>
            </div>
            {selectedSheet && (
              <a
                href={selectedSheet.webViewLink || `https://docs.google.com/spreadsheets/d/${selectedSheet.id}/edit`}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-medium text-[11px] flex items-center space-x-1 shrink-0 ml-3 transition cursor-pointer"
              >
                <span>Lihat di Sheets</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}

        {!user ? (
          <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-2xs">
              <UploadCloud className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              Sambungkan ke Google Drive untuk Menulis Langsung ke File Spreadsheet Anda
            </h3>
            <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
              Dengan login, TaniAI akan langsung menemukan file Google Sheets yang sudah Anda siapkan di Google Drive dan menyinkronkan data <strong>{farmers.length} petani</strong> & <strong>{suppliers.length} supplier</strong> ke lembar kerja Anda secara instan.
            </p>
            <button
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isLoggingIn ? 'Memproses Izin...' : 'Beri Izin & Hubungkan Google Sheets'}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Control Panel: Select or Paste Sheet */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option A: Select from Drive */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <FolderOpen className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Pilih Spreadsheet di Google Drive Anda:</span>
                  </label>
                  <button
                    onClick={() => token && fetchSheets(token)}
                    disabled={isLoadingSheets}
                    className="text-slate-500 hover:text-emerald-700 text-[11px] font-medium flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingSheets ? 'animate-spin' : ''}`} />
                    <span>Segarkan File</span>
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter nama spreadsheet..."
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                  {isLoadingSheets ? (
                    <div className="text-center py-4 text-xs text-slate-400 flex items-center justify-center space-x-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                      <span>Mencari spreadsheet di Google Drive...</span>
                    </div>
                  ) : filteredSheets.length === 0 ? (
                    <div className="text-center py-4 text-xs text-slate-400">
                      Tidak ditemukan spreadsheet yang cocok.
                    </div>
                  ) : (
                    filteredSheets.map((sheet) => {
                      const isSelected = selectedSheetId === sheet.id && !customSheetUrlOrId;
                      return (
                        <div
                          key={sheet.id}
                          onClick={() => {
                            setSelectedSheetId(sheet.id);
                            setCustomSheetUrlOrId('');
                          }}
                          className={`p-2 rounded-lg text-xs flex items-center justify-between cursor-pointer transition ${
                            isSelected
                              ? 'bg-emerald-100/70 border border-emerald-400 text-emerald-950 font-semibold'
                              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center space-x-2 truncate">
                            <FileSpreadsheet className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-emerald-700' : 'text-slate-400'}`} />
                            <span className="truncate">{sheet.name}</span>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0 ml-2" />}
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="pt-1 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">
                    Ditemukan {spreadsheets.length} file spreadsheet di akun Anda
                  </span>
                  <button
                    onClick={handleCreateNewSheet}
                    disabled={isCreatingNew}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-semibold flex items-center space-x-1 shadow-2xs transition cursor-pointer disabled:opacity-50"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{isCreatingNew ? 'Membuat...' : 'Buat Spreadsheet Baru'}</span>
                  </button>
                </div>
              </div>

              {/* Option B: Direct URL / ID Input & Target Preview */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <span>Atau Masukkan Tautan / ID Google Sheet Anda:</span>
                  </label>
                  <input
                    type="text"
                    value={customSheetUrlOrId}
                    onChange={(e) => setCustomSheetUrlOrId(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XR.../edit"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Tempel tautan dokumen Google Sheets yang sudah Anda siapkan jika tidak memilih dari daftar di sebelah kiri.
                  </p>
                </div>

                {/* Target Information Box */}
                <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
                  <div className="text-[11px] text-slate-500 font-medium">Target Spreadsheet Aktif:</div>
                  <div className="flex items-center justify-between">
                    <div className="truncate pr-2">
                      <div className="text-xs font-bold text-slate-800 truncate">
                        {selectedSheet?.name || (customSheetUrlOrId ? 'Custom Sheet (dari URL/ID)' : 'Belum dipilih')}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">
                        ID: {getEffectiveSheetId() || '-'}
                      </div>
                    </div>
                    {getEffectiveSheetId() && (
                      <a
                        href={selectedSheet?.webViewLink || `https://docs.google.com/spreadsheets/d/${getEffectiveSheetId()}/edit`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-medium flex items-center space-x-1 shrink-0 transition"
                      >
                        <span>Buka File</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Primary Action Button */}
                <button
                  onClick={() => setShowConfirmModal(true)}
                  disabled={!getEffectiveSheetId() || isSyncing}
                  className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 shadow-sm transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>{isSyncing ? 'Menulis Data ke Google Sheets...' : 'Sinkronkan Database ke Google Sheet Ini'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mandatory User Confirmation Dialog before mutating Workspace data */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="p-5 bg-emerald-800 text-white flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-700 flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5 text-emerald-200" />
              </div>
              <div>
                <h3 className="text-sm font-bold">Konfirmasi Penulisan Data ke Google Sheets</h3>
                <p className="text-xs text-emerald-200">Izin pembaruan lembar kerja spreadsheet</p>
              </div>
            </div>

            <div className="p-5 space-y-3 text-xs text-slate-600">
              <p className="leading-relaxed">
                Aplikasi akan menulis dan memperbarui data pertanian berikut langsung ke dokumen Google Sheets Anda:
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Nama File:</span>
                  <span className="font-semibold text-slate-800">{selectedSheet?.name || 'Spreadsheet Terpilih'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Target Lembar (Sheet):</span>
                  <span className="font-semibold text-emerald-700">Data Petani &amp; Data Mitra Supplier</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Jumlah Data Petani:</span>
                  <span className="font-bold text-slate-900">{farmers.length} baris data</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Jumlah Data Supplier:</span>
                  <span className="font-bold text-slate-900">{suppliers.length} baris data</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 italic">
                Data lama di rentang sel target akan ditimpa dengan database terkini dari server TaniAI. Tindakan ini memerlukan konfirmasi Anda.
              </p>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold border border-slate-300 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmSync}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer flex items-center space-x-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Ya, Tulis ke Google Sheets</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
