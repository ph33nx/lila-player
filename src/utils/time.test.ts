import { describe, expect, it } from "vitest";
import { formatTime } from "./time";

describe("formatTime", () => {
  it("renders zero as 0:00", () => {
    expect(formatTime(0)).toBe("0:00");
  });

  it("floors the seconds rather than rounding them up", () => {
    expect(formatTime(59.99)).toBe("0:59");
  });

  it("rolls over to the next minute at 60 seconds", () => {
    expect(formatTime(60)).toBe("1:00");
  });

  it("keeps counting minutes at the last second below an hour", () => {
    expect(formatTime(3599)).toBe("59:59");
  });

  it("has no hour field: an hour is 60:00", () => {
    expect(formatTime(3600)).toBe("60:00");
  });

  it("renders a negative time as 0:00", () => {
    expect(formatTime(-1)).toBe("0:00");
  });

  it("renders NaN as 0:00", () => {
    expect(formatTime(Number.NaN)).toBe("0:00");
  });

  it("renders Infinity as 0:00", () => {
    expect(formatTime(Number.POSITIVE_INFINITY)).toBe("0:00");
  });
});
