import React, { useState } from 'react';
import { X, Plus, CheckCircle2, Sprout, MapPin, Calendar, FileText } from 'lucide-react';
import { FarmerRecord } from '../types';

interface AddFarmerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (farmer: Partial<FarmerRecord>) => Promise<void>;
}

export const AddFarmerModal: React.FC<AddFarmerModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [formData, setFormData] = useState({
    nama: '',
    noHp: '+62 8',
    alamat: '',
    kabupaten: '',
    luasLahan: '1.0',
    komoditas: 'Padi',
    varietas: 'Inpari 32',
    estimasiPanen: 'November 2026',
    estimasiHasilTon: '6.5',
    statusVerifikasi: 'Terverifikasi' as 'Terverifikasi' | 'Menunggu Verifikasi',
    catatanAI: 'Pencatatan manual oleh Penyuluh Pertanian Lapangan (PPL).',
  });

  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nama || !formData.komoditas) return;

    setSubmitting(true);
    try {
      const luas = parseFloat(formData.luasLahan) || 1.0;
      await onAdd({
        ...formData,
        luasLahan: luas,
        luasLahanFormatted: `${luas} Ha (${luas * 10000} m²)`,
        estimasiHasilTon: parseFloat(formData.estimasiHasilTon) || luas * 6,
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="bg-emerald-800 text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center">
              <Sprout className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h3 className="font-bold text-base">Tambah Data Petani ke Google Sheets</h3>
              <p className="text-xs text-emerald-200">Formulir Petugas / Penyuluh Pertanian Lapangan (PPL)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Nama Lengkap Petani *</label>
              <input
                type="text"
                required
                value={formData.nama}
                onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                placeholder="Contoh: Pak Joko Subagyo"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Nomor WhatsApp *</label>
              <input
                type="text"
                required
                value={formData.noHp}
                onChange={(e) => setFormData({ ...formData, noHp: e.target.value })}
                placeholder="+62 812-xxxx-xxxx"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Alamat / Desa / Kecamatan *</label>
              <input
                type="text"
                required
                value={formData.alamat}
                onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
                placeholder="Desa Ciptamargi, Kec. Cilamaya"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Kabupaten / Provinsi</label>
              <input
                type="text"
                value={formData.kabupaten}
                onChange={(e) => setFormData({ ...formData, kabupaten: e.target.value })}
                placeholder="Karawang, Jawa Barat"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Luas Lahan (Ha) *</label>
              <input
                type="number"
                step="0.1"
                required
                value={formData.luasLahan}
                onChange={(e) => setFormData({ ...formData, luasLahan: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Komoditas *</label>
              <select
                value={formData.komoditas}
                onChange={(e) => setFormData({ ...formData, komoditas: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="Padi">Padi</option>
                <option value="Cabai Rawit Merah">Cabai Rawit Merah</option>
                <option value="Cabai Merah Keriting">Cabai Merah Keriting</option>
                <option value="Bawang Merah">Bawang Merah</option>
                <option value="Jagung">Jagung</option>
                <option value="Kedelai">Kedelai</option>
                <option value="Kopi Arabika">Kopi Arabika</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Varietas Benih</label>
              <input
                type="text"
                value={formData.varietas}
                onChange={(e) => setFormData({ ...formData, varietas: e.target.value })}
                placeholder="Misal: Inpari 32 / Ori 212"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Estimasi Waktu Panen</label>
              <input
                type="text"
                value={formData.estimasiPanen}
                onChange={(e) => setFormData({ ...formData, estimasiPanen: e.target.value })}
                placeholder="Bulan & Tahun (contoh: November 2026)"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Taksiran Hasil (Ton)</label>
              <input
                type="number"
                step="0.1"
                value={formData.estimasiHasilTon}
                onChange={(e) => setFormData({ ...formData, estimasiHasilTon: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Catatan Agronomi / Verifikasi</label>
            <textarea
              rows={2}
              value={formData.catatanAI}
              onChange={(e) => setFormData({ ...formData, catatanAI: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center space-x-1.5 transition cursor-pointer shadow-md disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{submitting ? 'Menyimpan...' : 'Simpan ke Google Sheets'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
