"use client";

import React, { useRef, useState, useEffect } from "react";
import {
  Upload,
  Trash2,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ImageIcon,
  Link2,
} from "lucide-react";
import {
  ALLOWED_SHOP_IMAGE_MIME_TYPES,
  MAX_SHOP_IMAGE_SIZE_BYTES,
  validateShopBrandingFile,
  type ShopBrandingAssetType,
} from "@/lib/validators/shop";
import {
  uploadShopBrandingImageAction,
  removeShopBrandingImageAction,
} from "@/lib/seller/actions";

interface ShopBrandingUploaderProps {
  assetType: ShopBrandingAssetType;
  name: "logo_url" | "cover_url";
  label: string;
  helperText: string;
  value: string;
  onChange: (nextUrl: string) => void;
  shopId?: string;
  shopName?: string;
  disabled?: boolean;
}

export function ShopBrandingUploader({
  assetType,
  name,
  label,
  helperText,
  value,
  onChange,
  shopId,
  shopName,
  disabled = false,
}: ShopBrandingUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);

  const assetLabel = assetType === "logo" ? "Shop logo" : "Cover banner";
  const displayUrl = localPreviewUrl || value;

  useEffect(() => {
    return () => {
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
      }
    };
  }, [localPreviewUrl]);

  const handleTriggerFileSelect = () => {
    if (disabled || isUploading || isRemoving) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    // Client-side validation
    const validation = validateShopBrandingFile(file, assetLabel);
    if (!validation.valid) {
      setErrorMessage(validation.error || `Invalid ${assetLabel.toLowerCase()} file.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Immediate preview before upload completes
    const objectUrl = URL.createObjectURL(file);
    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
    }
    setLocalPreviewUrl(objectUrl);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.set("assetType", assetType);
      formData.set("file", file);
      if (shopId) {
        formData.set("shopId", shopId);
      }
      if (value) {
        formData.set("previousUrl", value);
      }

      const result = await uploadShopBrandingImageAction(formData);

      if (result.error || !result.url) {
        setErrorMessage(result.error || `Failed to upload ${assetLabel.toLowerCase()}.`);
        URL.revokeObjectURL(objectUrl);
        setLocalPreviewUrl(null);
      } else {
        onChange(result.url);
        URL.revokeObjectURL(objectUrl);
        setLocalPreviewUrl(null);
        setSuccessMessage(
          result.message || `${assetLabel} uploaded successfully.`
        );
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : `An unexpected error occurred while uploading ${assetLabel.toLowerCase()}.`;
      setErrorMessage(msg);
      URL.revokeObjectURL(objectUrl);
      setLocalPreviewUrl(null);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveImage = async () => {
    if (disabled || isUploading || isRemoving || !displayUrl) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsRemoving(true);

    try {
      const result = await removeShopBrandingImageAction({
        shopId,
        assetType,
        currentUrl: value || null,
      });

      if (result.error) {
        setErrorMessage(result.error);
      } else {
        if (localPreviewUrl) {
          URL.revokeObjectURL(localPreviewUrl);
          setLocalPreviewUrl(null);
        }
        onChange("");
        setSuccessMessage(result.message || `${assetLabel} removed.`);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : `Failed to remove ${assetLabel.toLowerCase()}.`;
      setErrorMessage(msg);
    } finally {
      setIsRemoving(false);
    }
  };

  const maxSizeMb = Math.round(MAX_SHOP_IMAGE_SIZE_BYTES / (1024 * 1024));

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <label className="block text-xs font-semibold text-neutral-700">
          {label}
        </label>
        <button
          type="button"
          onClick={() => setShowUrlInput((prev) => !prev)}
          disabled={disabled || isUploading || isRemoving}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500 hover:text-[#FF6B00] transition-colors disabled:opacity-50"
        >
          <Link2 className="h-3 w-3" />
          {showUrlInput ? "Hide URL input" : "Use image URL"}
        </button>
      </div>

      {/* Hidden input keeps parent form submission in sync */}
      <input type="hidden" name={name} value={value} />

      {/* Hidden native file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_SHOP_IMAGE_MIME_TYPES.join(",")}
        onChange={handleFileChange}
        disabled={disabled || isUploading || isRemoving}
        className="hidden"
        aria-label={`Upload ${label}`}
      />

      {assetType === "logo" ? (
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl border border-neutral-200 bg-neutral-50/70 p-4">
          {/* Square Logo Preview Box */}
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-neutral-200 bg-white flex items-center justify-center shadow-xs">
            {displayUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={displayUrl}
                alt={shopName ? `${shopName} logo` : "Shop logo preview"}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-neutral-400">
                <ImageIcon className="h-7 w-7 stroke-[1.5]" />
                <span className="text-[10px] font-medium mt-0.5">No Logo</span>
              </div>
            )}
            {isUploading && (
              <div className="absolute inset-0 bg-neutral-900/60 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-white" />
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleTriggerFileSelect}
                disabled={disabled || isUploading || isRemoving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 hover:border-neutral-300 transition-colors shadow-2xs disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[#FF6B00]" />
                    Uploading...
                  </>
                ) : displayUrl ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 text-[#FF6B00]" />
                    Replace Logo
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5 text-[#FF6B00]" />
                    Upload Logo
                  </>
                )}
              </button>

              {displayUrl && (
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  disabled={disabled || isUploading || isRemoving}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50/70 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  {isRemoving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Remove
                </button>
              )}
            </div>
            <p className="text-[11px] text-neutral-500 leading-relaxed">
              {helperText} (JPG, PNG, WEBP up to {maxSizeMb}MB)
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-4 space-y-3">
          {/* Wide Cover Banner Preview Box */}
          <div className="relative h-32 sm:h-36 w-full overflow-hidden rounded-lg border border-neutral-200 bg-white flex items-center justify-center shadow-xs">
            {displayUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={displayUrl}
                alt={shopName ? `${shopName} cover banner` : "Cover banner preview"}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-neutral-400 px-4 text-center">
                <ImageIcon className="h-8 w-8 stroke-[1.5] mb-1" />
                <span className="text-xs font-medium text-neutral-500">
                  No Cover Banner Uploaded
                </span>
                <span className="text-[11px] text-neutral-400">
                  Recommended 1200×320px wide storefront header image
                </span>
              </div>
            )}
            {isUploading && (
              <div className="absolute inset-0 bg-neutral-900/60 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleTriggerFileSelect}
                disabled={disabled || isUploading || isRemoving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 hover:border-neutral-300 transition-colors shadow-2xs disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[#FF6B00]" />
                    Uploading...
                  </>
                ) : displayUrl ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 text-[#FF6B00]" />
                    Replace Banner
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5 text-[#FF6B00]" />
                    Upload Cover Banner
                  </>
                )}
              </button>

              {displayUrl && (
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  disabled={disabled || isUploading || isRemoving}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50/70 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  {isRemoving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Remove
                </button>
              )}
            </div>

            <p className="text-[11px] text-neutral-500">
              {helperText} (JPG, PNG, WEBP up to {maxSizeMb}MB)
            </p>
          </div>
        </div>
      )}

      {/* Optional direct URL fallback */}
      {showUrlInput && (
        <div className="pt-1">
          <input
            type="url"
            value={value}
            onChange={(e) => {
              setErrorMessage(null);
              setSuccessMessage(null);
              onChange(e.target.value);
            }}
            disabled={disabled || isUploading || isRemoving}
            placeholder="https://example.com/image.jpg"
            className="w-full rounded-lg border border-neutral-200 bg-white px-3.5 py-2 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-[#FF6B00] focus:outline-none disabled:bg-neutral-100"
          />
        </div>
      )}

      {/* Feedback banners */}
      {errorMessage && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && !errorMessage && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>{successMessage}</span>
        </div>
      )}
    </div>
  );
}
