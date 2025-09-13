import Game from "./Game";
import { submitRank, getLeaderboardTop10All } from "./actions/rank";

export default function MinesweeperPage() {
  return <Game onSubmitRank={submitRank} fetchLeaderboard={getLeaderboardTop10All} />;
}

