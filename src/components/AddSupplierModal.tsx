import React, { useState } from 'react';
import { X, Building2, MapPin, Phone, Package, Tag, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { SupplierRecord } from '../types';

interface AddSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (supplier: Partial<SupplierRecord>) => Promise<void>;
}

const DISTRICT_COORDS: Record<string, { lat: number; lng: number }> = {
  'Subang, Jawa Barat': { lat: -6.5716, lng: 107.7587 },
  'Karawang, Jawa Barat': { lat: -6.3073, lng: 107.3069 },
  'Indramayu, Jawa Barat': { lat: -6.3264, lng: 108.3200 },
  'Majalengka, Jawa Barat': { lat: -6.8361, lng: 108.2275 },
  'Cianjur, Jawa Barat': { lat: -6.8172, lng: 107.1399 },
  'Bandung Barat / Lembang, Jawa Barat': { lat: -6.8152, lng: 107.6186 },
  'Garut, Jawa Barat': { lat: -7.2167, lng: 107.9000 },
  'Brebes, Jawa Tengah': { lat: -6.8703, lng: 109.0435 },
  'Grobogan, Jawa Tengah': { lat: -7.0863, lng: 110.9168 },
  'Nganjuk, Jawa Timur': { lat: -7.5810, lng: 111.9480 },
  'Kediri, Jawa Timur': { lat: -7.8480, lng: 112.0178 },
  'Blitar, Jawa Timur': { lat: -7.8690, lng: 112.1580 },
};

export const AddSupplierModal: React.FC<AddSupplierModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [formData, setFormData] = useState({
    nama: '',
    kategori: 'Pupuk & Saprodi' as SupplierRecord['kategori'],
    kontak: '+62 8',
    alamat: '',
    kabupaten: 'Subang, Jawa Barat',
    statusKemitraan: 'Mitra Aktif' as SupplierRecord['statusKemitraan'],
    produkUnggulanText: 'Pupuk NPK Phonska Plus, Urea Non-Subsidi, Pestisida Organik',
    stokTersedia: 'Ready Stok 25 Ton',
    radiusLayananKm: 25,
    jamBuka: 'Senin - Sabtu: 07.30 - 17.00 WIB',
    catatan: 'Kios saprodi resmi melayani kelompok tani binaan.',
    latitude: -6.5716,
    longitude: 107.7587,
  });

  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleDistrictChange = (kab: string) => {
    const coords = DISTRICT_COORDS[kab] || { lat: -6.5716, lng: 107.7587 };
    const jitterLat = (Math.random() - 0.5) * 0.02;
    const jitterLng = (Math.random() - 0.5) * 0.02;
    setFormData((prev) => ({
      ...prev,
      kabupaten: kab,
      latitude: Number((coords.lat + jitterLat).toFixed(4)),
      longitude: Number((coords.lng + jitterLng).toFixed(4)),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nama.trim()) return;

    setSubmitting(true);
    try {
      const produkArray = formData.produkUnggulanText
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);

      await onAdd({
        nama: formData.nama,
        kategori: formData.kategori,
        kontak: formData.kontak,
        alamat: formData.alamat || formData.kabupaten,
        kabupaten: formData.kabupaten,
        statusKemitraan: formData.statusKemitraan,
        produkUnggulan: produkArray.length > 0 ? produkArray : ['Pupuk & Saprodi Pertanian'],
        stokTersedia: formData.stokTersedia,
        radiusLayananKm: Number(formData.radiusLayananKm) || 25,
        jamBuka: formData.jamBuka,
        catatan: formData.catatan,
        latitude: formData.latitude,
        longitude: formData.longitude,
      });
      onClose();
    } catch (err) {
      console.error('Failed to add supplier:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden my-6">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-teal-800 to-emerald-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-700/80 border border-teal-500/30 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-teal-200" />
            </div>
            <div>
              <h3 className="font-bold text-base">Tambah Supplier Produk Pertanian</h3>
              <p className="text-xs text-teal-200">Database Kios Saprodi, Benih, Alsintan, & Offtaker Hasil Tani</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-teal-200 hover:text-white hover:bg-teal-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Row 1: Nama & Kategori */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Nama Supplier / Kios Tani *
              </label>
              <input
                type="text"
                required
                value={formData.nama}
                onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                placeholder="Contoh: Kios Tani Berkah Makmur"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Kategori Usaha *
              </label>
              <select
                value={formData.kategori}
                onChange={(e) => setFormData({ ...formData, kategori: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none font-medium"
              >
                <option value="Pupuk & Saprodi">🌾 Pupuk & Saprodi Pertanian</option>
                <option value="Bibit & Benih">🌱 Bibit & Benih Unggul</option>
                <option value="Alat & Mesin Pertanian (Alsintan)">🚜 Alat & Mesin (Alsintan)</option>
                <option value="Offtaker & Pengepul">🏢 Offtaker & Pengepul Hasil Panen</option>
                <option value="Koperasi Tani">🤝 Koperasi Tani Mandiri</option>
              </select>
            </div>
          </div>

          {/* Row 2: Kontak & Status Kemitraan */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Nomor WhatsApp / Kontak *
              </label>
              <input
                type="text"
                required
                value={formData.kontak}
                onChange={(e) => setFormData({ ...formData, kontak: e.target.value })}
                placeholder="+62 812-xxxx-xxxx"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Status Kemitraan
              </label>
              <select
                value={formData.statusKemitraan}
                onChange={(e) => setFormData({ ...formData, statusKemitraan: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none font-medium"
              >
                <option value="Mitra Aktif">🟢 Mitra Aktif</option>
                <option value="Terverifikasi Dinas">🛡️ Terverifikasi Dinas Pertanian</option>
                <option value="Kios Resmi BUMN">🏛️ Kios Pengecer Resmi BUMN (Pupuk Indonesia)</option>
              </select>
            </div>
          </div>

          {/* Row 3: Kabupaten & Lokasi */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Kabupaten / Sentra Wilayah *
              </label>
              <select
                value={formData.kabupaten}
                onChange={(e) => handleDistrictChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
              >
                {Object.keys(DISTRICT_COORDS).map((kab) => (
                  <option key={kab} value={kab}>{kab}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Alamat Lengkap / Jalan *
              </label>
              <input
                type="text"
                required
                value={formData.alamat}
                onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
                placeholder="Contoh: Jl. Raya Cipunagara No. 45"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Row 4: Produk Unggulan & Stok Tersedia */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Produk Unggulan (Pisahkan koma)
              </label>
              <input
                type="text"
                value={formData.produkUnggulanText}
                onChange={(e) => setFormData({ ...formData, produkUnggulanText: e.target.value })}
                placeholder="Pupuk NPK, Benih Padi Inpari, Sprayer"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Kapasitas / Stok Tersedia
              </label>
              <input
                type="text"
                value={formData.stokTersedia}
                onChange={(e) => setFormData({ ...formData, stokTersedia: e.target.value })}
                placeholder="Contoh: Ready 30 Ton / 500 Sak"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Row 5: Coordinates (Auto-calculated, displayed clearly) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-teal-600" />
              <div>
                <span className="text-[11px] font-semibold text-slate-700 block">
                  Koordinat Peta (Otomatis untuk Google Maps)
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  Lat: {formData.latitude}, Lng: {formData.longitude}
                </span>
              </div>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-teal-100 text-teal-800 font-semibold">
              Live Map Ready
            </span>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold rounded-xl transition shadow-sm flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <span>Menyimpan ke Sheets...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan ke Database</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
