import { z } from "zod";

const stringField = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value === undefined ? undefined : value));

export const AdminPayloadSchema = z
  .object({
    nama: z.string().trim().min(2).max(120),
    noHp: z.string().trim().min(8).max(30),
    instansi: z.string().trim().min(2).max(120).optional(),
    role: z.string().trim().min(2).max(80).optional(),
    izinAkses: z.array(z.string().trim().min(2).max(60)).max(20).optional(),
    aktif: z.boolean().optional(),
  })
  .passthrough();

export const FarmerPayloadSchema = z
  .object({
    nama: stringField(150),
    noHp: stringField(30),
    alamat: stringField(200),
    kabupaten: stringField(80),
    luasLahan: z.coerce.number().gt(0).max(10000).optional(),
    luasLahanFormatted: stringField(50),
    komoditas: stringField(100),
    varietas: stringField(100),
    estimasiPanen: stringField(80),
    estimasiHasilTon: z.coerce.number().nonnegative().max(5000).optional(),
    statusVerifikasi: z.enum(["Terverifikasi", "Menunggu Verifikasi", "Perlu Klarifikasi"]).optional(),
    catatanAI: stringField(500),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    supplierTerhubungId: stringField(40),
  })
  .passthrough();

export const SupplierPayloadSchema = z
  .object({
    nama: stringField(150),
    kategori: stringField(80),
    kontak: stringField(30),
    alamat: stringField(200),
    kabupaten: stringField(120),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    statusKemitraan: stringField(80),
    produkUnggulan: z.array(z.string().trim().max(80)).max(20).optional(),
    stokTersedia: stringField(100),
    radiusLayananKm: z.coerce.number().min(0).max(500).optional(),
    jamBuka: stringField(160),
    petaniBinaanCount: z.coerce.number().int().nonnegative().max(5000).optional(),
    catatan: stringField(500),
    googleSheetRow: z.coerce.number().int().nonnegative().optional(),
    timestamp: stringField(50),
    syncStatus: stringField(40),
  })
  .passthrough();

export const WebhookPayloadSchema = z
  .object({
    event: z.string().trim().max(120).optional(),
    sheetName: z.string().trim().max(120).optional(),
    row: z.coerce.number().int().positive().optional(),
    col: z.coerce.number().int().positive().optional(),
    value: z.any().optional(),
    message: z.string().trim().max(500).optional(),
  })
  .passthrough();
