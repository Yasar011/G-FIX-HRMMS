"use client";

import { useRef, useState, type SyntheticEvent } from "react";

export function ImageSlot({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const checkedInitial = useRef(false);

  function checkAlreadyFailed(img: HTMLImageElement | null) {
    // The browser may start loading (and failing) the server-rendered <img>
    // before React hydrates and attaches onError, so the error event is
    // missed. Catch that case once on mount via the ref callback.
    if (!img || checkedInitial.current) return;
    checkedInitial.current = true;
    if (img.complete && img.naturalWidth === 0) {
      setFailed(true);
    }
  }

  function handleError(event: SyntheticEvent<HTMLImageElement>) {
    checkedInitial.current = true;
    setFailed(true);
    void event;
  }

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center bg-zinc-200 text-xs text-zinc-400 dark:bg-zinc-800 ${className ?? ""}`}
      >
        {alt}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={checkAlreadyFailed}
      src={src}
      alt={alt}
      className={className}
      onError={handleError}
    />
  );
}
