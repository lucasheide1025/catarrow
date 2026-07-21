// src/zombie/domain/gameStateMachine.test.js
import {
  GAME_PHASE,
  createInitialGameState,
  transitionPhase,
  getPhaseLabel,
  getPhaseIcon,
  isValidTransition,
  resetToLobby,
} from "./gameStateMachine";

describe("Game State Machine", () => {
  test("creates initial state in LOBBY", () => {
    const state = createInitialGameState();
    expect(state.phase).toBe(GAME_PHASE.LOBBY);
    expect(state.round).toBe(0);
    expect(state.party).toEqual([]);
    expect(state.resources.food).toBe(30);
    expect(state.resources.water).toBe(30);
    expect(state.resources.arrows).toBe(20);
  });

  test("valid transition: LOBBY → BRIEFING", () => {
    const state = createInitialGameState();
    const result = transitionPhase(state, GAME_PHASE.BRIEFING);
    expect(result.ok).toBe(true);
    expect(result.state.phase).toBe(GAME_PHASE.BRIEFING);
  });

  test("invalid transition: LOBBY → COMBAT", () => {
    const state = createInitialGameState();
    const result = transitionPhase(state, GAME_PHASE.COMBAT);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("invalid_transition");
  });

  test("invalid transition: VICTORY → EXPLORATION", () => {
    const state = { ...createInitialGameState(), phase: GAME_PHASE.VICTORY };
    const result = transitionPhase(state, GAME_PHASE.EXPLORATION);
    expect(result.ok).toBe(false);
  });

  test("full game flow: LOBBY → BRIEFING → EXPLORATION → ENCOUNTER → COMBAT → RESULT", () => {
    let state = createInitialGameState();
    const flow = [
      GAME_PHASE.BRIEFING,
      GAME_PHASE.EXPLORATION,
      GAME_PHASE.ENCOUNTER,
      GAME_PHASE.COMBAT,
      GAME_PHASE.RESULT,
    ];
    for (const target of flow) {
      const result = transitionPhase(state, target);
      expect(result.ok).toBe(true);
      state = result.state;
    }
    expect(state.phase).toBe(GAME_PHASE.RESULT);
  });

  test("transition records event", () => {
    const state = createInitialGameState();
    const { state: next } = transitionPhase(state, GAME_PHASE.BRIEFING);
    expect(next.events.length).toBe(1);
    expect(next.events[0].type).toBe("phase_transition");
    expect(next.events[0].from).toBe(GAME_PHASE.LOBBY);
    expect(next.events[0].to).toBe(GAME_PHASE.BRIEFING);
  });

  test("transition preserves extra data", () => {
    const state = createInitialGameState();
    const { state: next } = transitionPhase(state, GAME_PHASE.BRIEFING, { zone: "danger", round: 1 });
    expect(next.zone).toBe("danger");
    expect(next.round).toBe(1);
  });

  test("isValidTransition returns true for valid paths", () => {
    expect(isValidTransition(GAME_PHASE.LOBBY, GAME_PHASE.BRIEFING)).toBe(true);
    expect(isValidTransition(GAME_PHASE.EXPLORATION, GAME_PHASE.ENCOUNTER)).toBe(true);
    expect(isValidTransition(GAME_PHASE.COMBAT, GAME_PHASE.RESULT)).toBe(true);
    expect(isValidTransition(GAME_PHASE.VICTORY, GAME_PHASE.LOBBY)).toBe(true);
  });

  test("isValidTransition returns false for invalid paths", () => {
    expect(isValidTransition(GAME_PHASE.LOBBY, GAME_PHASE.COMBAT)).toBe(false);
    expect(isValidTransition(GAME_PHASE.BRIEFING, GAME_PHASE.VICTORY)).toBe(false);
    expect(isValidTransition(GAME_PHASE.DEFEAT, GAME_PHASE.EXPLORATION)).toBe(false);
  });

  test("resetToLobby returns to LOBBY with fresh state", () => {
    const state = { ...createInitialGameState(), phase: GAME_PHASE.VICTORY };
    const { state: reset } = resetToLobby(state);
    expect(reset.phase).toBe(GAME_PHASE.LOBBY);
    expect(reset.round).toBe(0);
  });

  test("getPhaseLabel returns Chinese labels", () => {
    expect(getPhaseLabel(GAME_PHASE.LOBBY)).toBe("集結大廳");
    expect(getPhaseLabel(GAME_PHASE.EXPLORATION)).toBe("探索中");
    expect(getPhaseLabel(GAME_PHASE.VICTORY)).toBe("任務成功");
    expect(getPhaseLabel(GAME_PHASE.DEFEAT)).toBe("全員陣亡");
  });

  test("getPhaseIcon returns appropriate icons", () => {
    expect(getPhaseIcon(GAME_PHASE.COMBAT)).toBe("🎯");
    expect(getPhaseIcon(GAME_PHASE.EXTRACTION)).toBe("🚁");
    expect(getPhaseIcon(GAME_PHASE.LOBBY)).toBe("🏛️");
  });
});
