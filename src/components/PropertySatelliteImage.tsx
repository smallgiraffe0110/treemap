"use client";

import { useEffect, useState } from "react";

const FALLBACK_SVG =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'><path d='M24 6c-6 6-9 11-9 16a9 9 0 0018 0c0-5-3-10-9-16z' stroke='%23666' stroke-width='1.5' fill='none'/><path d='M24 24v18' stroke='%23666' stroke-width='1.5' stroke-linecap='round'/></svg>";

function buildSrc(lat: number, lng: number, zoom: number): string {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  if (key) {
    return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=600x300&maptype=satellite&markers=color:red%7C${lat},${lng}&key=${key}`;
  }
  const dLat = 0.0015;
  const dLng = 0.0020;
  const minLat = lat - dLat;
  const maxLat = lat + dLat;
  const minLng = lng - dLng;
  const maxLng = lng + dLng;
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${minLng},${minLat},${maxLng},${maxLat}&bboxSR=4326&imageSR=4326&size=600,300&format=jpg&f=image`;
}

export function PropertySatelliteImage({
  lat,
  lng,
  zoom = 18,
  className = "",
}: {
  lat: number;
  lng: number;
  zoom?: number;
  className?: string;
}) {
  const [showSkeleton, setShowSkeleton] = useState(true);

  useEffect(() => {
    setShowSkeleton(true);
    const t = setTimeout(() => setShowSkeleton(false), 250);
    return () => clearTimeout(t);
  }, [lat, lng, zoom]);

  const src = buildSrc(lat, lng, zoom);

  return (
    <div
      className={`relative h-[140px] w-full overflow-hidden rounded-md border border-[var(--border)] ${className}`}
    >
      {showSkeleton && (
        <div className="absolute inset-0 animate-pulse bg-[var(--panel-2)]" aria-hidden="true" />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Satellite view of property"
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
        onError={(e) => {
          const target = e.currentTarget;
          if (target.src !== FALLBACK_SVG) target.src = FALLBACK_SVG;
        }}
      />
      <span className="pointer-events-none absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.18em] text-white">
        SAT IMG
      </span>
    </div>
  );
}
