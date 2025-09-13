"use client";

export default function Smiley(props: {
  gameOver: boolean;
  isWin: boolean;
  onReset: () => void;
}) {
  const { gameOver, isWin, onReset } = props;
  return (
    <button className="ms-smiley" onClick={onReset} aria-label="reset">
      {gameOver ? (isWin ? "😎" : "😵") : "😊"}
    </button>
  );
}

