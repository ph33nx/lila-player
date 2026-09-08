"use client";

import { memo } from "react";

interface StatusLineProps {
  error: string | null;
  savedName: string | null;
}

/**
 * The one message slot. Always mounted at a fixed height so no state above or
 * below it can move; an error outranks a saved notice.
 */
const StatusLine: React.FC<StatusLineProps> = memo(({ error, savedName }) => (
  <div className="flex h-4 items-center justify-center">
    {error ? (
      <p
        role="alert"
        title={error}
        className="truncate text-xs text-destructive"
      >
        {error}
      </p>
    ) : savedName ? (
      <p role="status" className="truncate text-xs text-muted-foreground">
        Saved {savedName}
      </p>
    ) : null}
  </div>
));

StatusLine.displayName = "StatusLine";

export default StatusLine;
