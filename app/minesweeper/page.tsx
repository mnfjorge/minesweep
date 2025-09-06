"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent, TouchEvent } from "react";

type Cell = {
  isMine: boolean;
  isRevealed: boolean;
  isFlagged: boolean;
  neighborMines: number;
};

type BoardConfig = {
  rows: number;
  cols: number;
  mines: number;
};

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
  // Sizing constants resembling classic Minesweeper
  const CELL_SIZE = 28; // px
  const HEADER_HEIGHT = 56; // px
  const PADDING = 12; // px around the board

  const computeConfig = useCallback((): BoardConfig => {
    if (typeof window === "undefined") return { rows: 9, cols: 9, mines: 10 };
    const availableWidth = Math.max(1, window.innerWidth - PADDING * 2);
    const availableHeight = Math.max(1, window.innerHeight - HEADER_HEIGHT - PADDING * 2);
    const cols = Math.max(5, Math.floor(availableWidth / CELL_SIZE));
    const rows = Math.max(5, Math.floor(availableHeight / CELL_SIZE));
    const total = rows * cols;
    const mines = Math.max(1, Math.floor(total * 0.15)); // ~15% density
    return { rows, cols, mines };
  }, []);

  const [config, setConfig] = useState<BoardConfig>(() => computeConfig());
  const [board, setBoard] = useState<Cell[][]>(() => createEmptyBoard(config.rows, config.cols));
  const [isFirstClick, setIsFirstClick] = useState<boolean>(true);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [isWin, setIsWin] = useState<boolean>(false);
  const [flagsPlaced, setFlagsPlaced] = useState<number>(0);
  const [seconds, setSeconds] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef<boolean>(false);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const minesRemaining = Math.max(config.mines - flagsPlaced, 0);

  const reset = useCallback((override?: BoardConfig) => {
    const next = override ?? computeConfig();
    setConfig(next);
    setBoard(createEmptyBoard(next.rows, next.cols));
    setIsFirstClick(true);
    setGameOver(false);
    setIsWin(false);
    setFlagsPlaced(0);
    setSeconds(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [computeConfig]);

  useEffect(() => {
    // Recompute on resize to keep board full-screen
    const onResize = () => {
      const next = computeConfig();
      reset(next);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      setSeconds((s: number) => s + 1);
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
      setFlagsPlaced(config.mines);
    }
  }, [config.mines]);

  const revealCell = useCallback((r: number, c: number) => {
    if (gameOver) return;
    let newBoard = cloneBoard(board);

    if (isFirstClick) {
      placeMines(newBoard, r, c, config.mines);
      setIsFirstClick(false);
      startTimer();
    }

    const cell = newBoard[r][c];
    if (cell.isRevealed || cell.isFlagged) return;

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
    } else {
      cell.isRevealed = true;
    }
    setBoard(newBoard);
    checkWin(newBoard);
  }, [board, checkWin, config.mines, gameOver, isFirstClick, startTimer]);

  const toggleFlag = useCallback((r: number, c: number) => {
    if (gameOver) return;
    if (isFirstClick) {
      // Do not allow flagging before first reveal in classic variants; allow to match typical behavior though
      // We'll allow flagging even before first click
    }
    const newBoard = cloneBoard(board);
    const cell = newBoard[r][c];
    if (cell.isRevealed) return;
    const wasFlagged = cell.isFlagged;
    cell.isFlagged = !cell.isFlagged;
    setBoard(newBoard);
    setFlagsPlaced((prev: number) => prev + (cell.isFlagged ? 1 : -1));
    // Haptic feedback on mobile when adding a flag
    if (!wasFlagged) {
      try {
        if (typeof window !== "undefined") {
          const isCoarse = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
          const hasTouch = (navigator as any).maxTouchPoints > 0 || "ontouchstart" in window;
          if ((isCoarse || hasTouch) && typeof (navigator as any).vibrate === "function") {
            (navigator as any).vibrate(15);
          }
        }
      } catch {}
    }
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
        if (ncell.isMine) {
          hitMine = true;
          ncell.isRevealed = true;
        } else if (ncell.neighborMines === 0) {
          revealFlood(newBoard, nr, nc);
        } else {
          ncell.isRevealed = true;
        }
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

  const onCellMouseDown = useCallback((e: MouseEvent, r: number, c: number) => {
    e.preventDefault();
    if (e.button === 0) revealCell(r, c);
    else if (e.button === 2) toggleFlag(r, c);
  }, [revealCell, toggleFlag]);

  const onCellDoubleClick = useCallback((e: MouseEvent, r: number, c: number) => {
    e.preventDefault();
    chordReveal(r, c);
  }, [chordReveal]);

  const onContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
  }, []);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const onCellTouchStart = useCallback((e: TouchEvent, r: number, c: number) => {
    e.preventDefault();
    longPressTriggeredRef.current = false;
    const t = e.touches[0];
    if (!t) return;
    touchStartPosRef.current = { x: t.clientX, y: t.clientY };
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      toggleFlag(r, c);
    }, 400);
  }, [toggleFlag]);

  const onCellTouchMove = useCallback((e: TouchEvent) => {
    const t = e.touches[0];
    const start = touchStartPosRef.current;
    if (!t || !start) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 10) {
      clearLongPressTimer();
    }
  }, [clearLongPressTimer]);

  const onCellTouchEnd = useCallback((e: TouchEvent, r: number, c: number) => {
    e.preventDefault();
    const wasLong = longPressTriggeredRef.current;
    clearLongPressTimer();
    touchStartPosRef.current = null;
    if (!wasLong) revealCell(r, c);
  }, [revealCell, clearLongPressTimer]);

  const onCellTouchCancel = useCallback(() => {
    clearLongPressTimer();
    touchStartPosRef.current = null;
  }, [clearLongPressTimer]);

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

  const gridTemplate = useMemo(() => ({ gridTemplateColumns: `repeat(${config.cols}, var(--ms-cell-size))` }), [config.cols]);

  const numberClass = (n: number) => {
    if (n <= 0) return "";
    return `ms-n${n}`;
  };

  const pad3 = (n: number) => String(Math.max(0, Math.min(999, n))).padStart(3, "0");

  return (
    <div
      className="h-screen w-screen overflow-hidden select-none flex flex-col items-center justify-start bg-[#bdbdbd]"
      style={{ ["--ms-cell-size" as any]: `${CELL_SIZE}px` }}
    >
      <div className="w-full max-w-full px-2 pt-2">
        <div className="ms-panel" style={{ height: HEADER_HEIGHT - 16 }}>
          <div className="ms-led">{pad3(minesRemaining)}</div>
          <button className="ms-smiley" onClick={() => reset()} aria-label="reset">
            {gameOver ? (isWin ? "😎" : "😵") : "😊"}
          </button>
          <div className="ms-led">{pad3(seconds)}</div>
        </div>
      </div>

      <div className="w-full h-full px-2 pb-2 flex items-start justify-center">
        <div className="ms-board" style={gridTemplate} onContextMenu={onContextMenu}>
          {board.map((row, r) => (
            row.map((cell, c) => {
              const content = cellContent(cell);
              const showNumber = cell.isRevealed && !cell.isMine && cell.neighborMines > 0;
              return (
                <button
                  key={`${r}-${c}`}
                  onMouseDown={(e) => onCellMouseDown(e as unknown as MouseEvent, r, c)}
                  onDoubleClick={(e) => onCellDoubleClick(e as unknown as MouseEvent, r, c)}
                  onTouchStart={(e) => onCellTouchStart(e as unknown as TouchEvent, r, c)}
                  onTouchEnd={(e) => onCellTouchEnd(e as unknown as TouchEvent, r, c)}
                  onTouchMove={(e) => onCellTouchMove(e as unknown as TouchEvent)}
                  onTouchCancel={() => onCellTouchCancel()}
                  className={
                    "flex items-center justify-center text-[14px] font-bold " +
                    (cell.isRevealed ? "ms-cell-revealed " + (showNumber ? numberClass(cell.neighborMines) : "") : "ms-cell")
                  }
                  aria-label={`cell-${r}-${c}`}
                >
                  {content}
                </button>
              );
            })
          ))}
        </div>
      </div>

      {gameOver && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-center text-base font-semibold">
          {isWin ? "You Win!" : "Boom!"}
        </div>
      )}
    </div>
  );
}

