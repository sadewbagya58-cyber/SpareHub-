"use client";

import React, { useState } from "react";
import Image from "next/image";

interface ProductGalleryProps {
  images: Array<{
    id?: string;
    image_url: string;
    alt_text?: string | null;
    is_primary?: boolean;
  }>;
  title: string;
}

export function ProductGallery({ images, title }: ProductGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (!images || images.length === 0) {
    return (
      <div className="aspect-square w-full rounded-2xl bg-gray-100 flex flex-col items-center justify-center p-8 border border-sparehub-border text-center">
        <div className="w-16 h-16 rounded-full bg-white shadow-xs flex items-center justify-center text-sparehub-orange text-2xl font-black mb-2">
          ⚙️
        </div>
        <span className="text-xs font-bold text-gray-400">
          No product images uploaded
        </span>
      </div>
    );
  }

  const activeImage = images[selectedIndex] || images[0];

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Main Feature Image - compact on mobile, full on desktop */}
      <div className="relative aspect-4/3 sm:aspect-square max-h-[300px] sm:max-h-[480px] w-full rounded-2xl bg-white border border-sparehub-border overflow-hidden shadow-xs">
        <Image
          src={activeImage.image_url}
          alt={activeImage.alt_text || title}
          fill
          className="object-contain sm:object-cover"
          unoptimized
          priority
        />
      </div>

      {/* Thumbnails Strip */}
      {images.length > 1 && (
        <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto pb-1">
          {images.map((img, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setSelectedIndex(idx)}
              className={`relative w-14 h-14 sm:w-20 sm:h-20 rounded-xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                selectedIndex === idx
                  ? "border-sparehub-orange ring-2 ring-sparehub-orange/20 scale-102"
                  : "border-sparehub-border hover:border-gray-400 opacity-70 hover:opacity-100"
              }`}
            >
              <Image
                src={img.image_url}
                alt={img.alt_text || `Thumbnail ${idx + 1}`}
                fill
                className="object-cover"
                unoptimized
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
