import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import App from "../src/app/App.jsx";

const mocks = vi.hoisted(() => ({ listSessions: vi.fn() }));
vi.mock("../src/services/sessionApi.js", () => ({ listSessions: mocks.listSessions, loadSession: vi.fn(), saveSession: vi.fn(), deleteSession: vi.fn() }));

beforeEach(() => { vi.resetAllMocks(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const slots = [{ id: "slot-1", label: "Slot 1", session: null }];

test.each(["network", "server"])("recovers the menu from a %s failure and retries the saved slots", async (kind) => {
  if (kind === "network") mocks.listSessions.mockRejectedValueOnce(new TypeError("Failed to fetch"));
  else mocks.listSessions.mockResolvedValueOnce({ error: "Storage unavailable" });
  mocks.listSessions.mockResolvedValueOnce({ slots, activeSlotId: null });
  render(<App />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Saved missions could not be loaded");
  expect(screen.queryByText("Booting mission systems...")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Play co-op" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Retry saved missions" }));
  expect(await screen.findByRole("button", { name: "New Mission" })).toBeEnabled();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(mocks.listSessions).toHaveBeenCalledTimes(2);
});

test("ignores a saved-slot result after the app unmounts", async () => {
  let finish;
  mocks.listSessions.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const view = render(<App />);
  view.unmount();
  await act(async () => finish({ slots, activeSlotId: null }));
  expect(screen.queryByRole("button", { name: "New Mission" })).not.toBeInTheDocument();
});

test("ignores the obsolete hydration request during StrictMode remount", async () => {
  const finish = [];
  mocks.listSessions.mockImplementation(() => new Promise((resolve) => { finish.push(resolve); }));
  render(<StrictMode><App /></StrictMode>);
  expect(finish).toHaveLength(2);
  await act(async () => finish[0]({ error: "Obsolete failure" }));
  expect(screen.getByText("Booting mission systems...")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  await act(async () => finish[1]({ slots, activeSlotId: null }));
  expect(screen.getByRole("button", { name: "New Mission" })).toBeEnabled();
});
