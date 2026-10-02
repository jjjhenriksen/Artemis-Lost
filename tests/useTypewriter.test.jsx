import { act, renderHook } from "@testing-library/react";
import { useTypewriter } from "../src/hooks/useTypewriter.js";

function mockPreference(initial = false, legacy = false) {
  const listeners = new Set();
  const add = vi.fn((...args) => listeners.add(args.at(-1)));
  const remove = vi.fn((...args) => listeners.delete(args.at(-1)));
  const preference = {
    matches: initial,
    ...(legacy ? { addListener: add, removeListener: remove } : { addEventListener: add, removeEventListener: remove }),
  };
  vi.spyOn(window, "matchMedia").mockReturnValue(preference);
  return {
    add, remove, listeners,
    change(matches) {
      preference.matches = matches;
      act(() => listeners.forEach((listener) => listener({ matches })));
    },
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

test("reduced motion displays the full narration immediately without a timer", () => {
  mockPreference(true);
  const { result, rerender } = renderHook(({ text }) => useTypewriter(text), { initialProps: { text: "Full mission narration" } });
  expect(result.current).toEqual({ displayed: "Full mission narration", done: true });
  expect(vi.getTimerCount()).toBe(0);
  rerender({ text: "A new mission report" });
  expect(result.current).toEqual({ displayed: "A new mission report", done: true });
  expect(vi.getTimerCount()).toBe(0);
});

test("normal motion keeps the existing chunk cadence and completion behavior", () => {
  mockPreference();
  const { result } = renderHook(() => useTypewriter("Mission report", 18));
  expect(result.current).toEqual({ displayed: "", done: false });
  act(() => vi.advanceTimersByTime(27));
  expect(result.current.displayed).toBe("");
  act(() => vi.advanceTimersByTime(1));
  expect(result.current).toEqual({ displayed: "Mi", done: false });
  act(() => vi.advanceTimersByTime(1000));
  expect(result.current).toEqual({ displayed: "Mission report", done: true });
  expect(vi.getTimerCount()).toBe(0);
});

test.each([false, true])("enabling reduced motion mid-animation stops the timer (legacy listener: %s)", (legacy) => {
  const media = mockPreference(false, legacy);
  const { result, rerender, unmount } = renderHook(({ text }) => useTypewriter(text), { initialProps: { text: "Mission report" } });
  act(() => vi.advanceTimersByTime(28));
  expect(result.current.displayed).toBe("Mi");
  media.change(true);
  expect(result.current).toEqual({ displayed: "Mission report", done: true });
  expect(vi.getTimerCount()).toBe(0);
  media.change(false);
  expect(result.current).toEqual({ displayed: "Mission report", done: true });
  expect(vi.getTimerCount()).toBe(0);
  rerender({ text: "Next report" });
  expect(result.current).toEqual({ displayed: "", done: false });
  act(() => vi.advanceTimersByTime(28));
  expect(result.current.displayed).toBe("Ne");
  unmount();
  expect(media.listeners.size).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
});

test("text replacement clears old timers and cannot reveal old narration", () => {
  const media = mockPreference();
  const { result, rerender, unmount } = renderHook(({ text }) => useTypewriter(text), { initialProps: { text: "Old report" } });
  act(() => vi.advanceTimersByTime(28));
  rerender({ text: "New report" });
  expect(media.listeners.size).toBe(1);
  act(() => vi.advanceTimersByTime(28));
  expect(result.current.displayed).toBe("Ne");
  unmount();
  act(() => vi.advanceTimersByTime(1000));
  expect(vi.getTimerCount()).toBe(0);
  expect(media.listeners.size).toBe(0);
});

test("empty narration completes without timers or listeners", () => {
  const media = mockPreference();
  const { result } = renderHook(() => useTypewriter(""));
  expect(result.current).toEqual({ displayed: "", done: true });
  expect(vi.getTimerCount()).toBe(0);
  expect(media.listeners.size).toBe(0);
});
