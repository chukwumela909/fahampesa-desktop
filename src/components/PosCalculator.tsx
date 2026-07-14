import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Delete, X } from "lucide-react";

// A floating, draggable iPhone-style calculator for the POS screen. Self-contained
// scratch pad (no cart integration): position is remembered across sessions, it
// takes keyboard input, and it stays open until the cashier closes it.

type Op = "+" | "-" | "*" | "/";

interface CalcState {
  display: string;
  accumulator: number | null;
  pendingOp: Op | null;
  waiting: boolean; // true right after an operator/equals, so the next digit starts fresh
}

type CalcAction =
  | { type: "digit"; value: string }
  | { type: "dot" }
  | { type: "op"; op: Op }
  | { type: "equals" }
  | { type: "clear" }
  | { type: "backspace" }
  | { type: "percent" }
  | { type: "negate" };

const MAX_DIGITS = 12;
const initialCalc: CalcState = { display: "0", accumulator: null, pendingOp: null, waiting: false };

function operate(a: number, b: number, op: Op): number {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "*":
      return a * b;
    case "/":
      return b === 0 ? NaN : a / b;
  }
}

function fmt(n: number): string {
  if (Number.isNaN(n) || !Number.isFinite(n)) return "Error";
  // Strip floating-point noise (0.1 + 0.2 -> 0.3) and cap significant digits.
  return parseFloat(n.toPrecision(12)).toString();
}

function digitCount(s: string): number {
  return s.replace(/[-.]/g, "").length;
}

function calcReducer(state: CalcState, action: CalcAction): CalcState {
  const isError = state.display === "Error";
  switch (action.type) {
    case "digit": {
      if (isError || state.waiting) return { ...state, display: action.value, waiting: false };
      if (state.display === "0") return { ...state, display: action.value };
      if (digitCount(state.display) >= MAX_DIGITS) return state;
      return { ...state, display: state.display + action.value };
    }
    case "dot": {
      if (isError || state.waiting) return { ...state, display: "0.", waiting: false };
      if (state.display.includes(".")) return state;
      return { ...state, display: state.display + "." };
    }
    case "clear":
      return initialCalc;
    case "backspace": {
      if (isError) return initialCalc;
      if (state.waiting) return state;
      const next = state.display.slice(0, -1);
      if (next === "" || next === "-") return { ...state, display: "0" };
      return { ...state, display: next };
    }
    case "negate": {
      if (isError || state.display === "0") return state;
      return { ...state, display: state.display.startsWith("-") ? state.display.slice(1) : "-" + state.display };
    }
    case "percent": {
      if (isError) return state;
      return { ...state, display: fmt(parseFloat(state.display) / 100) };
    }
    case "op": {
      if (isError) return state;
      const input = parseFloat(state.display);
      if (state.pendingOp !== null && !state.waiting) {
        const result = operate(state.accumulator ?? 0, input, state.pendingOp);
        const ok = Number.isFinite(result);
        return { display: fmt(result), accumulator: ok ? result : null, pendingOp: ok ? action.op : null, waiting: true };
      }
      return { ...state, accumulator: input, pendingOp: action.op, waiting: true };
    }
    case "equals": {
      if (isError || state.pendingOp === null) return state;
      const input = parseFloat(state.display);
      const result = operate(state.accumulator ?? 0, input, state.pendingOp);
      return { display: fmt(result), accumulator: null, pendingOp: null, waiting: true };
    }
    default:
      return state;
  }
}

const POSITION_KEY = "fahampesa:pos-calc-position";
const PANEL_W = 264;

function clampPosition(x: number, y: number) {
  if (typeof window === "undefined") return { x, y };
  const maxX = Math.max(0, window.innerWidth - PANEL_W);
  const maxY = Math.max(0, window.innerHeight - 80); // keep the drag handle on-screen
  return { x: Math.min(Math.max(0, x), maxX), y: Math.min(Math.max(0, y), maxY) };
}

function defaultPosition() {
  if (typeof window === "undefined") return { x: 24, y: 96 };
  return clampPosition(window.innerWidth - PANEL_W - 24, 96);
}

function readStoredPosition() {
  if (typeof window === "undefined") return defaultPosition();
  try {
    const raw = window.localStorage.getItem(POSITION_KEY);
    if (raw) {
      const p = JSON.parse(raw) as { x: number; y: number };
      if (typeof p.x === "number" && typeof p.y === "number") return clampPosition(p.x, p.y);
    }
  } catch {
    /* ignore malformed storage */
  }
  return defaultPosition();
}

export default function PosCalculator({ onClose }: { onClose: () => void }) {
  const [calc, dispatch] = useReducer(calcReducer, initialCalc);
  const [pos, setPos] = useState(readStoredPosition);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  // Re-clamp if the window shrinks so the panel can't get stranded off-screen.
  useEffect(() => {
    const onResize = () => setPos((p) => clampPosition(p.x, p.y));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Keyboard input — ignored while a form field is focused so it never hijacks the
  // product search / quantity boxes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      const k = e.key;
      if (k >= "0" && k <= "9") dispatch({ type: "digit", value: k });
      else if (k === ".") dispatch({ type: "dot" });
      else if (k === "+" || k === "-") dispatch({ type: "op", op: k });
      else if (k === "*" || k === "x" || k === "X") dispatch({ type: "op", op: "*" });
      else if (k === "/") dispatch({ type: "op", op: "/" });
      else if (k === "Enter" || k === "=") dispatch({ type: "equals" });
      else if (k === "Backspace") dispatch({ type: "backspace" });
      else if (k === "%") dispatch({ type: "percent" });
      else if (k === "Escape") dispatch({ type: "clear" });
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!dragRef.current) return;
    setPos(clampPosition(e.clientX - dragRef.current.dx, e.clientY - dragRef.current.dy));
  }, []);

  const stopDrag = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", stopDrag);
    setPos((p) => {
      try {
        window.localStorage.setItem(POSITION_KEY, JSON.stringify(p));
      } catch {
        /* ignore storage failures */
      }
      return p;
    });
  }, [onPointerMove]);

  const startDrag = (e: React.PointerEvent) => {
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopDrag);
  };

  useEffect(
    () => () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stopDrag);
    },
    [onPointerMove, stopDrag],
  );

  const fnBtn = "bg-[#6b6b70] hover:bg-[#7d7d83]";
  const numBtn = "bg-[#4a4a50] hover:bg-[#5a5a61]";
  const opBtn = "bg-[#ff9f0a] hover:bg-[#ffb13a]";

  return (
    <div
      className="fixed z-[60] w-[264px] select-none rounded-[26px] border border-[#2c2c2e] bg-[#1c1c1e] shadow-[0_24px_60px_rgba(0,0,0,0.5)]"
      style={{ left: pos.x, top: pos.y, fontFamily: "system-ui, -apple-system, sans-serif" }}
      role="dialog"
      aria-label="Calculator"
    >
      <div
        onPointerDown={startDrag}
        className="flex cursor-grab items-center justify-between rounded-t-[26px] px-4 pb-1 pt-3 active:cursor-grabbing"
      >
        <span className="text-[13px] font-medium text-[#8e8e93]">Calculator</span>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose}
          className="grid h-7 w-7 place-items-center rounded-full text-[#8e8e93] transition hover:bg-[#2c2c2e] hover:text-white"
          aria-label="Close calculator"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-5 pb-2 pt-1">
        <div className="truncate text-right text-[44px] font-light leading-tight text-white" title={calc.display}>
          {calc.display}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 p-3 pt-1">
        <Key className={fnBtn} onClick={() => dispatch({ type: "backspace" })} ariaLabel="Backspace">
          <Delete className="h-5 w-5" />
        </Key>
        <Key className={fnBtn} onClick={() => dispatch({ type: "clear" })}>AC</Key>
        <Key className={fnBtn} onClick={() => dispatch({ type: "percent" })}>%</Key>
        <Key className={opBtn} onClick={() => dispatch({ type: "op", op: "/" })}>÷</Key>

        <Key className={numBtn} onClick={() => dispatch({ type: "digit", value: "7" })}>7</Key>
        <Key className={numBtn} onClick={() => dispatch({ type: "digit", value: "8" })}>8</Key>
        <Key className={numBtn} onClick={() => dispatch({ type: "digit", value: "9" })}>9</Key>
        <Key className={opBtn} onClick={() => dispatch({ type: "op", op: "*" })}>×</Key>

        <Key className={numBtn} onClick={() => dispatch({ type: "digit", value: "4" })}>4</Key>
        <Key className={numBtn} onClick={() => dispatch({ type: "digit", value: "5" })}>5</Key>
        <Key className={numBtn} onClick={() => dispatch({ type: "digit", value: "6" })}>6</Key>
        <Key className={opBtn} onClick={() => dispatch({ type: "op", op: "-" })}>−</Key>

        <Key className={numBtn} onClick={() => dispatch({ type: "digit", value: "1" })}>1</Key>
        <Key className={numBtn} onClick={() => dispatch({ type: "digit", value: "2" })}>2</Key>
        <Key className={numBtn} onClick={() => dispatch({ type: "digit", value: "3" })}>3</Key>
        <Key className={opBtn} onClick={() => dispatch({ type: "op", op: "+" })}>+</Key>

        <Key className={numBtn} onClick={() => dispatch({ type: "negate" })} ariaLabel="Toggle sign">±</Key>
        <Key className={numBtn} onClick={() => dispatch({ type: "digit", value: "0" })}>0</Key>
        <Key className={numBtn} onClick={() => dispatch({ type: "dot" })}>.</Key>
        <Key className={opBtn} onClick={() => dispatch({ type: "equals" })}>=</Key>
      </div>
    </div>
  );
}

function Key({
  children,
  className,
  onClick,
  ariaLabel,
}: {
  children: React.ReactNode;
  className: string;
  onClick: () => void;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={`grid aspect-square place-items-center rounded-full text-[22px] font-medium text-white transition active:scale-95 ${className}`}
    >
      {children}
    </button>
  );
}
