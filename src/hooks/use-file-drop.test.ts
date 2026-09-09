// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeFile } from "../test/web-audio-stub";
import { useFileDrop } from "./use-file-drop";

/**
 * A drag event shaped the way WebKit delivers it: `types` says "Files" from the
 * first dragenter, `items` stays empty until the drop, `files` fills on drop.
 */
const dragEvent = (
  type: string,
  files: File[] = [],
  types: string[] = ["Files"],
): Event & { preventDefault: () => void; defaultPrevented: boolean } => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", {
    value: { types, items: [], files, dropEffect: "none" },
  });
  return event;
};

afterEach(() => vi.useRealTimers());

describe("useFileDrop", () => {
  it("claims a file drag WebKit-style, where only types announces the files", () => {
    const onFile = vi.fn();
    const { result } = renderHook(() => useFileDrop(onFile));

    const enter = dragEvent("dragenter");
    const over = dragEvent("dragover");
    act(() => {
      window.dispatchEvent(enter);
      window.dispatchEvent(over);
    });
    expect(enter.defaultPrevented).toBe(true);
    expect(over.defaultPrevented).toBe(true);
    expect(result.current.isDragging).toBe(true);

    const song = makeFile("song.flac", 8, "");
    const drop = dragEvent("drop", [song]);
    act(() => {
      window.dispatchEvent(drop);
    });
    expect(drop.defaultPrevented).toBe(true);
    expect(onFile).toHaveBeenCalledWith(song);
    expect(result.current.isDragging).toBe(false);
  });

  it("cancels every drop so the page never navigates, even for non-files", () => {
    const onFile = vi.fn();
    renderHook(() => useFileDrop(onFile));

    const over = dragEvent("dragover", [], ["text/plain"]);
    const drop = dragEvent("drop", [], ["text/plain"]);
    act(() => {
      window.dispatchEvent(over);
      window.dispatchEvent(drop);
    });
    expect(over.defaultPrevented).toBe(true);
    expect(drop.defaultPrevented).toBe(true);
    expect(onFile).not.toHaveBeenCalled();
  });

  it("refuses a non-audio file and clears the refusal after a moment", () => {
    vi.useFakeTimers();
    const onFile = vi.fn();
    const { result } = renderHook(() => useFileDrop(onFile));

    act(() => {
      window.dispatchEvent(dragEvent("dragenter"));
      window.dispatchEvent(
        dragEvent("drop", [makeFile("notes.txt", 8, "text/plain")]),
      );
    });
    expect(onFile).not.toHaveBeenCalled();
    expect(result.current.isRejected).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2100);
    });
    expect(result.current.isRejected).toBe(false);
  });
});
