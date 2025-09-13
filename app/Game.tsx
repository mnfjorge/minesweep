'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import type { MouseEvent, TouchEvent } from 'react';
import Board from './components/Board';
import ToolToggle from './components/ToolToggle';
import Smiley from './components/Smiley';
import Settings from './components/Settings';
import Ranking from './components/Ranking';

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

type Difficulty = 'easy' | 'normal' | 'hard';

export default function Game(props: {
  onSubmitRank: (args: { seconds: number; difficulty: Difficulty }) => Promise<unknown>;
  fetchLeaderboard: () => Promise<{ easy: Array<{ userId: string; seconds: number; name: string | null; email: string | null }>; normal: Array<{ userId: string; seconds: number; name: string | null; email: string | null }>; hard: Array<{ userId: string; seconds: number; name: string | null; email: string | null }> }>;
}) {
  const { onSubmitRank, fetchLeaderboard } = props;

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

  // Sizing constants resembling classic Minesweeper
  const CELL_SIZE = 32; // px (bigger tiles like the reference)
  const HEADER_HEIGHT = 64; // px
  const PADDING = 0; // remove external padding around the board

  const computeConfig = useCallback((): BoardConfig => {
    if (typeof window === 'undefined') return { rows: 9, cols: 9, mines: 10 };
    const frameExtra = 4;
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
      Math.floor((availableHeight - frameExtra) / CELL_SIZE) - 1
    );
    const total = rows * cols;
    let difficultySaved: Difficulty = 'normal';
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

  const track = (eventName: string, params?: Record<string, any>) => {
    try {
      if (typeof window === 'undefined') return;
      const gtag = (window as any).gtag as undefined | ((...args: any[]) => void);
      if (typeof gtag !== 'function') return;
      gtag('event', eventName, { ...params, send_to: 'G-XFBE0FWT1T' });
    } catch {}
  };

  const [config, setConfig] = useState<BoardConfig>(() => computeConfig());
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'settings' | 'account'>('settings');
  const [difficulty, setDifficulty] = useState<Difficulty>(() => {
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
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef<boolean>(false);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const { data: session, status } = useSession();

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
    (totalCells: number, diff: Difficulty) => {
      const factor = diff === 'easy' ? 0.1 : diff === 'hard' ? 0.2 : 0.15;
      return Math.max(1, Math.floor(totalCells * factor));
    },
    []
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

  const applyDifficulty = useCallback(
    (nextDifficulty: Difficulty) => {
      const total = config.rows * config.cols;
      const mines = computeMinesForDifficulty(total, nextDifficulty);
      setDifficulty(nextDifficulty);
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('ms_difficulty_v1', nextDifficulty);
        }
      } catch {}
      if (nextDifficulty === 'easy') track('difficulty_easy');
      else if (nextDifficulty === 'normal') track('difficulty_normal');
      else if (nextDifficulty === 'hard') track('difficulty_hard');
      reset({ rows: config.rows, cols: config.cols, mines });
    },
    [computeMinesForDifficulty, config.cols, config.rows, reset]
  );

  useEffect(() => {
    const onResize = () => {
      if (!isFirstClickRef.current) return;
      const next = computeConfig();
      reset(next);
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

  // Local best score persistence (per difficulty) with name capture
  const saveLocalBest = useCallback(
    (args: { seconds: number; difficulty: Difficulty }) => {
      try {
        if (typeof window === 'undefined') return;

        const BEST_KEY = 'ms_best_v1';
        const NAME_KEY = 'ms_player_name_v1';

        // Load current bests
        let bestAll: any = null;
        try {
          const raw = window.localStorage.getItem(BEST_KEY);
          if (raw) bestAll = JSON.parse(raw);
        } catch {}
        if (!bestAll || typeof bestAll !== 'object') bestAll = {};

        const firstNonEmpty = (...values: Array<unknown>): string => {
          for (const v of values) {
            if (typeof v === 'string') {
              const t = v.trim();
              if (t && t.toLowerCase() !== 'undefined' && t.toLowerCase() !== 'null') return t;
            }
          }
          return '';
        };

        let candidateName = '';
        let storedName = '';
        try {
          storedName = String(window.localStorage.getItem(NAME_KEY) || '').trim();
        } catch {}

        candidateName = firstNonEmpty(
          storedName,
          (session?.user?.name as any) as string,
          (session?.user?.email as any) as string
        );

        if (!candidateName) {
          try {
            const input = window.prompt('Enter your name to save your best score:', '');
            const sanitized = typeof input === 'string' ? input.trim().slice(0, 40) : '';
            if (sanitized) {
              candidateName = sanitized;
              try { window.localStorage.setItem(NAME_KEY, candidateName); } catch {}
            }
          } catch {}
        }

        if (!candidateName) candidateName = 'Player';

        const prev = bestAll[args.difficulty];
        const isBetter = !prev || typeof prev.seconds !== 'number' || args.seconds < prev.seconds;
        if (isBetter) {
          bestAll[args.difficulty] = {
            name: candidateName,
            seconds: Math.max(0, Math.floor(args.seconds)),
            updatedAt: new Date().toISOString(),
          };
          try {
            window.localStorage.setItem(BEST_KEY, JSON.stringify(bestAll));
          } catch {}
          track('local_best_updated', { difficulty: args.difficulty, seconds: args.seconds });
        }
      } catch {}
    },
    [session]
  );

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
        const clone = cloneBoard(b);
        for (let r = 0; r < clone.length; r++) {
          for (let c = 0; c < clone[0].length; c++) {
            if (clone[r][c].isMine) clone[r][c].isFlagged = true;
          }
        }
        setBoard(clone);
        setFlagsPlaced(config.mines);
        track('win', {
          seconds,
          rows: config.rows,
          cols: config.cols,
          mines: config.mines,
          difficulty,
        });
        // Save best score locally with name
        try {
          saveLocalBest({ seconds, difficulty });
        } catch {}
        try {
          if (status === 'authenticated') {
            if (!(window as any)._rankSubmitted) {
              (window as any)._rankSubmitted = true;
              onSubmitRank({ seconds, difficulty }).catch(() => { alert('Ranking not saved') });
            }
          }
        } catch {}
      }
    },
    [config.mines, status, seconds, onSubmitRank, saveLocalBest]
  );

  const revealCell = useCallback(
    (r: number, c: number) => {
      if (gameOver) return;
      let newBoard = cloneBoard(board);

      if (isFirstClick) {
        placeMines(newBoard, r, c, config.mines);
        setIsFirstClick(false);
        startTimer();
        track('game_start', {
          rows: config.rows,
          cols: config.cols,
          mines: config.mines,
          difficulty,
        });
      }

      const cell = newBoard[r][c];
      if (cell.isRevealed || cell.isFlagged) return;

      if (cell.isMine) {
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
        track('loss', {
          seconds,
          rows: config.rows,
          cols: config.cols,
          mines: config.mines,
          difficulty,
        });
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
      const newBoard = cloneBoard(board);
      const cell = newBoard[r][c];
      if (cell.isRevealed) return;
      const wasFlagged = cell.isFlagged;
      cell.isFlagged = !cell.isFlagged;
      setBoard(newBoard);
      setFlagsPlaced((prev: number) => prev + (cell.isFlagged ? 1 : -1));
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
    [board, gameOver]
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
        track('loss', {
          seconds,
          rows: config.rows,
          cols: config.cols,
          mines: config.mines,
          difficulty,
        });
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
      } else if (e.button === 2) {
        if (tool === 'flag') {
          revealCell(r, c);
        } else {
          toggleFlag(r, c);
        }
      }
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

  const boardWidth = useMemo(() => config.cols * CELL_SIZE, [config.cols]);

  const numberClass = (n: number) => {
    if (n <= 0) return '';
    return `ms-n${n}`;
  };

  const pad3 = (n: number) =>
    String(Math.max(0, Math.min(999, n))).padStart(3, '0');

  const SevenSegment = ({ value }: { value: number }) => {
    const str = pad3(value);
    const on = '#ff2a2a';
    const off = '#300000';
    const digitWidth = 14;
    const digitHeight = 24;
    const seg = 4;
    const gap = 3;

    const segmentsFor = (x: number, lit: boolean[]) => (
      <g transform={`translate(${x},0)`}>
        <rect x={1} y={0} width={digitWidth - 2} height={seg} fill={lit[0] ? on : off} />
        <rect x={digitWidth - seg} y={1} width={seg} height={digitHeight / 2 - 2} fill={lit[1] ? on : off} />
        <rect x={digitWidth - seg} y={digitHeight / 2 + 1} width={seg} height={digitHeight / 2 - 2} fill={lit[2] ? on : off} />
        <rect x={1} y={digitHeight - seg} width={digitWidth - 2} height={seg} fill={lit[3] ? on : off} />
        <rect x={0} y={digitHeight / 2 + 1} width={seg} height={digitHeight / 2 - 2} fill={lit[4] ? on : off} />
        <rect x={0} y={1} width={seg} height={digitHeight / 2 - 2} fill={lit[5] ? on : off} />
        <rect x={1} y={digitHeight / 2 - seg / 2} width={digitWidth - 2} height={seg} fill={lit[6] ? on : off} />
      </g>
    );

    const map: Record<string, [boolean, boolean, boolean, boolean, boolean, boolean, boolean]> = {
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

  const formatSeconds = (total: number) => {
    const clamped = Math.max(0, Math.floor(total));
    const m = Math.floor(clamped / 60);
    const s = clamped % 60;
    if (m <= 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  // Ranking modal handles its own fetch on open

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
              track('open_settings');
            }}
            aria-label="open-settings"
            style={{ width: 36, height: 36 }}
          >
            ⚙️
          </button>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Smiley gameOver={gameOver} isWin={isWin} onReset={() => reset()} />
            <button
              className="ms-tool"
              onClick={() => { track('open_ranking_button'); setIsLeaderboardOpen(true); }}
              aria-label="open-leaderboard"
              title="Leaderboard"
              style={{ width: 36, height: 36 }}
            >
              🏆
            </button>
          </div>
          <ToolToggle tool={tool} onToggle={(next) => { setTool(next); if (next === 'flag') track('tool_flag'); else track('tool_reveal'); }} />
          <div className="ms-led">
            <SevenSegment value={seconds} />
          </div>
        </div>
      </div>

      <Settings
        isOpen={isSettingsOpen}
        activeTab={activeTab}
        onChangeTab={(t) => setActiveTab(t)}
        onClose={() => setIsSettingsOpen(false)}
        difficulty={difficulty}
        applyDifficulty={applyDifficulty}
        onTrack={(e) => track(e)}
      />

      <Ranking
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
        fetchEntries={fetchLeaderboard}
        onTrack={(e) => track(e)}
        formatSeconds={formatSeconds}
      />

      <Board
        board={board}
        boardWidth={boardWidth}
        gridTemplate={gridTemplate}
        onContextMenu={onContextMenu as any}
        onCellMouseDown={(e, r, c) => onCellMouseDown(e, r, c)}
        onCellDoubleClick={(e, r, c) => onCellDoubleClick(e, r, c)}
        onCellTouchStart={(e, r, c) => onCellTouchStart(e, r, c)}
        onCellTouchEnd={(e, r, c) => onCellTouchEnd(e, r, c)}
        onCellTouchMove={(e) => onCellTouchMove(e)}
        onCellTouchCancel={() => onCellTouchCancel()}
        numberClass={numberClass}
        cellContent={cellContent}
      />

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

