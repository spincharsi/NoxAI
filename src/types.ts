export interface Medicine {
  id: string;
  name: string;
  formula: string;
  salts: string[];
  category: string;
  purposeEn: string;
  purposeUr: string;
  usage: string;
  sideEffects: string[];
  warnings: string[];
  brands: Brand[];
}

export interface Brand {
  name: string;
  company: string;
  pricePerPack: number;
  packSize: string;
  form: MedicineForm;
}

export type MedicineForm = 'Tablet' | 'Capsule' | 'Syrup' | 'Injection' | 'Cream' | 'Drops' | 'Inhaler';

export interface DoseSchedule {
  id: string;
  medicineName: string;
  time: string;
  days: string[];
  note?: string;
}

export interface ScanResult {
  medicine: Medicine;
  detectedText: string;
  confidence: number;
  source: 'image' | 'text';
}

// ─── Prescription Scanner Types ────────────────────────────────────────────────

export interface PrescriptionMedication {
  originalBrand: string;
  purposeEn: string;
  purposeUr: string;
  dosageEn: string;
  dosageUr: string;
  altMed: string;
  altPrice: number;
  originalPrice: number;
  savings: number;
}

export interface PrescriptionScanResult {
  diseaseEn: string;
  diseaseUr: string;
  medications: PrescriptionMedication[];
  scanned_at: string;
}

// ─── Auth Types ────────────────────────────────────────────────────────────────

export interface NoxaiUser {
  name: string;
  email: string;
  isLoggedIn: true;
}

export const NOXAI_USER_STORAGE_KEY = 'noxai_user';
