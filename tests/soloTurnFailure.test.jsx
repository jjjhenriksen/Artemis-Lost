import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import ArtemisLost from "../src/screens/UI.jsx";
import { createMissionSession } from "../src/game/worldState.js";

const mocks = vi.hoisted(() => ({ requestDmTurn: vi.fn(), requestAutonomousAction: vi.fn(), persistSession: vi.fn() }));
vi.mock("../src/services/dmApi.js", () => ({ requestDmTurn: mocks.requestDmTurn, requestAutonomousAction: mocks.requestAutonomousAction }));
vi.mock("../src/services/sessionApi.js", () => ({ saveSession: mocks.persistSession }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true, addEventListener() {}, removeEventListener() {} });
  mocks.persistSession.mockImplementation(async (_slot, session) => ({ ...session, slotId: "slot-1" }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function openMission(bot = false, strict = false) {
  const session = createMissionSession();
  if (bot) session.worldState.crew[0].character.controller = "bot";
  const props = { initialSession: session, slotId: "slot-1", onExitToMenu() {}, onSessionPersisted: vi.fn() };
  const component = <ArtemisLost {...props} />;
  const view = render(strict ? <StrictMode>{component}</StrictMode> : component);
  return { session, props, view };
}

test.each(["http", "network"])("failed narration (%s) preserves the mission/input/history, and retry saves exactly one turn", async (kind) => {
  if (kind === "http") mocks.requestDmTurn.mockResolvedValueOnce({ error: "Provider timed out", code: "PROVIDER_TIMEOUT", retryable: true });
  else mocks.requestDmTurn.mockRejectedValueOnce(new TypeError("Network failed"));
  mocks.requestDmTurn.mockResolvedValueOnce({ narration: "Fixture action accepted", stateDelta: {} });
  const { session, props } = openMission();
  const original = structuredClone(session);
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "Hold position and maintain the command relay." } });
  fireEvent.click(screen.getByRole("button", { name: "TRANSMIT" }));
  await screen.findByText(/Your mission and action are unchanged/);
  expect(input).toHaveValue("Hold position and maintain the command relay.");
  expect(input).not.toBeDisabled();
  expect(screen.getByText("COMMANDER VIEW")).toBeInTheDocument();
  expect(screen.getAllByText(session.worldState.mission.met).length).toBeGreaterThan(0);
  expect(mocks.persistSession).not.toHaveBeenCalled();
  expect(props.onSessionPersisted).not.toHaveBeenCalled();
  expect(session).toEqual(original);
  fireEvent.click(screen.getByRole("button", { name: "Retry action" }));
  await waitFor(() => expect(mocks.persistSession).toHaveBeenCalledTimes(1));
  expect(mocks.requestDmTurn).toHaveBeenCalledTimes(2);
  expect(mocks.requestDmTurn.mock.calls[1][0]).toEqual(mocks.requestDmTurn.mock.calls[0][0]);
  const accepted = mocks.persistSession.mock.calls[0][1];
  expect(accepted.turn).toBe(1);
  expect(accepted.conversationHistory).toHaveLength(original.conversationHistory.length + 2);
  expect(accepted.conversationHistory.filter((entry) => entry.content === "Hold position and maintain the command relay.")).toHaveLength(1);
  await waitFor(() => expect(input).toHaveValue(""));
});

test.each(["http", "network"])("autonomous preview failure (%s) clears drafting and requires explicit retry", async (kind) => {
  if (kind === "http") mocks.requestAutonomousAction.mockResolvedValueOnce({ error: "Provider timed out" });
  else mocks.requestAutonomousAction.mockRejectedValueOnce(new TypeError("Network failed"));
  mocks.requestAutonomousAction.mockResolvedValueOnce({ action: "Hold the command relay." });
  mocks.requestDmTurn.mockResolvedValue({ narration: "Fixture autonomous action accepted", stateDelta: {} });
  const { session } = openMission(true);
  await screen.findByText(/AI crew could not prepare an action/);
  expect(screen.queryByRole("button", { name: "DRAFTING TURN" })).not.toBeInTheDocument();
  expect(screen.queryByText(/Autonomous action:/)).not.toBeInTheDocument();
  expect(mocks.persistSession).not.toHaveBeenCalled();
  expect(mocks.requestDmTurn).not.toHaveBeenCalled();
  expect(session.turn).toBe(0);
  fireEvent.click(screen.getByRole("button", { name: "Retry AI planning" }));
  const advance = await screen.findByRole("button", { name: "CONTINUE AUTONOMOUS TURN" });
  fireEvent.click(advance);
  await waitFor(() => expect(mocks.persistSession).toHaveBeenCalledTimes(1));
  expect(mocks.requestAutonomousAction).toHaveBeenCalledTimes(2);
  expect(mocks.requestDmTurn).toHaveBeenCalledTimes(1);
});

test("failed autonomous narration keeps the prepared action for retry instead of redrafting", async () => {
  mocks.requestAutonomousAction.mockResolvedValue({ action: "Hold the command relay." });
  mocks.requestDmTurn.mockResolvedValueOnce({ error: "Provider timed out" }).mockResolvedValueOnce({ narration: "Fixture autonomous action accepted", stateDelta: {} });
  openMission(true);
  fireEvent.click(await screen.findByRole("button", { name: "CONTINUE AUTONOMOUS TURN" }));
  await screen.findByText(/Your mission and action are unchanged/);
  expect(mocks.requestAutonomousAction).toHaveBeenCalledTimes(1);
  expect(mocks.persistSession).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Retry action" }));
  await waitFor(() => expect(mocks.persistSession).toHaveBeenCalledTimes(1));
  expect(mocks.requestAutonomousAction).toHaveBeenCalledTimes(1);
  expect(mocks.requestDmTurn.mock.calls[1][0]).toEqual(mocks.requestDmTurn.mock.calls[0][0]);
});

test("double submission while a request is pending sends and saves one turn", async () => {
  let resolve;
  mocks.requestDmTurn.mockImplementation(() => new Promise((done) => { resolve = done; }));
  openMission();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Hold position" } });
  const send = screen.getByRole("button", { name: "TRANSMIT" });
  fireEvent.click(send); fireEvent.click(send);
  expect(mocks.requestDmTurn).toHaveBeenCalledTimes(1);
  await act(async () => resolve({ narration: "Fixture accepted", stateDelta: {} }));
  expect(mocks.persistSession).toHaveBeenCalledTimes(1);
});

test("StrictMode cleanup cannot strand autonomous preview loading", async () => {
  mocks.requestAutonomousAction.mockResolvedValue({ action: "Hold the command relay." });
  openMission(true, true);
  expect(await screen.findByRole("button", { name: "CONTINUE AUTONOMOUS TURN" })).not.toBeDisabled();
});

test("leaving during narration prevents a late response from saving a turn", async () => {
  let resolve;
  mocks.requestDmTurn.mockImplementation(() => new Promise((done) => { resolve = done; }));
  const { view } = openMission();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Hold position" } });
  fireEvent.click(screen.getByRole("button", { name: "TRANSMIT" }));
  view.unmount();
  await act(async () => resolve({ narration: "Late fixture response", stateDelta: {} }));
  expect(mocks.persistSession).not.toHaveBeenCalled();
});
