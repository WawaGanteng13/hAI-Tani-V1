/**
 * Kalkulator Agronomi & Rekomendasi Pemupukan Terstandar
 * Berdasarkan acuan rekomendasi Badan Litbang Pertanian (Balitbangtan) / Kementerian Pertanian RI
 */

export interface FertilizerRequirement {
  jenis: string; // e.g. "Urea", "NPK Phonska (15-15-15)", "Pupuk Organik"
  dosisPerHaKg: number;
  totalKg: number;
  totalKarung50kg: number;
  keterangan: string;
}

export interface FertilizerPhaseSchedule {
  fase: string;
  waktuHST: string; // Hari Setelah Tanam
  komposisi: string;
  caraAplikasi: string;
}

export interface AgronomyRecommendationResult {
  komoditas: string;
  luasLahanHa: number;
  luasLahanM2: number;
  pupuk: FertilizerRequirement[];
  jadwalAplikasi: FertilizerPhaseSchedule[];
  catatanKhusus: string[];
}

export function calculateFertilizerRecommendation(
  komoditasRaw: string,
  luasLahanHa: number
): AgronomyRecommendationResult {
  const normCrop = (komoditasRaw || '').toLowerCase();
  const ha = Math.max(0.01, luasLahanHa || 1);
  const m2 = Math.round(ha * 10000);

  // 1. Padi Sawah (Inpari / Ciherang / dll)
  if (normCrop.includes('padi') || normCrop.includes('beras') || normCrop.includes('gabah')) {
    const ureaKg = Math.round(225 * ha);
    const npkKg = Math.round(300 * ha);
    const organikKg = Math.round(1000 * ha);
    const sp36Kg = Math.round(50 * ha);

    return {
      komoditas: 'Padi Sawah',
      luasLahanHa: ha,
      luasLahanM2: m2,
      pupuk: [
        {
          jenis: 'Urea (46% N)',
          dosisPerHaKg: 225,
          totalKg: ureaKg,
          totalKarung50kg: Math.ceil(ureaKg / 50),
          keterangan: 'Pemicu pertumbuhan vegetatif, anakan produktif, dan klorofil daun.',
        },
        {
          jenis: 'NPK Phonska (15-15-15)',
          dosisPerHaKg: 300,
          totalKg: npkKg,
          totalKarung50kg: Math.ceil(npkKg / 50),
          keterangan: 'Unsur hara makro seimbang pembentuk akar kokoh dan pengisian bulir.',
        },
        {
          jenis: 'Pupuk Organik / Kompos (Petroganik)',
          dosisPerHaKg: 1000,
          totalKg: organikKg,
          totalKarung50kg: Math.ceil(organikKg / 50),
          keterangan: 'Memperbaiki biologi tanah, aerasi, dan kapasitas tukar kation (KTK).',
        },
        {
          jenis: 'SP-36 (Opsional)',
          dosisPerHaKg: 50,
          totalKg: sp36Kg,
          totalKarung50kg: Math.ceil(sp36Kg / 50),
          keterangan: 'Khusus lahan defisiensi Fosfor untuk pengakaran awal tanaman.',
        },
      ],
      jadwalAplikasi: [
        {
          fase: 'Pemupukan Dasar',
          waktuHST: '0 - 7 HST (Hari Setelah Tanam)',
          komposisi: `Organik: ${Math.round(organikKg)} kg (100%), NPK: ${Math.round(npkKg * 0.35)} kg, Urea: ${Math.round(ureaKg * 0.25)} kg`,
          caraAplikasi: 'Tabur merata pada kondisi air macak-macak (lahan basah tanpa genangan tinggi).',
        },
        {
          fase: 'Susulan I (Fase Vegetatif Aktif)',
          waktuHST: '21 - 25 HST',
          komposisi: `NPK: ${Math.round(npkKg * 0.35)} kg, Urea: ${Math.round(ureaKg * 0.45)} kg`,
          caraAplikasi: 'Tabur pada pangkal rumpun padi setelah penyiangan gulma.',
        },
        {
          fase: 'Susulan II (Fase Primordia / Bunting)',
          waktuHST: '38 - 45 HST',
          komposisi: `NPK: ${Math.round(npkKg * 0.30)} kg, Urea: ${Math.round(ureaKg * 0.30)} kg`,
          caraAplikasi: 'Tabur saat pembentukan malai bulir. Jaga ketinggian air 3-5 cm.',
        },
      ],
      catatanKhusus: [
        'Gunakan bagan warna daun (BWD) sebelum penambahan Urea susulan kedua untuk menghindari tanaman rebah.',
        'Hindari memupuk saat hujan deras atau saat genangan air meluap agar hara tidak hanyut.',
      ],
    };
  }

  // 2. Jagung (Hibrida / Manis)
  if (normCrop.includes('jagung')) {
    const ureaKg = Math.round(300 * ha);
    const npkKg = Math.round(350 * ha);
    const organikKg = Math.round(1500 * ha);

    return {
      komoditas: 'Jagung Hibrida',
      luasLahanHa: ha,
      luasLahanM2: m2,
      pupuk: [
        {
          jenis: 'Urea (46% N)',
          dosisPerHaKg: 300,
          totalKg: ureaKg,
          totalKarung50kg: Math.ceil(ureaKg / 50),
          keterangan: 'Mendorong tinggi batang dan lebar daun jagung.',
        },
        {
          jenis: 'NPK Phonska / NPK 15-15-15',
          dosisPerHaKg: 350,
          totalKg: npkKg,
          totalKarung50kg: Math.ceil(npkKg / 50),
          keterangan: 'Memperkuat perakaran dan pengisian biji tongkol.',
        },
        {
          jenis: 'Pupuk Organik Matang',
          dosisPerHaKg: 1500,
          totalKg: organikKg,
          totalKarung50kg: Math.ceil(organikKg / 50),
          keterangan: 'Meningkatkan daya pegang air dan kesuburan tanah gembur.',
        },
      ],
      jadwalAplikasi: [
        {
          fase: 'Pemupukan Dasar',
          waktuHST: '7 - 10 HST',
          komposisi: `NPK: ${Math.round(npkKg * 0.35)} kg, Urea: ${Math.round(ureaKg * 0.25)} kg, Organik: 100%`,
          caraAplikasi: 'Tugal 5-7 cm di samping lubang benih, tutup tanah.',
        },
        {
          fase: 'Susulan I',
          waktuHST: '28 - 30 HST',
          komposisi: `NPK: ${Math.round(npkKg * 0.35)} kg, Urea: ${Math.round(ureaKg * 0.40)} kg`,
          caraAplikasi: 'Tugal 10 cm dari batang jagung bersamaan dengan pembumbunan.',
        },
        {
          fase: 'Susulan II',
          waktuHST: '45 - 50 HST (Menjelang Keluar Bunga)',
          komposisi: `NPK: ${Math.round(npkKg * 0.30)} kg, Urea: ${Math.round(ureaKg * 0.35)} kg`,
          caraAplikasi: 'Tugal di antara barisan tanaman sebelum malai mekar.',
        },
      ],
      catatanKhusus: [
        'Selalu tutup lubang tugal dengan tanah agar pupuk Urea tidak menguap menjadi gas amonia.',
        'Pastikan kondisi tanah cukup lembap saat pemupukan dilakukan.',
      ],
    };
  }

  // 3. Cabai (Rawit / Merah)
  if (normCrop.includes('cabai') || normCrop.includes('cabe')) {
    const npkKg = Math.round(450 * ha);
    const kalsiumKg = Math.round(150 * ha);
    const kclKg = Math.round(125 * ha);
    const organikTon = Number((12 * ha).toFixed(1));

    return {
      komoditas: 'Cabai Rawit / Merah',
      luasLahanHa: ha,
      luasLahanM2: m2,
      pupuk: [
        {
          jenis: 'NPK 16-16-16 (Mutiara / YaraMila)',
          dosisPerHaKg: 450,
          totalKg: npkKg,
          totalKarung50kg: Math.ceil(npkKg / 50),
          keterangan: 'Nutrisi makro lengkap fase vegetatif dan pembuahan lebat.',
        },
        {
          jenis: 'Pupuk Kandang Matang / Kompos',
          dosisPerHaKg: 12000,
          totalKg: Math.round(organikTon * 1000),
          totalKarung50kg: Math.ceil((organikTon * 1000) / 50),
          keterangan: 'Sebagai pupuk dasar bedengan sebelum pemasangan mulsa plastik hitam perak.',
        },
        {
          jenis: 'Kalsium Nitrat (CN / Karate Plus)',
          dosisPerHaKg: 150,
          totalKg: kalsiumKg,
          totalKarung50kg: Math.ceil(kalsiumKg / 50),
          keterangan: 'Mencegah busuk pantat buah (beror / blossom end rot) dan rontok bunga.',
        },
        {
          jenis: 'KCl (Kalium Klorida)',
          dosisPerHaKg: 125,
          totalKg: kclKg,
          totalKarung50kg: Math.ceil(kclKg / 50),
          keterangan: 'Meningkatkan bobot buah, ketebalan dinding buah cabai, dan daya simpan.',
        },
      ],
      jadwalAplikasi: [
        {
          fase: 'Pemupukan Dasar Bedengan',
          waktuHST: 'H-14 s.d H-7 sebelum tanam',
          komposisi: `Pupuk Kandang: ${organikTon} Ton, NPK 16-16-16: ${Math.round(npkKg * 0.4)} kg, Dolomit: disesuaikan pH`,
          caraAplikasi: 'Aduk merata pada bedengan, siram basah, lalu pasang mulsa plastik.',
        },
        {
          fase: 'Kocoran Fase Vegetatif Awal',
          waktuHST: '7, 14, 21, dan 28 HST',
          komposisi: 'Larutan NPK 3-4 gram per liter air (200-250 ml per lubang tanaman)',
          caraAplikasi: 'Kocorkan langsung ke perakaran tanaman pada pagi hari.',
        },
        {
          fase: 'Kocoran Fase Generatif & Panen',
          waktuHST: 'Mulai 35 HST setiap 7-10 hari sekali',
          komposisi: 'NPK 16-16-16 + Kalsium + KCl (5-7 gram per liter air)',
          caraAplikasi: 'Kocorkan bergantian dengan penyemprotan pupuk daun kalsium boron.',
        },
      ],
      catatanKhusus: [
        'Kunci cabai lebat: hindari pemberian pupuk N murni berlebih saat curah hujan tinggi untuk mencegah layu fusarium.',
        'Kalsium disemprotkan secara berkala saat pembentukan buah pertama.',
      ],
    };
  }

  // 4. Bawang Merah
  if (normCrop.includes('bawang')) {
    const npkKg = Math.round(400 * ha);
    const zaKg = Math.round(200 * ha);
    const kclKg = Math.round(150 * ha);
    const kandangTon = Number((8 * ha).toFixed(1));

    return {
      komoditas: 'Bawang Merah',
      luasLahanHa: ha,
      luasLahanM2: m2,
      pupuk: [
        {
          jenis: 'NPK 16-16-16',
          dosisPerHaKg: 400,
          totalKg: npkKg,
          totalKarung50kg: Math.ceil(npkKg / 50),
          keterangan: 'Mendukung pembesaran umbi dan kekerasan kulit.',
        },
        {
          jenis: 'ZA (Amonium Sulfat 24% S)',
          dosisPerHaKg: 200,
          totalKg: zaKg,
          totalKarung50kg: Math.ceil(zaKg / 50),
          keterangan: 'Kandungan Sulfur (S) sangat krusial untuk aroma pedas dan mutu umbi.',
        },
        {
          jenis: 'KCl (Kalium Klorida)',
          dosisPerHaKg: 150,
          totalKg: kclKg,
          totalKarung50kg: Math.ceil(kclKg / 50),
          keterangan: 'Mencegah susut bobot umbi saat penjemuran di gudang.',
        },
      ],
      jadwalAplikasi: [
        {
          fase: 'Pemupukan Dasar',
          waktuHST: 'H-3 sebelum tanam',
          komposisi: `Pupuk Kandang: ${kandangTon} Ton, NPK: ${Math.round(npkKg * 0.4)} kg`,
          caraAplikasi: 'Campur merata pada bedengan halus.',
        },
        {
          fase: 'Susulan I',
          waktuHST: '10 - 15 HST',
          komposisi: `NPK: ${Math.round(npkKg * 0.3)} kg, ZA: ${Math.round(zaKg * 0.5)} kg`,
          caraAplikasi: 'Tabur di antara larikan tanaman lalu siram air.',
        },
        {
          fase: 'Susulan II',
          waktuHST: '30 - 35 HST (Pembentukan Umbi)',
          komposisi: `NPK: ${Math.round(npkKg * 0.3)} kg, ZA: ${Math.round(zaKg * 0.5)} kg, KCl: ${kclKg} kg`,
          caraAplikasi: 'Tabur merata lalu siram secukupnya.',
        },
      ],
      catatanKhusus: [
        'Sulfur (S) dari ZA mutlak diperlukan tanaman bawang merah untuk pembentukan allicin.',
        'Hentikan pemupukan 15 hari sebelum panen untuk mematangkan umbi secara alami.',
      ],
    };
  }

  // 5. Default Umum Hortikultura / Tanaman Pangan
  const ureaKg = Math.round(200 * ha);
  const npkKg = Math.round(300 * ha);
  const organikKg = Math.round(1000 * ha);

  return {
    komoditas: komoditasRaw || 'Tanaman Pangan / Hortikultura',
    luasLahanHa: ha,
    luasLahanM2: m2,
    pupuk: [
      {
        jenis: 'NPK Seimbang (15-15-15)',
        dosisPerHaKg: 300,
        totalKg: npkKg,
        totalKarung50kg: Math.ceil(npkKg / 50),
        keterangan: 'Kebutuhan hara dasar makro tanaman pangan.',
      },
      {
        jenis: 'Urea (46% N)',
        dosisPerHaKg: 200,
        totalKg: ureaKg,
        totalKarung50kg: Math.ceil(ureaKg / 50),
        keterangan: 'Pendorong pembentukan daun dan batang awal.',
      },
      {
        jenis: 'Pupuk Organik / Kompos',
        dosisPerHaKg: 1000,
        totalKg: organikKg,
        totalKarung50kg: Math.ceil(organikKg / 50),
        keterangan: 'Kondisioner tanah dan aktivator mikrobia tanah.',
      },
    ],
    jadwalAplikasi: [
      {
        fase: 'Dasar',
        waktuHST: '0 - 7 HST',
        komposisi: `Organik: ${organikKg} kg, NPK: ${Math.round(npkKg * 0.4)} kg`,
        caraAplikasi: 'Tabur merata saat pengolahan tanah.',
      },
      {
        fase: 'Susulan I',
        waktuHST: '21 HST',
        komposisi: `NPK: ${Math.round(npkKg * 0.3)} kg, Urea: ${Math.round(ureaKg * 0.5)} kg`,
        caraAplikasi: 'Tugal atau tabur di samping tanaman.',
      },
      {
        fase: 'Susulan II',
        waktuHST: '45 HST',
        komposisi: `NPK: ${Math.round(npkKg * 0.3)} kg, Urea: ${Math.round(ureaKg * 0.5)} kg`,
        caraAplikasi: 'Tabur pada fase generatif pembungaan.',
      },
    ],
    catatanKhusus: [
      'Gunakan pemupukan berimbang 4T (Tepat Dosis, Tepat Waktu, Tepat Jenis, Tepat Cara).',
      'Kombinasikan dengan pupuk hayati mikoriza atau PGPR untuk efisiensi penyerapan hara.',
    ],
  };
}
