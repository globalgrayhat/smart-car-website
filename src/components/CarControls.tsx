import React, { useState, useRef, type RefObject } from "react";
import { gsap } from "gsap";

type Direction = "forward" | "backward" | "left" | "right" | "";

/**
 * We allow both:
 * - onDirectionChange={(dir: string) => void}
 * - onDirectionChange={setDirection} (from useState)
 */
interface CarControlsProps {
  onDirectionChange?:
    | ((direction: string) => void)
    | React.Dispatch<React.SetStateAction<string>>;
}

export default function CarControls({ onDirectionChange }: CarControlsProps) {
  const [activeDirection, setActiveDirection] = useState<Direction>("");

  const forwardRef = useRef<HTMLButtonElement | null>(null);
  const backwardRef = useRef<HTMLButtonElement | null>(null);
  const leftRef = useRef<HTMLButtonElement | null>(null);
  const rightRef = useRef<HTMLButtonElement | null>(null);

  const buttonsMap: Record<
    Exclude<Direction, "">,
    RefObject<HTMLButtonElement>
  > = {
    forward: forwardRef,
    backward: backwardRef,
    left: leftRef,
    right: rightRef,
  };

  // helper to notify parent without TS whining
  const notifyParent = (value: string) => {
    if (!onDirectionChange) return;
    // both function types are callable the same way
    (onDirectionChange as React.Dispatch<React.SetStateAction<string>>)(value);
  };

  const handleButtonPress = (direction: Exclude<Direction, "">) => {
    setActiveDirection(direction);
    notifyParent(direction);

    const btnRef = buttonsMap[direction];
    if (btnRef.current) {
      gsap.to(btnRef.current, {
        scale: 0.9,
        duration: 0.1,
        ease: "power1.out",
      });
    }
  };

  const handleButtonRelease = () => {
    setActiveDirection("");
    notifyParent("");

    const targets = [
      forwardRef.current,
      backwardRef.current,
      leftRef.current,
      rightRef.current,
    ].filter((el): el is HTMLButtonElement => !!el);

    if (targets.length) {
      gsap.to(targets, {
        scale: 1,
        duration: 0.2,
        ease: "back.out(1.5)",
      });
    }
  };

  return (
    <div className="car-controls grid grid-cols-3 gap-2 w-full max-w-xs mx-auto select-none">
      {/* Up */}
      <div className="col-start-2">
        <button
          ref={forwardRef}
          type="button"
          className={`control-button w-full p-4 rounded-lg ${
            activeDirection === "forward" ? "bg-blue-600" : "bg-blue-500"
          } text-white shadow-lg hover:bg-blue-600 transition-colors`}
          onPointerDown={() => handleButtonPress("forward")}
          onPointerUp={handleButtonRelease}
          onPointerLeave={handleButtonRelease}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 mx-auto"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 15l7-7 7 7"
            />
          </svg>
        </button>
      </div>

      {/* Left */}
      <div className="col-start-1 row-start-2">
        <button
          ref={leftRef}
          type="button"
          className={`control-button w-full p-4 rounded-lg ${
            activeDirection === "left" ? "bg-blue-600" : "bg-blue-500"
          } text-white shadow-lg hover:bg-blue-600 transition-colors`}
          onPointerDown={() => handleButtonPress("left")}
          onPointerUp={handleButtonRelease}
          onPointerLeave={handleButtonRelease}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 mx-auto"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
      </div>

      {/* Right */}
      <div className="col-start-3 row-start-2">
        <button
          ref={rightRef}
          type="button"
          className={`control-button w-full p-4 rounded-lg ${
            activeDirection === "right" ? "bg-blue-600" : "bg-blue-500"
          } text-white shadow-lg hover:bg-blue-600 transition-colors`}
          onPointerDown={() => handleButtonPress("right")}
          onPointerUp={handleButtonRelease}
          onPointerLeave={handleButtonRelease}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 mx-auto"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>

      {/* Down */}
      <div className="col-start-2 row-start-3">
        <button
          ref={backwardRef}
          type="button"
          className={`control-button w-full p-4 rounded-lg ${
            activeDirection === "backward" ? "bg-blue-600" : "bg-blue-500"
          } text-white shadow-lg hover:bg-blue-600 transition-colors`}
          onPointerDown={() => handleButtonPress("backward")}
          onPointerUp={handleButtonRelease}
          onPointerLeave={handleButtonRelease}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 mx-auto"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
