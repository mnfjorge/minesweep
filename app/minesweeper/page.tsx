"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Cell = {
  isMine: boolean;
  isRevealed: boolean;
  isFlagged: boolean;
  neighborMines: number;
};

type Difficulty = {
  label: string;
  rows: number;
  cols: number;
  mines: number;
};

const DIFFICULTIES: Difficulty[] = [
  { label: "Beginner", rows: 9, cols: 9, mines: 10 },
  { label: "Intermediate", rows: 16, cols: 16, mines: 40 },
  { label: "Expert", rows: 16, cols: 30, mines: 99 },
];

function createEmptyBoard(rows: number, cols: number): Cell[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      isMine: false,
      isRevealed: false,
      isFlagged: false,
      neighborMines: 0,
    }))
  );
}

function inBounds(rows: number, cols: number, r: number, c: number) {
  return r >= 0 && r < rows && c >= 0 && c < cols;
}

function getNeighbors(rows: number, cols: number, r: number, c: number) {
  const neighbors: Array<[number, number]> = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (inBounds(rows, cols, nr, nc)) neighbors.push([nr, nc]);
    }
  }
  return neighbors;
}

function placeMines(board: Cell[][], firstClickR: number, firstClickC: number, mines: number) {
  const rows = board.length;
  const cols = board[0].length;
  const totalCells = rows * cols;

  // Avoid mine on first-click cell and its neighbors to guarantee a safe start
  const forbidden = new Set<number>();
  const forbiddenCoords = [[firstClickR, firstClickC], ...getNeighbors(rows, cols, firstClickR, firstClickC)];
  for (const [fr, fc] of forbiddenCoords) {
    forbidden.add(fr * cols + fc);
  }

  const available: number[] = [];
  for (let i = 0; i < totalCells; i++) {
    if (!forbidden.has(i)) available.push(i);
  }

  // Fisher-Yates shuffle partially
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }

  const minesToPlace = Math.min(mines, available.length);
  for (let k = 0; k < minesToPlace; k++) {
    const idx = available[k];
    const r = Math.floor(idx / cols);
    const c = idx % cols;
    board[r][c].isMine = true;
  }

  // Compute neighbor counts
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c].isMine) {
        board[r][c].neighborMines = -1;
        continue;
      }
      const neighbors = getNeighbors(rows, cols, r, c);
      let count = 0;
      for (const [nr, nc] of neighbors) if (board[nr][nc].isMine) count++;
      board[r][c].neighborMines = count;
    }
  }
}

function cloneBoard(board: Cell[][]) {
  return board.map(row => row.map(cell => ({ ...cell })));
}

function revealFlood(board: Cell[][], r: number, c: number) {
  const rows = board.length;
  const cols = board[0].length;
  const stack: Array<[number, number]> = [[r, c]];
  while (stack.length) {
    const [cr, cc] = stack.pop()!;
    const cell = board[cr][cc];
    if (cell.isRevealed || cell.isFlagged) continue;
    cell.isRevealed = true;
    if (!cell.isMine && cell.neighborMines === 0) {
      for (const [nr, nc] of getNeighbors(rows, cols, cr, cc)) {
        const ncell = board[nr][nc];
        if (!ncell.isRevealed && !ncell.isFlagged) stack.push([nr, nc]);
      }
    }
  }
}

function countFlagsAround(board: Cell[][], r: number, c: number) {
  const rows = board.length;
  const cols = board[0].length;
  let cnt = 0;
  for (const [nr, nc] of getNeighbors(rows, cols, r, c)) if (board[nr][nc].isFlagged) cnt++;
  return cnt;
}

export default function MinesweeperPage() {
  const [difficultyIdx, setDifficultyIdx] = useState<number>(0);
  const difficulty = DIFFICULTIES[difficultyIdx];

  const [board, setBoard] = useState<Cell[][]>(() => createEmptyBoard(difficulty.rows, difficulty.cols));
  const [isFirstClick, setIsFirstClick] = useState<boolean>(true);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [isWin, setIsWin] = useState<boolean>(false);
  const [flagsPlaced, setFlagsPlaced] = useState<number>(0);
  const [seconds, setSeconds] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const minesRemaining = Math.max(difficulty.mines - flagsPlaced, 0);

  const reset = useCallback((newDifficultyIdx?: number) => {
    const idx = newDifficultyIdx ?? difficultyIdx;
    const d = DIFFICULTIES[idx];
    setDifficultyIdx(idx);
    setBoard(createEmptyBoard(d.rows, d.cols));
    setIsFirstClick(true);
    setGameOver(false);
    setIsWin(false);
    setFlagsPlaced(0);
    setSeconds(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [difficultyIdx]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      setSeconds(s => s + 1);
    }, 1000);
  }, []);

  const checkWin = useCallback((b: Cell[][]) => {
    let revealed = 0;
    let mines = 0;
    for (const row of b) {
      for (const cell of row) {
        if (cell.isMine) mines++;
        else if (cell.isRevealed) revealed++;
      }
    }
    const totalSafe = b.length * b[0].length - mines;
    if (revealed === totalSafe) {
      setIsWin(true);
      setGameOver(true);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      // Auto-flag remaining mines for satisfaction
      const clone = cloneBoard(b);
      for (let r = 0; r < clone.length; r++) {
        for (let c = 0; c < clone[0].length; c++) {
          if (clone[r][c].isMine) clone[r][c].isFlagged = true;
        }
      }
      setBoard(clone);
      setFlagsPlaced(difficulty.mines);
    }
  }, [difficulty.mines]);

  const revealCell = useCallback((r: number, c: number) => {
    if (gameOver) return;
    let newBoard = cloneBoard(board);

    if (isFirstClick) {
      placeMines(newBoard, r, c, difficulty.mines);
      setIsFirstClick(false);
      startTimer();
    }

    const cell = newBoard[r][c];
    if (cell.isRevealed || cell.isFlagged) return;

    cell.isRevealed = true;
    if (cell.isMine) {
      // Reveal all mines and stop timer
      for (let rr = 0; rr < newBoard.length; rr++) {
        for (let cc = 0; cc < newBoard[0].length; cc++) {
          if (newBoard[rr][cc].isMine) newBoard[rr][cc].isRevealed = true;
        }
      }
      setBoard(newBoard);
      setGameOver(true);
      setIsWin(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (cell.neighborMines === 0) {
      revealFlood(newBoard, r, c);
    }
    setBoard(newBoard);
    checkWin(newBoard);
  }, [board, checkWin, difficulty.mines, gameOver, isFirstClick, startTimer]);

  const toggleFlag = useCallback((r: number, c: number) => {
    if (gameOver) return;
    if (isFirstClick) {
      // Do not allow flagging before first reveal in classic variants; allow to match typical behavior though
      // We'll allow flagging even before first click
    }
    const newBoard = cloneBoard(board);
    const cell = newBoard[r][c];
    if (cell.isRevealed) return;
    cell.isFlagged = !cell.isFlagged;
    setBoard(newBoard);
    setFlagsPlaced(prev => prev + (cell.isFlagged ? 1 : -1));
  }, [board, gameOver, isFirstClick]);

  const chordReveal = useCallback((r: number, c: number) => {
    if (gameOver) return;
    const base = board[r][c];
    if (!base.isRevealed || base.neighborMines <= 0) return;
    const newBoard = cloneBoard(board);
    const flaggedAround = countFlagsAround(newBoard, r, c);
    if (flaggedAround !== base.neighborMines) return;

    let hitMine = false;
    for (const [nr, nc] of getNeighbors(newBoard.length, newBoard[0].length, r, c)) {
      const ncell = newBoard[nr][nc];
      if (!ncell.isRevealed && !ncell.isFlagged) {
        ncell.isRevealed = true;
        if (ncell.isMine) hitMine = true;
        else if (ncell.neighborMines === 0) revealFlood(newBoard, nr, nc);
      }
    }
    if (hitMine) {
      for (let rr = 0; rr < newBoard.length; rr++) {
        for (let cc = 0; cc < newBoard[0].length; cc++) {
          if (newBoard[rr][cc].isMine) newBoard[rr][cc].isRevealed = true;
        }
      }
      setBoard(newBoard);
      setGameOver(true);
      setIsWin(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    setBoard(newBoard);
    checkWin(newBoard);
  }, [board, checkWin, gameOver]);

  const onCellMouseDown = useCallback((e: React.MouseEvent, r: number, c: number) => {
    e.preventDefault();
    if (e.button === 0) revealCell(r, c);
    else if (e.button === 2) toggleFlag(r, c);
  }, [revealCell, toggleFlag]);

  const onCellDoubleClick = useCallback((e: React.MouseEvent, r: number, c: number) => {
    e.preventDefault();
    chordReveal(r, c);
  }, [chordReveal]);

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const cellContent = (cell: Cell) => {
    if (!cell.isRevealed) return cell.isFlagged ? "🚩" : "";
    if (cell.isMine) return "💣";
    if (cell.neighborMines === 0) return "";
    return String(cell.neighborMines);
  };

  const numberColor = (n: number) => {
    switch (n) {
      case 1: return "text-blue-600";
      case 2: return "text-green-600";
      case 3: return "text-red-600";
      case 4: return "text-indigo-600";
      case 5: return "text-orange-600";
      case 6: return "text-teal-600";
      case 7: return "text-fuchsia-700";
      case 8: return "text-gray-700";
      default: return "";
    }
  };

  const gridTemplate = useMemo(() => ({ gridTemplateColumns: `repeat(${difficulty.cols}, 28px)` }), [difficulty.cols]);

  return (
    <div className="min-h-screen flex flex-col items-center gap-4 p-6 select-none">
      <div className="flex items-center gap-4">
        <div className="text-sm">Mines: <span className="font-semibold">{minesRemaining}</span></div>
        <div className="text-sm">Time: <span className="font-semibold">{seconds}</span>s</div>
        <select
          className="border rounded px-2 py-1 text-sm"
          value={difficultyIdx}
          onChange={(e) => reset(Number(e.target.value))}
        >
          {DIFFICULTIES.map((d, i) => (
            <option key={d.label} value={i}>{d.label}</option>
          ))}
        </select>
        <button className="border rounded px-2 py-1 text-sm" onClick={() => reset()}>
          Reset
        </button>
      </div>

      <div
        className="inline-grid border border-black/20 dark:border-white/20 bg-gray-100 dark:bg-gray-800"
        style={gridTemplate}
        onContextMenu={onContextMenu}
      >
        {board.map((row, r) => (
          row.map((cell, c) => {
            const content = cellContent(cell);
            const showNumber = cell.isRevealed && !cell.isMine && cell.neighborMines > 0;
            return (
              <button
                key={`${r}-${c}`}
                onMouseDown={(e) => onCellMouseDown(e, r, c)}
                onDoubleClick={(e) => onCellDoubleClick(e, r, c)}
                className={
                  "w-[28px] h-[28px] flex items-center justify-center text-sm font-bold border border-black/10 dark:border-white/10 " +
                  (cell.isRevealed
                    ? "bg-gray-200 dark:bg-gray-700 " + (showNumber ? numberColor(cell.neighborMines) : "")
                    : "bg-gray-300 hover:bg-gray-200 active:translate-y-[1px] dark:bg-gray-600")
                }
                aria-label={`cell-${r}-${c}`}
              >
                {content}
              </button>
            );
          })
        ))}
      </div>

      {gameOver && (
        <div className="text-center text-lg font-semibold">
          {isWin ? "You Win! 🎉" : "Boom! Game Over 💥"}
        </div>
      )}
    </div>
  );
}

