"use client";

import { memo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface SettingsGroupProps {
  title: string;
  description: string;
  /** A small control on the title row, such as a reset. */
  action?: React.ReactNode;
  children: React.ReactNode;
}

/** One titled block inside Advanced: heading, one line of what it does, then rows. */
export const SettingsGroup: React.FC<SettingsGroupProps> = ({
  title,
  description,
  action,
  children,
}) => (
  <section aria-label={title} className="space-y-2">
    <div className="flex items-center justify-between gap-4">
      <h2 className="text-sm font-medium text-foreground">{title}</h2>
      {action}
    </div>
    <p className="text-xs text-muted-foreground">{description}</p>
    {children}
  </section>
);

interface SettingsRowProps {
  label: string;
  value: React.ReactNode;
  control: React.ReactNode;
}

/** Label, current value, control: as wide as its content, never stretched. */
export const SettingsRow: React.FC<SettingsRowProps> = ({
  label,
  value,
  control,
}) => (
  <div className="flex h-8 items-center gap-3">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="font-mono text-xs tabular-nums text-foreground">
      {value}
    </span>
    {control}
  </div>
);

/** The disclosure that holds every settings group below the sliders. */
const AdvancedPanel: React.FC<{ children: React.ReactNode }> = memo(
  ({ children }) => {
    const [open, setOpen] = useState(false);
    const Chevron = open ? ChevronDown : ChevronRight;

    return (
      <div className="border-t border-border pt-3">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((previous) => !previous)}
          className="flex items-center gap-1 rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Chevron className="h-3.5 w-3.5" />
          Advanced
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              data-testid="advanced-panel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="mt-3 space-y-6"
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  },
);

AdvancedPanel.displayName = "AdvancedPanel";

export default AdvancedPanel;
