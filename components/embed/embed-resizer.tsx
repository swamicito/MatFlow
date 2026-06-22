"use client";

import { useEffect } from "react";

/**
 * Invisible client component that keeps the parent iframe in sync with the
 * embed's actual content height.
 *
 * On mount it fires an initial postMessage, then a ResizeObserver fires
 * whenever the content grows or shrinks (e.g. after hydration, font load).
 *
 * Parent page usage:
 *   window.addEventListener('message', (e) => {
 *     if (e.data?.type === 'mf-height') {
 *       iframe.style.height = e.data.height + 'px';
 *     }
 *   });
 */
export function EmbedResizer() {
  useEffect(() => {
    function sendHeight() {
      const height = document.documentElement.scrollHeight;
      window.parent.postMessage({ type: "mf-height", height }, "*");
    }

    sendHeight();

    const observer = new ResizeObserver(sendHeight);
    observer.observe(document.body);

    return () => observer.disconnect();
  }, []);

  return null;
}
