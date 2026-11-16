/**
 * Shared types matching the public schema.
 */
export type PropertyType = "apartment" | "house" | "studio" | "room" | "commercial";
export type CityCorp = "none" | "DNCC" | "DSCC";
export type BuildingType = "residential_flat" | "standalone_house" | "commercial_studio" | "sublet_mess";

export interface Listing {
  id: string;
  landlord_id: string;
  title: string;
  description: string;
  price: number;
  location: string;
  property_type: PropertyType;
  bedrooms: number;
  bathrooms: number;
  area_sqft: number | null;
  images: string[];
  is_active: boolean;
  created_at: string;

  // BD administrative + address fields (added in 2026-05 migration)
  division: string | null;
  district: string | null;
  city_corporation: CityCorp;
  thana: string | null;
  ward_number: number | null;
  zone: string | null;
  area_moholla: string | null;
  block_sector: string | null;
  road_no: string | null;
  avenue_lane: string | null;
  holding_number: string | null;
  house_name: string | null;
  floor_unit: string | null;
  landmarks: string | null;
  geo_location: string | null;
  building_type: BuildingType;
  latitude: number | null;
  longitude: number | null;
  landlord_kyc_status?: string | null;
  landlord_custom_uid?: string | null;
}

export const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: "apartment", label: "Apartment" },
  { value: "house", label: "House" },
  { value: "studio", label: "Studio" },
  { value: "room", label: "Room" },
  { value: "commercial", label: "Commercial" },
];

/** Format BDT money */
export const fmtBDT = (n: number) =>
  new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT", maximumFractionDigits: 0 }).format(n);

/**
 * Compresses an image File to an optimized JPEG data URL (max 1280px dimension, 0.82 quality).
 * Keeps file size small (~80-150KB) so the image always uploads and displays even if
 * cloud storage buckets are temporarily unavailable or not yet created.
 */
export async function fileToOptimizedDataUrl(file: File, maxWidth = 1280, maxHeight = 1280, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Failed to load image for processing"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/** Stable placeholder image for a listing without images */
export const placeholderImage = (seed: string) =>
  `https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=800&q=70&sig=${encodeURIComponent(seed)}`;

/**
 * Build a human-readable address string from the structured BD fields.
 * Falls back to the legacy `location` field if structured data is missing.
 */
export function formatAddress(l: Pick<Listing,
  "house_name" | "road_no" | "area_moholla" | "block_sector" | "thana" | "district" | "division" | "location"
>): string {
  const parts = [
    l.house_name,
    l.road_no ? `Road ${l.road_no}` : null,
    l.area_moholla,
    l.block_sector,
    l.thana,
    l.district,
    l.division,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : (l.location || "Address not provided");
}
