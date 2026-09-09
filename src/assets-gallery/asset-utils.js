import { useEffect, useState } from 'react';

export const assetUrl = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
export function useInViewport(ref) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current) return undefined;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '40px' });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);
  return visible;
}
