"use client";

import type { MouseEvent, TouchEvent } from "react";

type Cell = {
  isMine: boolean;
  isRevealed: boolean;
  isFlagged: boolean;
  neighborMines: number;
};

export default function Board(props: {
  board: Cell[][];
  boardWidth: number;
  gridTemplate: Record<string, string>;
  onContextMenu: (e: MouseEvent) => void;
  onCellMouseDown: (e: MouseEvent, r: number, c: number) => void;
  onCellDoubleClick: (e: MouseEvent, r: number, c: number) => void;
  onCellTouchStart: (e: TouchEvent, r: number, c: number) => void;
  onCellTouchEnd: (e: TouchEvent, r: number, c: number) => void;
  onCellTouchMove: (e: TouchEvent) => void;
  onCellTouchCancel: () => void;
  numberClass: (n: number) => string;
  cellContent: (cell: Cell) => string;
}) {
  const {
    board,
    boardWidth,
    gridTemplate,
    onContextMenu,
    onCellMouseDown,
    onCellDoubleClick,
    onCellTouchStart,
    onCellTouchEnd,
    onCellTouchMove,
    onCellTouchCancel,
    numberClass,
    cellContent,
  } = props;

  return (
    <div className="w-full h-full flex items-start justify-center">
      <div
        className="ms-board"
        style={{ ...gridTemplate, width: boardWidth }}
        onContextMenu={onContextMenu as any}
      >
        {board.map((row: Cell[], r: number) =>
          row.map((cell: Cell, c: number) => {
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
                  "flex items-center justify-center text-[16px] font-bold " +
                  (cell.isRevealed ? "ms-cell-revealed " + (showNumber ? numberClass(cell.neighborMines) : "") : "ms-cell")
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
  );
}

