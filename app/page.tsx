'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { signIn } from 'next-auth/react';
import type { MouseEvent, TouchEvent } from 'react';

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

function placeMines(
  board: Cell[][],
  firstClickR: number,
  firstClickC: number,
  mines: number
) {
  const rows = board.length;
  const cols = board[0].length;
  const totalCells = rows * cols;

  // Avoid mine on first-click cell and its neighbors to guarantee a safe start
  const forbidden = new Set<number>();
  const forbiddenCoords = [
    [firstClickR, firstClickC],
    ...getNeighbors(rows, cols, firstClickR, firstClickC),
  ];
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

function recomputeNeighborCounts(board: Cell[][]) {
  const rows = board.length;
  const cols = rows > 0 ? board[0].length : 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c].isMine) {
        board[r][c].neighborMines = -1;
        continue;
      }
      let count = 0;
      for (const [nr, nc] of getNeighbors(rows, cols, r, c)) {
        if (board[nr][nc].isMine) count++;
      }
      board[r][c].neighborMines = count;
    }
  }
}

function cloneBoard(board: Cell[][]) {
  return board.map((row) => row.map((cell) => ({ ...cell })));
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
  for (const [nr, nc] of getNeighbors(rows, cols, r, c))
    if (board[nr][nc].isFlagged) cnt++;
  return cnt;
}

export default function MinesweeperPage() {
  // Sizing constants resembling classic Minesweeper
  const CELL_SIZE = 32; // px (bigger tiles like the reference)
  const HEADER_HEIGHT = 64; // px
  // Removed toolbar to reclaim one extra row of tiles
  const PADDING = 0; // remove external padding around the board

  const computeConfig = useCallback((): BoardConfig => {
    if (typeof window === 'undefined') return { rows: 9, cols: 9, mines: 10 };
    const frameExtra = 4; // board borders only (no inner padding)
    const availableWidth = Math.max(1, window.innerWidth - PADDING * 2);
    const availableHeight = Math.max(
      1,
      window.innerHeight - HEADER_HEIGHT - PADDING * 2
    );
    const cols = Math.max(
      5,
      Math.floor((availableWidth - frameExtra) / CELL_SIZE)
    );
    const rows = Math.max(
      5,
      Math.floor((availableHeight - frameExtra) / CELL_SIZE)
    );
    const total = rows * cols;
    let difficultySaved: 'easy' | 'normal' | 'hard' = 'normal';
    try {
      const saved = window.localStorage.getItem('ms_difficulty_v1');
      if (saved === 'easy' || saved === 'normal' || saved === 'hard') {
        difficultySaved = saved;
      }
    } catch {}
    const factor = difficultySaved === 'easy' ? 0.1 : difficultySaved === 'hard' ? 0.2 : 0.15;
    const mines = Math.max(1, Math.floor(total * factor));
    return { rows, cols, mines };
  }, []);

  const [config, setConfig] = useState<BoardConfig>(() => computeConfig());
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'settings' | 'account'>('settings');
  const [difficulty, setDifficulty] = useState<'easy' | 'normal' | 'hard'>(() => {
    if (typeof window === 'undefined') return 'normal';
    try {
      const saved = window.localStorage.getItem('ms_difficulty_v1');
      if (saved === 'easy' || saved === 'normal' || saved === 'hard') return saved;
    } catch {}
    return 'normal';
  });
  const [board, setBoard] = useState<Cell[][]>(() =>
    createEmptyBoard(config.rows, config.cols)
  );
  const [isFirstClick, setIsFirstClick] = useState<boolean>(true);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [isWin, setIsWin] = useState<boolean>(false);
  const [flagsPlaced, setFlagsPlaced] = useState<number>(0);
  const [seconds, setSeconds] = useState<number>(0);
  const [tool, setTool] = useState<'reveal' | 'flag'>('reveal');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef<boolean>(false);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  // Keep latest state in refs for resize handler
  const boardRef = useRef<Cell[][]>(board);
  useEffect(() => {
    boardRef.current = board;
  }, [board]);
  const isFirstClickRef = useRef<boolean>(isFirstClick);
  useEffect(() => {
    isFirstClickRef.current = isFirstClick;
  }, [isFirstClick]);
  const gameOverRef = useRef<boolean>(gameOver);
  useEffect(() => {
    gameOverRef.current = gameOver;
  }, [gameOver]);

  const minesRemaining = Math.max(config.mines - flagsPlaced, 0);
  const computeMinesForDifficulty = useCallback(
    (totalCells: number, diff: 'easy' | 'normal' | 'hard') => {
      const factor = diff === 'easy' ? 0.1 : diff === 'hard' ? 0.2 : 0.15;
      return Math.max(1, Math.floor(totalCells * factor));
    },
    []
  );

  const applyDifficulty = useCallback(
    (nextDifficulty: 'easy' | 'normal' | 'hard') => {
      const total = config.rows * config.cols;
      const mines = computeMinesForDifficulty(total, nextDifficulty);
      setDifficulty(nextDifficulty);
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('ms_difficulty_v1', nextDifficulty);
        }
      } catch {}
      reset({ rows: config.rows, cols: config.cols, mines });
    },
    [computeMinesForDifficulty, config.cols, config.rows, reset]
  );


  const reset = useCallback(
    (override?: BoardConfig) => {
      const next = override ?? computeConfig();
      setConfig(next);
      setBoard(createEmptyBoard(next.rows, next.cols));
      setIsFirstClick(true);
      setGameOver(false);
      setIsWin(false);
      setFlagsPlaced(0);
      setSeconds(0);
      setTool('reveal');
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    },
    [computeConfig]
  );

  useEffect(() => {
    // Recompute on resize to keep board full-screen
    const onResize = () => {
      const next = computeConfig();
      const isInProgress = !isFirstClickRef.current && !gameOverRef.current;
      if (isInProgress) {
        const current = boardRef.current;
        const newRows = next.rows;
        const newCols = next.cols;
        const newBoard = createEmptyBoard(newRows, newCols);
        const copyRows = Math.min(current.length, newRows);
        const copyCols = Math.min(current[0]?.length ?? 0, newCols);
        for (let r = 0; r < copyRows; r++) {
          for (let c = 0; c < copyCols; c++) {
            const src = current[r][c];
            newBoard[r][c] = {
              isMine: src.isMine,
              isRevealed: src.isRevealed,
              isFlagged: src.isFlagged,
              neighborMines: 0,
            };
          }
        }
        // Recompute neighbor counts for the resized board
        recomputeNeighborCounts(newBoard);
        // Recount mines and flags to sync UI counters
        let mineCount = 0;
        let flagCount = 0;
        for (let r = 0; r < newBoard.length; r++) {
          for (let c = 0; c < newBoard[0].length; c++) {
            if (newBoard[r][c].isMine) mineCount++;
            if (newBoard[r][c].isFlagged) flagCount++;
          }
        }
        setConfig({ rows: newRows, cols: newCols, mines: mineCount });
        setBoard(newBoard);
        setFlagsPlaced(flagCount);
        // Keep timer and game state as-is
      } else {
        reset(next);
      }
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      setSeconds((s: number) => s + 1);
    }, 1000);
  }, []);

  const checkWin = useCallback(
    (b: Cell[][]) => {
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
    },
    [config.mines]
  );

  const revealCell = useCallback(
    (r: number, c: number) => {
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
    },
    [board, checkWin, config.mines, gameOver, isFirstClick, startTimer]
  );

  const toggleFlag = useCallback(
    (r: number, c: number) => {
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
          if (typeof window !== 'undefined') {
            const isCoarse =
              typeof window.matchMedia === 'function' &&
              window.matchMedia('(pointer: coarse)').matches;
            const hasTouch =
              (navigator as any).maxTouchPoints > 0 || 'ontouchstart' in window;
            if (
              (isCoarse || hasTouch) &&
              typeof (navigator as any).vibrate === 'function'
            ) {
              (navigator as any).vibrate(15);
            }
          }
        } catch {}
      }
    },
    [board, gameOver, isFirstClick]
  );

  const chordReveal = useCallback(
    (r: number, c: number) => {
      if (gameOver) return;
      const base = board[r][c];
      if (!base.isRevealed || base.neighborMines <= 0) return;
      const newBoard = cloneBoard(board);
      const flaggedAround = countFlagsAround(newBoard, r, c);
      if (flaggedAround !== base.neighborMines) return;

      let hitMine = false;
      for (const [nr, nc] of getNeighbors(
        newBoard.length,
        newBoard[0].length,
        r,
        c
      )) {
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
    },
    [board, checkWin, gameOver]
  );

  const onCellMouseDown = useCallback(
    (e: MouseEvent, r: number, c: number) => {
      e.preventDefault();
      if (e.button === 0) {
        const cell = board[r][c];
        if (cell.isRevealed && cell.neighborMines > 0) {
          chordReveal(r, c);
        } else if (tool === 'flag') {
          toggleFlag(r, c);
        } else {
          revealCell(r, c);
        }
      } else if (e.button === 2) toggleFlag(r, c);
    },
    [board, chordReveal, revealCell, toggleFlag, tool]
  );

  const onCellDoubleClick = useCallback(
    (e: MouseEvent, r: number, c: number) => {
      e.preventDefault();
      chordReveal(r, c);
    },
    [chordReveal]
  );

  const onContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
  }, []);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const onCellTouchStart = useCallback(
    (e: TouchEvent, r: number, c: number) => {
      e.preventDefault();
      longPressTriggeredRef.current = false;
      const t = e.touches[0];
      if (!t) return;
      touchStartPosRef.current = { x: t.clientX, y: t.clientY };
      longPressTimerRef.current = setTimeout(() => {
        longPressTriggeredRef.current = true;
        if (tool === 'flag') {
          revealCell(r, c);
        } else {
          toggleFlag(r, c);
        }
      }, 400);
    },
    [revealCell, toggleFlag, tool]
  );

  const onCellTouchMove = useCallback(
    (e: TouchEvent) => {
      const t = e.touches[0];
      const start = touchStartPosRef.current;
      if (!t || !start) return;
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 10) {
        clearLongPressTimer();
      }
    },
    [clearLongPressTimer]
  );

  const onCellTouchEnd = useCallback(
    (e: TouchEvent, r: number, c: number) => {
      e.preventDefault();
      const wasLong = longPressTriggeredRef.current;
      clearLongPressTimer();
      touchStartPosRef.current = null;
      if (!wasLong) {
        const cell = board[r][c];
        if (cell.isRevealed && cell.neighborMines > 0) {
          chordReveal(r, c);
        } else if (tool === 'flag') {
          toggleFlag(r, c);
        } else {
          revealCell(r, c);
        }
      }
    },
    [board, chordReveal, revealCell, toggleFlag, clearLongPressTimer, tool]
  );

  const onCellTouchCancel = useCallback(() => {
    clearLongPressTimer();
    touchStartPosRef.current = null;
  }, [clearLongPressTimer]);

  const cellContent = (cell: Cell) => {
    if (!cell.isRevealed) return cell.isFlagged ? '🚩' : '';
    if (cell.isMine) return '💣';
    if (cell.neighborMines === 0) return '';
    return String(cell.neighborMines);
  };

  const gridTemplate = useMemo(
    () => ({
      gridTemplateColumns: `repeat(${config.cols}, var(--ms-cell-size))`,
    }),
    [config.cols]
  );

  // Content width of the tile grid (no padding)
  const boardWidth = useMemo(() => config.cols * CELL_SIZE, [config.cols]);

  const numberClass = (n: number) => {
    if (n <= 0) return '';
    return `ms-n${n}`;
  };

  const pad3 = (n: number) =>
    String(Math.max(0, Math.min(999, n))).padStart(3, '0');

  // Simple 7-segment display for 3 digits
  const SevenSegment = ({ value }: { value: number }) => {
    const str = pad3(value);
    const on = '#ff2a2a';
    const off = '#300000';
    const digitWidth = 14;
    const digitHeight = 24;
    const seg = 4; // thickness
    const gap = 3; // space between digits

    // Segment layout helper for a single digit at x offset
    const segmentsFor = (x: number, lit: boolean[]) => (
      <g transform={`translate(${x},0)`}>
        {/* A (top) */}
        <rect
          x={1}
          y={0}
          width={digitWidth - 2}
          height={seg}
          fill={lit[0] ? on : off}
        />
        {/* B (upper-right) */}
        <rect
          x={digitWidth - seg}
          y={1}
          width={seg}
          height={digitHeight / 2 - 2}
          fill={lit[1] ? on : off}
        />
        {/* C (lower-right) */}
        <rect
          x={digitWidth - seg}
          y={digitHeight / 2 + 1}
          width={seg}
          height={digitHeight / 2 - 2}
          fill={lit[2] ? on : off}
        />
        {/* D (bottom) */}
        <rect
          x={1}
          y={digitHeight - seg}
          width={digitWidth - 2}
          height={seg}
          fill={lit[3] ? on : off}
        />
        {/* E (lower-left) */}
        <rect
          x={0}
          y={digitHeight / 2 + 1}
          width={seg}
          height={digitHeight / 2 - 2}
          fill={lit[4] ? on : off}
        />
        {/* F (upper-left) */}
        <rect
          x={0}
          y={1}
          width={seg}
          height={digitHeight / 2 - 2}
          fill={lit[5] ? on : off}
        />
        {/* G (middle) */}
        <rect
          x={1}
          y={digitHeight / 2 - seg / 2}
          width={digitWidth - 2}
          height={seg}
          fill={lit[6] ? on : off}
        />
      </g>
    );

    const map: Record<
      string,
      [boolean, boolean, boolean, boolean, boolean, boolean, boolean]
    > = {
      '0': [true, true, true, true, true, true, false],
      '1': [false, true, true, false, false, false, false],
      '2': [true, true, false, true, true, false, true],
      '3': [true, true, true, true, false, false, true],
      '4': [false, true, true, false, false, true, true],
      '5': [true, false, true, true, false, true, true],
      '6': [true, false, true, true, true, true, true],
      '7': [true, true, true, false, false, false, false],
      '8': [true, true, true, true, true, true, true],
      '9': [true, true, true, true, false, true, true],
    };

    const width = digitWidth * 3 + gap * 2;
    const height = digitHeight;
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {segmentsFor(0, map[str[0]])}
        {segmentsFor(digitWidth + gap, map[str[1]])}
        {segmentsFor(2 * (digitWidth + gap), map[str[2]])}
      </svg>
    );
  };

  return (
    <div
      className="h-screen w-screen overflow-hidden select-none flex flex-col items-center justify-start bg-[#bdbdbd]"
      style={{ ['--ms-cell-size' as any]: `${CELL_SIZE}px` }}
    >
      <div className="w-full max-w-full flex justify-center">
        <div
          className="ms-panel"
          style={{ width: boardWidth + 2, marginLeft: '2px' }}
        >
          <div className="ms-led">
            <SevenSegment value={minesRemaining} />
          </div>
          <button
            className="ms-tool"
            onClick={() => {
              setActiveTab('settings');
              setIsSettingsOpen(true);
            }}
            aria-label="open-settings"
            style={{ width: 36, height: 36 }}
          >
            ⚙️
          </button>
          <button
            className="ms-smiley"
            onClick={() => reset()}
            aria-label="reset"
          >
            {gameOver ? (isWin ? '😎' : '😵') : '😊'}
          </button>
          <button
            className={`ms-tool ${tool === 'flag' ? 'ms-tool-active' : ''}`}
            onClick={() => setTool(tool === 'flag' ? 'reveal' : 'flag')}
            aria-label="toggle-flag"
            style={{ width: 36, height: 36 }}
          >
            {tool === 'flag' ? '🚩' : '⛏️'}
          </button>
          <div className="ms-led">
            <SevenSegment value={seconds} />
          </div>
        </div>
      </div>

      {isSettingsOpen && (
        <div className="ms-modal-overlay" role="dialog" aria-modal="true">
          <div className="ms-modal" role="document">
            <div className="ms-tabs">
              <button
                className={`ms-tab ${activeTab === 'settings' ? 'ms-tab-active' : ''}`}
                onClick={() => setActiveTab('settings')}
                aria-selected={activeTab === 'settings'}
              >
                Settings
              </button>
              <button
                className={`ms-tab ${activeTab === 'account' ? 'ms-tab-active' : ''}`}
                onClick={() => setActiveTab('account')}
                aria-selected={activeTab === 'account'}
              >
                Account
              </button>
              <button
                className="ms-tab ms-tab-right"
                onClick={() => setIsSettingsOpen(false)}
                aria-label="close"
                title="Close"
              >
                ✕
              </button>
            </div>

            {activeTab === 'settings' && (
              <div className="ms-modal-section">
                <div className="ms-section-title">Difficulty</div>
                <div className="ms-radio-group">
                  <label className="ms-radio">
                    <input
                      type="radio"
                      name="difficulty"
                      value="easy"
                      checked={difficulty === 'easy'}
                      onChange={() => applyDifficulty('easy')}
                    />
                    <span>Easy</span>
                  </label>
                  <label className="ms-radio">
                    <input
                      type="radio"
                      name="difficulty"
                      value="normal"
                      checked={difficulty === 'normal'}
                      onChange={() => applyDifficulty('normal')}
                    />
                    <span>Normal</span>
                  </label>
                  <label className="ms-radio">
                    <input
                      type="radio"
                      name="difficulty"
                      value="hard"
                      checked={difficulty === 'hard'}
                      onChange={() => applyDifficulty('hard')}
                    />
                    <span>Hard</span>
                  </label>
                </div>
                <div className="ms-hint">Changes apply immediately and restart the board.</div>
              </div>
            )}

            {activeTab === 'account' && (
              <div className="ms-modal-section">
                <div className="ms-section-title">Get Ranked</div>
                <p className="ms-copy">
                  Create an account to join the website ranking once it launches. Your best
                  times and wins will appear on the leaderboard.
                </p>
                <button
                  className="ms-button"
                  onClick={() => signIn('google')}
                  aria-label="Sign in with Google"
                >
                  Continue with Google
                </button>
              </div>
            )}
          </div>
          <button className="ms-modal-backdrop" aria-hidden="true" onClick={() => setIsSettingsOpen(false)} />
        </div>
      )}

      <div className="w-full h-full flex items-start justify-center">
        <div
          className="ms-board"
          style={{ ...gridTemplate, width: boardWidth }}
          onContextMenu={onContextMenu}
        >
          {board.map((row: Cell[], r: number) =>
            row.map((cell: Cell, c: number) => {
              const content = cellContent(cell);
              const showNumber =
                cell.isRevealed && !cell.isMine && cell.neighborMines > 0;
              return (
                <button
                  key={`${r}-${c}`}
                  onMouseDown={(e) =>
                    onCellMouseDown(e as unknown as MouseEvent, r, c)
                  }
                  onDoubleClick={(e) =>
                    onCellDoubleClick(e as unknown as MouseEvent, r, c)
                  }
                  onTouchStart={(e) =>
                    onCellTouchStart(e as unknown as TouchEvent, r, c)
                  }
                  onTouchEnd={(e) =>
                    onCellTouchEnd(e as unknown as TouchEvent, r, c)
                  }
                  onTouchMove={(e) =>
                    onCellTouchMove(e as unknown as TouchEvent)
                  }
                  onTouchCancel={() => onCellTouchCancel()}
                  className={
                    'flex items-center justify-center text-[16px] font-bold ' +
                    (cell.isRevealed
                      ? 'ms-cell-revealed ' +
                        (showNumber ? numberClass(cell.neighborMines) : '')
                      : 'ms-cell')
                  }
                  aria-label={`cell-${r}-${c}`}
                >
                  {content}
                </button>
              );
            })
          )}
        </div>
      </div>

      {gameOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="px-6 py-4 rounded-lg shadow-lg bg-black/80 text-white text-4xl md:text-6xl font-extrabold tracking-wide text-center">
            {isWin ? 'You Win!' : 'Boom!'}
          </div>
        </div>
      )}
    </div>
  );
}
