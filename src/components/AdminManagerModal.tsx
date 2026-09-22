import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  UserPlus,
  Phone,
  Building,
  Trash2,
  CheckCircle2,
  Lock,
  Sparkles,
  Key,
  AlertCircle,
} from 'lucide-react';
import { AdminUser } from '../types';

interface AdminManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  admins: AdminUser[];
  onAddAdmin: (newAdmin: Omit<AdminUser, 'id' | 'waktuTerdaftar'>) => Promise<void>;
  onDeleteAdmin: (id: string) => Promise<void>;
  onToggleStatus?: (id: string) => void;
}

export const AdminManagerModal: React.FC<AdminManagerModalProps> = ({
  isOpen,
  onClose,
  admins,
  onAddAdmin,
  onDeleteAdmin,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [nama, setNama] = useState('');
  const [noHp, setNoHp] = useState('+62 8');
  const [instansi, setInstansi] = useState('');
  const [role, setRole] = useState<'ADMIN_UTAMA' | 'PETUGAS_PPL' | 'DATA_SCIENTIST'>('PETUGAS_PPL');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!nama.trim() || !noHp.trim() || noHp.length < 9) {
      setErrorMsg('Harap masukkan nama dan nomor WhatsApp yang valid (minimal 9 digit)');
      return;
    }

    setSubmitting(true);
    try {
      await onAddAdmin({
        nama: nama.trim(),
        noHp: noHp.trim(),
        instansi: instansi.trim() || 'Dinas Pertanian / PPL Lapangan',
        role,
        izinAkses: ['rekap_data', 'ekspor_sheets', 'verifikasi_petani'],
        aktif: true,
      });

      setNama('');
      setNoHp('+62 8');
      setInstansi('');
      setShowAddForm(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menambahkan nomor admin');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-md">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-base text-white">Daftar Nomor Admin & Petugas Terverifikasi</h3>
                <span className="bg-amber-400 text-slate-950 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  RBAC Active
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Hanya nomor di bawah ini yang berhak meminta rekap data petani dan data Google Sheets melalui WhatsApp Kang Tani AI.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informative Security Banner */}
        <div className="bg-amber-50 border-b border-amber-200/80 px-6 py-3 flex items-start space-x-3 text-xs text-amber-900">
          <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Proteksi Data Petani:</span> Jika ada nomor WhatsApp lain (nomor umum/petani biasa) yang mencoba menyuruh bot mengeluarkan rekap seluruh petani, alamat, atau nomor telepon, <strong>Kang Tani AI otomatis menolak</strong> demi menjaga privasi dan kerahasiaan data kelompok tani.
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Action to Toggle Form */}
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              {admins.length} Nomor Admin Terdaftar
            </div>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition shadow-xs cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{showAddForm ? 'Batal Tambah' : 'Tambah Nomor Admin Baru'}</span>
            </button>
          </div>

          {/* Add Admin Form */}
          {showAddForm && (
            <form
              onSubmit={handleSubmit}
              className="bg-slate-50 border border-emerald-200 rounded-2xl p-4 space-y-3"
            >
              <div className="flex items-center space-x-2 text-xs font-bold text-emerald-800">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Registrasikan Nomor WhatsApp Petugas / Admin Baru</span>
              </div>

              {errorMsg && (
                <div className="bg-rose-50 text-rose-700 text-xs p-2 rounded-lg border border-rose-200 flex items-center space-x-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Nama Petugas / Pejabat Dinas *
                  </label>
                  <input
                    type="text"
                    value={nama}
                    onChange={(e) => setNama(e.target.value)}
                    placeholder="Contoh: Ir. Hendra Gunawan"
                    required
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Nomor WhatsApp Terverifikasi *
                  </label>
                  <input
                    type="text"
                    value={noHp}
                    onChange={(e) => setNoHp(e.target.value)}
                    placeholder="+62 812-xxxx-xxxx"
                    required
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Instansi / Unit Kerja
                  </label>
                  <input
                    type="text"
                    value={instansi}
                    onChange={(e) => setInstansi(e.target.value)}
                    placeholder="Contoh: Dinas Ketahanan Pangan Karawang"
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Hak Otoritas & Peran
                  </label>
                  <select
                    value={role}
                    onChange={(e: any) => setRole(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="ADMIN_UTAMA">Admin Utama (Akses Penuh & Rekap Eksekutif)</option>
                    <option value="PETUGAS_PPL">Petugas Penyuluh Lapangan (PPL)</option>
                    <option value="DATA_SCIENTIST">Data Scientist Pertanian</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs text-slate-600 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Nomor Admin'}
                </button>
              </div>
            </form>
          )}

          {/* Admin List Cards */}
          <div className="space-y-3">
            {admins.map((admin) => (
              <div
                key={admin.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 transition shadow-2xs"
              >
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold shrink-0 mt-0.5 border border-slate-200">
                    <Phone className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900 text-sm">{admin.nama}</span>
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-semibold px-2 py-0.5 rounded-md border border-emerald-200">
                        {admin.role === 'ADMIN_UTAMA'
                          ? '👑 Super Admin'
                          : admin.role === 'PETUGAS_PPL'
                          ? '🌾 Petugas PPL'
                          : '🔬 Data Scientist'}
                      </span>
                      {admin.aktif && (
                        <span className="inline-flex items-center text-[11px] text-emerald-600 font-medium space-x-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Aktif</span>
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-500">
                      <span className="font-mono text-slate-800 font-semibold bg-slate-100 px-1.5 py-0.5 rounded">
                        {admin.noHp}
                      </span>
                      <span>&bull;</span>
                      <span className="flex items-center space-x-1">
                        <Building className="w-3 h-3 text-slate-400" />
                        <span>{admin.instansi}</span>
                      </span>
                      <span>&bull;</span>
                      <span className="text-slate-400">Terdaftar: {admin.waktuTerdaftar}</span>
                    </div>

                    <div className="mt-2 flex items-center space-x-1.5 text-[11px] text-slate-500">
                      <Key className="w-3 h-3 text-amber-500" />
                      <span>
                        Izin: {admin.izinAkses.map((i) => i.replace(/_/g, ' ')).join(', ')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Delete button (except default primary admin) */}
                {admin.id !== 'ADM-001' && (
                  <button
                    onClick={() => onDeleteAdmin(admin.id)}
                    className="self-end sm:self-center p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                    title="Hapus otoritas admin"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            Perubahan nomor admin langsung berlaku pada WhatsApp Chatbot dan Webhook API.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-semibold cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
