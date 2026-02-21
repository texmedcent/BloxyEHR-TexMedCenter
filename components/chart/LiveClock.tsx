"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";

export function LiveClock() {
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="text-sm text-slate-600 dark:text-muted-foreground">
      {format(now, "EEEE, MMM d, yyyy • hh:mm:ss a")}
    </div>
  );
}
