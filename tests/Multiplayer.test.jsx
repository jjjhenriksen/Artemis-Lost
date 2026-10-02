import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Multiplayer from "../src/screens/Multiplayer.jsx";
import { createMissionSession } from "../src/game/worldState.js";
import { loadRoomCredentials, saveRoomCredentials } from "../src/services/multiplayerApi.js";

const credentials = { roomId: "room-1", memberId: "member-1", token: "private-bearer-token", inviteCode: "crew-invite" };
function fixture({ seatId = "vasquez", status = "active", revision = 1, turn = 0 } = {}) {
  return { id: "room-1", revision, status, hostMemberId: "member-1", members: [{ id: "member-1", name: "Crew One", seatId }], me: { id: "member-1", name: "Crew One", seatId }, session: { ...createMissionSession(), turn }, messages: [] };
}
afterEach(() => { cleanup(); saveRoomCredentials(null); vi.restoreAllMocks(); vi.useRealTimers(); });

test("create and join forms send bounded identity and chosen seat, keeping the bearer out of the DOM", async () => {
  const room = fixture({ status: "lobby" });
  const request = vi.fn(async (path) => path === "/rooms" ? { ...credentials, token: credentials.token, room } : { room });
  render(<Multiplayer onBack={() => {}} request={request} />);
  fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Crew One" } });
  fireEvent.click(screen.getByRole("button", { name: "Create private room" }));
  await screen.findByRole("heading", { name: "Crew roster" });
  expect(request.mock.calls[0][1].body).toEqual({ name: "Crew One", seatId: "vasquez" });
  expect(document.body.textContent).not.toContain(credentials.token);
  expect(loadRoomCredentials()).toMatchObject({ roomId: "room-1", token: credentials.token });
});

test("the role console belongs to the authenticated seat, and cannot act for the current human seat", async () => {
  saveRoomCredentials(credentials);
  const room = fixture({ seatId: "okafor" });
  room.members.push({ id: "other", name: "Commander Friend", seatId: "vasquez" });
  render(<Multiplayer onBack={() => {}} request={vi.fn().mockResolvedValue({ room })} />);
  await screen.findByText("FLIGHT ENGINEER VIEW");
  expect(screen.queryByLabelText("Your action")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Advance AI turn" })).not.toBeInTheDocument();
  expect(screen.getByText(/waiting for your crewmate/)).toBeInTheDocument();
});

test("response-loss retries retain the exact command ID and revision, including after remount", async () => {
  saveRoomCredentials(credentials);
  const room = fixture();
  const request = vi.fn(async (path) => {
    if (path.endsWith("/actions")) throw new Error("Connection lost");
    return { room };
  });
  const view = render(<Multiplayer onBack={() => {}} request={request} />);
  fireEvent.change(await screen.findByLabelText("Your action"), { target: { value: "Maintain relay" } });
  fireEvent.click(screen.getByRole("button", { name: "Send action" }));
  await screen.findByRole("button", { name: "Retry last command" });
  const first = request.mock.calls.find(([path]) => path.endsWith("/actions"))[1].body;
  expect(loadRoomCredentials().pending).toEqual(first);
  view.unmount();
  const recoveredRequest = vi.fn(async () => ({ room }));
  render(<Multiplayer onBack={() => {}} request={recoveredRequest} />);
  const retry = await screen.findByRole("button", { name: "Retry last command" });
  await waitFor(() => expect(retry).not.toBeDisabled());
  fireEvent.click(retry);
  await waitFor(() => expect(recoveredRequest.mock.calls.some(([path]) => path.endsWith("/actions"))).toBe(true));
  expect(recoveredRequest.mock.calls.find(([path]) => path.endsWith("/actions"))[1].body).toEqual(first);
  expect(loadRoomCredentials().pending).toBeNull();
});

test.each([403, 409])("a rejected command (%s) refreshes the room and preserves the typed action", async (status) => {
  saveRoomCredentials(credentials);
  const room = fixture();
  const request = vi.fn(async (path) => {
    if (path.endsWith("/actions")) throw Object.assign(new Error("Room changed; refresh"), { status });
    return { room };
  });
  render(<Multiplayer onBack={() => {}} request={request} />);
  fireEvent.change(await screen.findByLabelText("Your action"), { target: { value: "Maintain relay" } });
  fireEvent.click(screen.getByRole("button", { name: "Send action" }));
  await screen.findByText("Room changed; refresh");
  expect(loadRoomCredentials().pending).toBeNull();
  expect(screen.getByLabelText("Your action")).toHaveValue("Maintain relay");
});

test("revoked membership clears saved credentials and returns to safe entry", async () => {
  saveRoomCredentials(credentials);
  render(<Multiplayer onBack={() => {}} request={vi.fn().mockRejectedValue(Object.assign(new Error("Unauthorized"), { status: 401 }))} />);
  await screen.findByText(/membership is no longer available/);
  expect(loadRoomCredentials()).toBeNull();
  expect(screen.getByRole("button", { name: "Create private room" })).toBeInTheDocument();
});

test("AI turns require an explicit click and send no caller-controlled action", async () => {
  saveRoomCredentials(credentials);
  const room = fixture({ turn: 1 });
  const request = vi.fn().mockResolvedValue({ room });
  render(<Multiplayer onBack={() => {}} request={request} />);
  fireEvent.click(await screen.findByRole("button", { name: "Advance AI turn" }));
  await waitFor(() => expect(request.mock.calls.some(([path]) => path.endsWith("/actions"))).toBe(true));
  expect(request.mock.calls.find(([path]) => path.endsWith("/actions"))[1].body).toMatchObject({ action: "", bot: true, expectedRevision: 1 });
});

test("returning to the menu aborts a pending action and ignores its late response", async () => {
  saveRoomCredentials(credentials);
  let resolveAction;
  const request = vi.fn((path) => path.endsWith("/actions") ? new Promise((resolve) => { resolveAction = resolve; }) : Promise.resolve({ room: fixture() }));
  const view = render(<Multiplayer onBack={() => {}} request={request} />);
  fireEvent.change(await screen.findByLabelText("Your action"), { target: { value: "Maintain relay" } });
  fireEvent.click(screen.getByRole("button", { name: "Send action" }));
  const actionCall = request.mock.calls.find(([path]) => path.endsWith("/actions"));
  view.unmount();
  expect(actionCall[1].signal.aborted).toBe(true);
  await act(async () => resolveAction({ room: fixture({ revision: 2 }) }));
  expect(loadRoomCredentials().pending.commandId).toBe(actionCall[1].body.commandId);
});
