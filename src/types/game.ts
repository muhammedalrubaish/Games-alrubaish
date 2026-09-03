import { LocationItem } from "@/data/locations";

export type GameMode = "pass-and-play" | "online-room";

export interface Player {
  id: string;
  name: string;
  isSpy: boolean;
  role?: string;
  isHost?: boolean;
}

export interface GameState {
  roomId?: string;
  mode: GameMode;
  status: "lobby" | "card-reveal" | "playing" | "voting" | "game-over";
  players: Player[];
  selectedLocation?: LocationItem;
  timerMinutes: number;
  timeRemainingSeconds: number;
  isTimerRunning: boolean;
  revealedPlayerIndex: number;
  revealedCardShowing: boolean;
  crossedLocations: string[]; // IDs of crossed out locations by players
  winner?: "players" | "spy";
  winReason?: string;
}
