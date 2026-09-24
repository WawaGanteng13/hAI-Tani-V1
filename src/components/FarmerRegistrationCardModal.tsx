import React, { useState } from 'react';
import {
  X,
  Printer,
  FileCheck,
  MapPin,
  Calendar,
  Layers,
  Sprout,
  UserCheck,
  QrCode,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react';
import { FarmerRecord } from '../types';
import { calculateFertilizerRecommendation } from '../utils/agronomy';

interface FarmerRegistrationCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  farmer: FarmerRecord | null;
  allFarmers: FarmerRecord[];
  onSelectFarmer?: (farmer: FarmerRecord) => void;
}

export const FarmerRegistrationCardModal: React.FC<FarmerRegistrationCardModalProps> = ({
  isOpen,
  onClose,
  farmer,
  allFarmers,
  onSelectFarmer,
}) => {
  const [selectedFarmerId, setSelectedFarmerId] = useState<string>(farmer?.id || '');

  if (!isOpen) return null;

  const activeFarmer = (allFarmers.find((f) => f.id === selectedFarmerId) || farmer || allFarmers[0]) as FarmerRecord | undefined;

  if (!activeFarmer) return null;

  const fert = calculateFertilizerRecommendation(activeFarmer.komoditas, activeFarmer.luasLahan);

  const handlePrint = () => {
    window.print();
  };

  const handleFarmerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedFarmerId(id);
    const chosen = allFarmers.find((f) => f.id === id);
    if (chosen && onSelectFarmer) {
      onSelectFarmer(chosen);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      {/* Container - on print this will be the only thing printed */}
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto print:m-0 print:p-0 print:border-none print:shadow-none print:w-full">
        {/* MODAL CONTROL HEADER (Hidden on Print) */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between print:hidden">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600/30 border border-emerald-500/50 flex items-center justify-center">
              <FileCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Surat Tanda Registrasi Lahan & Petani (Format PPL BPP)
              </h2>
              <p className="text-xs text-slate-300">
                Dokumen otentikasi data lahan terkoneksi database Google Sheets & Kang Tani AI
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Farmer Switcher Dropdown */}
            {allFarmers.length > 1 && (
              <div className="relative">
                <select
                  value={activeFarmer.id}
                  onChange={handleFarmerChange}
                  className="bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-3 py-1.5 pr-8 appearance-none focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  {allFarmers.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.id} - {f.nama} ({f.komoditas})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}

            <button
              onClick={handlePrint}
              className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm"
              title="Cetak Dokumen atau Simpan PDF"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak / Simpan PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE CERTIFICATE BODY */}
        <div className="p-8 sm:p-10 font-sans text-slate-900 bg-white print:p-6" id="printable-certificate">
          {/* OFFICIAL HEADER */}
          <div className="border-b-2 border-slate-900 pb-5 mb-6 text-center relative">
            <div className="flex items-center justify-between gap-4">
              <div className="w-16 h-16 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-bold text-2xl shadow-sm shrink-0">
                🌾
              </div>
              <div className="flex-1 text-center">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-600">
                  Kementerian Pertanian Republik Indonesia
                </p>
                <h1 className="text-xl font-extrabold uppercase text-slate-900 tracking-wide mt-0.5">
                  Surat Tanda Registrasi Lahan & Petani
                </h1>
                <p className="text-xs text-slate-600 mt-1">
                  Balai Penyuluhan Pertanian (BPP) Wilayah Kerja Penyuluh Pertanian (WKPP) • Sistem Registrasi TaniAI
                </p>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                  Database Google Sheets Baris #{activeFarmer.googleSheetRow || 2} • ID: {activeFarmer.id}
                </p>
              </div>
              {/* Official QR Code Box */}
              <div className="w-16 h-16 border border-slate-300 rounded-lg p-1 bg-slate-50 flex flex-col items-center justify-center shrink-0">
                <QrCode className="w-10 h-10 text-slate-800" />
                <span className="text-[8px] font-mono text-slate-600 mt-0.5">VALID DIGIT</span>
              </div>
            </div>
          </div>

          {/* TWO COLUMN SUMMARY */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* SECTION 1: IDENTITAS PETANI */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60">
              <div className="flex items-center space-x-2 border-b border-slate-200 pb-2 mb-3">
                <UserCheck className="w-4 h-4 text-emerald-700" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  I. Identitas Pokok Petani
                </h3>
              </div>
              <dl className="grid grid-cols-3 gap-y-2 text-xs">
                <dt className="text-slate-500 font-medium">Nomor Registrasi:</dt>
                <dd className="col-span-2 font-mono font-bold text-emerald-800">{activeFarmer.id}</dd>

                <dt className="text-slate-500 font-medium">Nama Lengkap:</dt>
                <dd className="col-span-2 font-bold text-slate-900">{activeFarmer.nama}</dd>

                <dt className="text-slate-500 font-medium">No. Kontak WhatsApp:</dt>
                <dd className="col-span-2 font-mono text-slate-700">{activeFarmer.noHp || '—'}</dd>

                <dt className="text-slate-500 font-medium">Alamat / Desa:</dt>
                <dd className="col-span-2 text-slate-800">{activeFarmer.alamat}</dd>

                <dt className="text-slate-500 font-medium">Kabupaten / Sentra:</dt>
                <dd className="col-span-2 font-semibold text-slate-900">{activeFarmer.kabupaten || 'Subang'}</dd>

                <dt className="text-slate-500 font-medium">Waktu Pendataan:</dt>
                <dd className="col-span-2 text-slate-600 font-mono">{activeFarmer.timestamp}</dd>
              </dl>
            </div>

            {/* SECTION 2: DETAIL LAHAN & KOMODITAS */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60">
              <div className="flex items-center space-x-2 border-b border-slate-200 pb-2 mb-3">
                <Sprout className="w-4 h-4 text-emerald-700" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  II. Spesifikasi Usaha Tani
                </h3>
              </div>
              <dl className="grid grid-cols-3 gap-y-2 text-xs">
                <dt className="text-slate-500 font-medium">Komoditas Utama:</dt>
                <dd className="col-span-2 font-bold text-emerald-900">{activeFarmer.komoditas}</dd>

                <dt className="text-slate-500 font-medium">Varietas Benih:</dt>
                <dd className="col-span-2 text-slate-800">{activeFarmer.varietas || 'Lokal Unggul'}</dd>

                <dt className="text-slate-500 font-medium">Luas Lahan Terdata:</dt>
                <dd className="col-span-2 font-mono font-bold text-slate-900">
                  {activeFarmer.luasLahanFormatted || `${activeFarmer.luasLahan} Ha (${activeFarmer.luasLahan * 10000} m²)`}
                </dd>

                <dt className="text-slate-500 font-medium">Estimasi Waktu Panen:</dt>
                <dd className="col-span-2 font-semibold text-slate-800">{activeFarmer.estimasiPanen}</dd>

                <dt className="text-slate-500 font-medium">Proyeksi Hasil:</dt>
                <dd className="col-span-2 font-mono font-bold text-amber-900">
                  ± {activeFarmer.estimasiHasilTon} Ton
                </dd>

                <dt className="text-slate-500 font-medium">Status Verifikasi:</dt>
                <dd className="col-span-2">
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <ShieldCheck className="w-3 h-3 text-emerald-700" />
                    <span>{activeFarmer.statusVerifikasi || 'Terverifikasi'}</span>
                  </span>
                </dd>
              </dl>
            </div>
          </div>

          {/* SECTION 3: REKOMENDASI DOSIS PEMUPUKAN BERIMBANG (BALITBANGTAN RI) */}
          <div className="border border-slate-200 rounded-xl p-4 bg-emerald-50/30 mb-6">
            <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2 mb-3">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-emerald-800" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-950">
                  III. Rekomendasi Dosis Pupuk Berimbang Balitbangtan ({activeFarmer.luasLahan} Hektar)
                </h3>
              </div>
              <span className="text-[10px] font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                Acuan Teknis Balitbang Pertanian RI
              </span>
            </div>

            {/* FERTILIZER TABLE */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-emerald-100/70 text-emerald-950 font-bold border-b border-emerald-200">
                    <th className="p-2">Jenis Pupuk</th>
                    <th className="p-2 text-center">Dosis Rekomendasi / Ha</th>
                    <th className="p-2 text-right">Kebutuhan Lahan ({activeFarmer.luasLahan} Ha)</th>
                    <th className="p-2 text-center">Estimasi Kemasan</th>
                    <th className="p-2">Fungsi Utama</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-200/50">
                  {fert.pupuk.map((p, idx) => (
                    <tr key={idx} className="hover:bg-emerald-50/50">
                      <td className="p-2 font-semibold text-slate-900">{p.jenis}</td>
                      <td className="p-2 text-center font-mono text-slate-700">{p.dosisPerHaKg} kg/Ha</td>
                      <td className="p-2 text-right font-mono font-bold text-emerald-900">
                        {p.totalKg.toLocaleString('id-ID')} kg
                      </td>
                      <td className="p-2 text-center font-mono text-slate-800">
                        {p.totalKarung50kg} Zak (@50kg)
                      </td>
                      <td className="p-2 text-slate-600 text-[11px]">{p.keterangan}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* JADWAL SINGKAT */}
            <div className="mt-3 pt-3 border-t border-emerald-200/60 grid grid-cols-1 md:grid-cols-3 gap-2">
              {fert.jadwalAplikasi.map((j, idx) => (
                <div key={idx} className="bg-white/80 border border-emerald-200 rounded-lg p-2 text-[11px]">
                  <p className="font-bold text-emerald-950">{j.fase}</p>
                  <p className="text-[10px] text-emerald-700 font-semibold">{j.waktuHST}</p>
                  <p className="text-slate-600 mt-1 leading-snug">{j.komposisi}</p>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 4: CATATAN SISTEM & AI */}
          <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 text-xs text-slate-700 mb-8">
            <span className="font-bold text-slate-900">Catatan Validasi Lapangan: </span>
            {activeFarmer.catatanAI || 'Data telah divalidasi dan tersinkronisasi langsung ke sistem database Google Sheets resmi.'}
          </div>

          {/* SIGNATURE BLOCK */}
          <div className="grid grid-cols-3 gap-6 text-center text-xs mt-6 pt-4 border-t border-slate-200">
            <div>
              <p className="text-slate-600">Petani Pemilik Lahan,</p>
              <div className="h-16 flex items-end justify-center">
                <span className="font-bold text-slate-900 underline">{activeFarmer.nama}</span>
              </div>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">Kontak: {activeFarmer.noHp || '—'}</p>
            </div>

            <div>
              <p className="text-slate-600">Koordinator PPL / BPP Lapangan,</p>
              <div className="h-16 flex items-center justify-center relative">
                {/* Simulated Official Digital Stamp */}
                <div className="w-20 h-20 rounded-full border-2 border-dashed border-emerald-600/70 text-emerald-800 flex flex-col items-center justify-center p-1 rotate-[-12deg] text-[8px] font-bold uppercase select-none opacity-85">
                  <span>DINAS PERTANIAN</span>
                  <span className="text-[7px]">TERVERIFIKASI</span>
                  <span className="text-[7px]">PPL BPP</span>
                </div>
              </div>
              <p className="font-bold text-slate-900 underline mt-1">Ir. Hendra Gunawan, M.P.</p>
              <p className="text-[10px] text-slate-500 font-mono">NIP. 19780514 200312 1 002</p>
            </div>

            <div>
              <p className="text-slate-600">Verifikator Data TaniAI,</p>
              <div className="h-16 flex items-end justify-center">
                <span className="font-bold text-slate-900 underline">Database Cloud Google Sheets</span>
              </div>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">ID: TANI-SYS-DIGITAL</p>
            </div>
          </div>

          {/* FOOTER */}
          <div className="mt-8 pt-3 border-t border-slate-200 text-center text-[10px] text-slate-400">
            Dokumen ini dicetak secara sah melalui Aplikasi TaniAI • Dilindungi Undang-Undang Perlindungan Data Petani & Ketahanan Pangan
          </div>
        </div>
      </div>
    </div>
  );
};
