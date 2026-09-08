"use client";

import { memo } from "react";
import { SettingsGroup } from "./advanced-panel";
import ParamGrid, { TONE_PARAMS } from "./param-grid";
import type { Params } from "@/engine";

interface ToneSectionProps {
  params: Params;
  onChange: (patch: Partial<Params>) => void;
}

const ToneSection: React.FC<ToneSectionProps> = memo(({ params, onChange }) => (
  <SettingsGroup
    title="Tone"
    description="The colour of tape and old speakers. Bass lifts the low end, Warmth rolls off the top, Drive adds soft saturation, Wobble adds tape flutter."
  >
    <ParamGrid specs={TONE_PARAMS} params={params} onChange={onChange} />
  </SettingsGroup>
));

ToneSection.displayName = "ToneSection";

export default ToneSection;
