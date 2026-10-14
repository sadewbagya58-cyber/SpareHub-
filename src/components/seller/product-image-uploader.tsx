"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import { Upload, X, Star, AlertCircle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { type ProductImageItem } from "@/lib/validators/product";

interface ProductImageUploaderProps {
  images: ProductImageItem[];
  onChange: (images: ProductImageItem[]) => void;
  maxImages?: number;
}

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function ProductImageUploader({
  images,
  onChange,
  maxImages = 8,
}: ProductImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setErrorMessage(null);

    if (images.length + files.length > maxImages) {
      setErrorMessage(`You can upload a maximum of ${maxImages} images.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    try {
      setIsUploading(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setErrorMessage("You must be logged in to upload images.");
        setIsUploading(false);
        return;
      }

      const newUploadedImages: ProductImageItem[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (!ALLOWED_MIME_TYPES.includes(file.type)) {
          setErrorMessage(
            `File "${file.name}" is not supported. Please upload JPEG, PNG, or WebP images only.`
          );
          continue;
        }

        if (file.size > MAX_FILE_SIZE) {
          setErrorMessage(
            `File "${file.name}" exceeds the 5MB size limit.`
          );
          continue;
        }

        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const cleanName = file.name
          .replace(/\.[^/.]+$/, "")
          .replace(/[^a-zA-Z0-9_-]/g, "_")
          .substring(0, 30);
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${cleanName}.${ext}`;
        // Path matches RLS constraint: (storage.foldername(name))[1] = auth.uid()::text
        const storagePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(storagePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          console.error("Upload error:", uploadError);
          setErrorMessage(`Failed to upload "${file.name}": ${uploadError.message}`);
          continue;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("product-images").getPublicUrl(storagePath);

        const isFirst = images.length === 0 && newUploadedImages.length === 0;

        newUploadedImages.push({
          image_url: publicUrl,
          alt_text: file.name.replace(/\.[^/.]+$/, ""),
          display_order: images.length + newUploadedImages.length,
          is_primary: isFirst,
        });
      }

      if (newUploadedImages.length > 0) {
        onChange([...images, ...newUploadedImages]);
      }
    } catch (err: unknown) {
      console.error("Upload error:", err);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred during upload."
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const setPrimary = (index: number) => {
    const updated = images.map((img, i) => ({
      ...img,
      is_primary: i === index,
    }));
    onChange(updated);
  };

  const removeImage = (index: number) => {
    const updated = images.filter((_, i) => i !== index);
    // If we removed the primary image and have other images, make the first one primary
    if (updated.length > 0 && !updated.some((img) => img.is_primary)) {
      updated[0].is_primary = true;
    }
    // Re-index display order
    const reindexed = updated.map((img, i) => ({
      ...img,
      display_order: i,
    }));
    onChange(reindexed);
  };

  const updateAltText = (index: number, alt: string) => {
    const updated = [...images];
    updated[index] = { ...updated[index], alt_text: alt };
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-sm font-bold text-sparehub-dark">
            Product Photos ({images.length}/{maxImages})
          </label>
          <p className="text-xs text-gray-500 mt-0.5">
            Upload clear photos from multiple angles (JPEG, PNG, WebP — max 5MB each). First image is the catalog cover.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || images.length >= maxImages}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-sparehub-light hover:bg-gray-200 text-sparehub-dark border border-sparehub-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-sparehub-orange" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-3.5 h-3.5 text-sparehub-orange" />
              Add Images
            </>
          )}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {errorMessage && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {images.length === 0 ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-sparehub-border hover:border-sparehub-orange rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer bg-gray-50/50 hover:bg-sparehub-light/40 transition-all group"
        >
          <div className="w-12 h-12 rounded-full bg-white shadow-xs flex items-center justify-center text-gray-400 group-hover:text-sparehub-orange group-hover:scale-110 transition-all mb-2">
            <Upload className="w-6 h-6" />
          </div>
          <span className="text-xs font-bold text-sparehub-dark">
            Click to upload product photographs
          </span>
          <span className="text-[11px] text-gray-400 mt-0.5">
            Up to 8 high-resolution images. First photo will be displayed on catalog cards.
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {images.map((img, idx) => (
            <div
              key={idx}
              className={`relative group rounded-xl border overflow-hidden bg-white flex flex-col ${
                img.is_primary
                  ? "border-sparehub-orange ring-2 ring-sparehub-orange/20"
                  : "border-sparehub-border"
              }`}
            >
              <div className="relative aspect-square w-full bg-gray-100">
                <Image
                  src={img.image_url}
                  alt={img.alt_text || `Product photo ${idx + 1}`}
                  fill
                  className="object-cover"
                  unoptimized
                />

                {img.is_primary && (
                  <span className="absolute top-2 left-2 inline-flex items-center gap-1 bg-sparehub-orange text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                    <Star className="w-3 h-3 fill-white" />
                    Cover
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 hover:bg-red-600 text-white flex items-center justify-center transition-colors shadow-xs"
                  title="Remove image"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-2 space-y-1.5 bg-white">
                <input
                  type="text"
                  placeholder="Alt text (e.g. Front view)"
                  value={img.alt_text || ""}
                  onChange={(e) => updateAltText(idx, e.target.value)}
                  className="w-full text-[11px] px-2 py-1 border border-sparehub-border rounded focus:border-sparehub-orange focus:outline-none"
                />

                {!img.is_primary && (
                  <button
                    type="button"
                    onClick={() => setPrimary(idx)}
                    className="w-full text-[10px] font-bold text-gray-500 hover:text-sparehub-orange text-center py-0.5 hover:bg-gray-50 rounded transition-colors"
                  >
                    Set as Cover
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
