"use client";
import type { CSSProperties } from "react";
interface SquareProps {
  light: boolean;          // true = light square, false = dark square
  selected: boolean;       // this square is the selected piece
  hint: boolean;           // this square is a legal-move hint
  check: boolean;          // king on this square is in check
  children?: React.ReactNode;
  onSelect: () => void;
}
export const Square = ({ light, selected, hint, check, children, onSelect }: SquareProps) => {
  let bg: string;
  if (selected)      bg = "#ff0000";           // yellow highlight
  else if (check)    bg = "#e84040";           // red for king in check
  else if (light)    bg = "#000000";           // classic light
  else               bg = "#990000";           // classic dark
  const style: CSSProperties = {
    backgroundColor: bg,
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    position: "relative",
    boxSizing: "border-box",
  };

  return (
    <div style={style} onClick={onSelect}>
      {hint && (
        <div style={{
          position: "absolute",
          width: children ? "90%" : "34%",
          height: children ? "90%" : "34%",
          borderRadius: "50%",
          backgroundColor: children ? "rgba(20,85,0,0.35)" : "rgba(20,85,0,0.45)",
          border: children ? "3px solid rgba(20,85,0,0.5)" : "none",
          pointerEvents: "none",
        }} />
      )}
      {children}
    </div>
  );
};