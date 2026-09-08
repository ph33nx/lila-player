"use client";

import { MotionConfig } from "motion/react";

const MotionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <MotionConfig reducedMotion="user">{children}</MotionConfig>;

export default MotionProvider;
