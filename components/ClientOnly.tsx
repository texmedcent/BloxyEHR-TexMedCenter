"use client";

import { useEffect, useState } from "react";

/**
 * Renders children only after mount to avoid hydration mismatches
 * with components that generate different server vs client output
 * (e.g. Radix UI with auto-generated IDs).
 */
export function ClientOnly({
  children,
  fallback = null,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <>{fallback}</>;
  return <>{children}</>;
}
