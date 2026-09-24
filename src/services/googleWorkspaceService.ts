import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut as fbSignOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { FarmerRecord, SupplierRecord } from '../types';

export const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/spreadsheets',
];

// Initialize Firebase App singleton
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));
provider.setCustomParameters({
  prompt: 'select_account',
});

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && cachedAccessToken) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal memperoleh access token OAuth dari Google');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const logoutGoogle = async () => {
  await fbSignOut(auth);
  cachedAccessToken = null;
};

export interface DriveSpreadsheetFile {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

// 1. List user spreadsheets from Google Drive
export async function listUserSpreadsheets(accessToken: string): Promise<DriveSpreadsheetFile[]> {
  const query = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
  const fields = encodeURIComponent('files(id,name,modifiedTime,webViewLink)');
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&orderBy=modifiedTime%20desc&pageSize=25`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gagal mengambil daftar file Drive (${res.status})`);
  }

  const data = await res.json();
  return data.files || [];
}

// 2. Create a new Google Spreadsheet in the user's Google Drive
export async function createNewSpreadsheet(accessToken: string, title: string): Promise<DriveSpreadsheetFile> {
  const url = 'https://sheets.googleapis.com/v4/spreadsheets';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: title || `TaniAI_Database_${new Date().toISOString().slice(0, 10)}`,
      },
      sheets: [
        { properties: { title: 'Data Petani' } },
        { properties: { title: 'Data Mitra Supplier' } },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gagal membuat Google Sheet baru (${res.status})`);
  }

  const data = await res.json();
  return {
    id: data.spreadsheetId,
    name: data.properties?.title || title,
    webViewLink: data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`,
  };
}

// 3. Get metadata of a specific spreadsheet
export async function getSpreadsheetDetails(accessToken: string, spreadsheetId: string) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties,sheets.properties`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gagal membaca informasi spreadsheet (${res.status})`);
  }

  return res.json();
}

// 4. Direct Sync to user's Google Sheet
export async function syncToGoogleSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
  farmers: FarmerRecord[],
  suppliers: SupplierRecord[]
): Promise<{ success: boolean; updatedSheets: string[]; timestamp: string }> {
  // Check available sheet tabs
  const meta = await getSpreadsheetDetails(accessToken, spreadsheetId);
  const existingSheetTitles: string[] = (meta.sheets || []).map((s: any) => s.properties?.title);

  // Prepare Petani rows
  const farmerHeaders = [
    'ID Petani',
    'Waktu Pencatatan',
    'Nama Petani',
    'Nomor WhatsApp',
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

  const farmerValues = [
    farmerHeaders,
    ...farmers.map((f) => [
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
    ]),
  ];

  // Prepare Supplier rows
  const supplierHeaders = [
    'ID Supplier',
    'Waktu Terdaftar',
    'Nama Supplier / Kios',
    'Kategori Usaha',
    'Kontak WhatsApp',
    'Alamat',
    'Kabupaten',
    'Status Kemitraan',
    'Produk Unggulan',
    'Stok Tersedia',
    'Radius Layanan (Km)',
    'Jam Buka',
    'Petani Binaan',
    'Catatan',
  ];

  const supplierValues = [
    supplierHeaders,
    ...suppliers.map((s) => [
      s.id,
      s.timestamp || '',
      s.nama,
      s.kategori,
      s.kontak,
      s.alamat,
      s.kabupaten || '',
      s.statusKemitraan,
      Array.isArray(s.produkUnggulan) ? s.produkUnggulan.join(', ') : (s.produkUnggulan || ''),
      s.stokTersedia || '',
      s.radiusLayananKm || 0,
      s.jamBuka || '',
      s.petaniBinaanCount || 0,
      s.catatan || '',
    ]),
  ];

  // Decide target sheet names
  let farmerTargetSheet = existingSheetTitles.find((t) => t.toLowerCase().includes('petani')) || existingSheetTitles[0] || 'Sheet1';
  let supplierTargetSheet = existingSheetTitles.find((t) => t.toLowerCase().includes('supplier') || t.toLowerCase().includes('mitra'));

  const dataToUpdate: Array<{ range: string; values: any[][] }> = [
    {
      range: `'${farmerTargetSheet}'!A1:M${farmerValues.length + 10}`,
      values: farmerValues,
    },
  ];

  if (supplierTargetSheet) {
    dataToUpdate.push({
      range: `'${supplierTargetSheet}'!A1:N${supplierValues.length + 10}`,
      values: supplierValues,
    });
  }

  // Execute batchUpdate values
  const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`;
  const updateRes = await fetch(updateUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: dataToUpdate,
    }),
  });

  if (!updateRes.ok) {
    const err = await updateRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gagal menulis data ke Google Sheets (${updateRes.status})`);
  }

  return {
    success: true,
    updatedSheets: dataToUpdate.map((d) => d.range),
    timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  };
}
