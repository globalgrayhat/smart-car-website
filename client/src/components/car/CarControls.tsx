/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * CarControls
 *
 * Basic directional controls for the vehicle.
 * - Emits "vehicle:control" over MediaContext socket.
 * - Maintains local activeDirection for visual feedback.
 */

import React, { useState, useRef } from "react";
import { useMedia } from "../../media/MediaContext";

interface CarControlsProps {
  onDirectionChange?:
    | ((direction: string) => void)
    | React.Dispatch<React.SetStateAction<string>>;
}

const CarControls: React.FC<CarControlsProps> = ({ onDirectionChange }) => {
  const media = useMedia() as any;
  const socket = media?.socket ?? null;

  const [activeDirection, setActiveDirection] = useState<string>("");

  const forwardRef = useRef<HTMLButtonElement | null>(null);
  const backwardRef = useRef<HTMLButtonElement | null>(null);
  const leftRef = useRef<HTMLButtonElement | null>(null);
  const rightRef = useRef<HTMLButtonElement | null>(null);

  const emitDir = (dir: string) => {
    if (socket) {
      socket.emit("vehicle:control", { action: dir });
    }
    if (onDirectionChange) onDirectionChange(dir);
  };

  const handlePress = (dir: "forward" | "backward" | "left" | "right") => {
    setActiveDirection(dir);
    emitDir(dir);
  };

  const handleRelease = () => {
    setActiveDirection("");
    emitDir("stop");
  };

  return (
    <div className="grid w-full max-w-xs grid-cols-3 gap-2 mx-auto select-none">
      {/* Forward */}
      <div className="col-start-2">
        <button
          ref={forwardRef}
          type="button"
          className={`w-full p-4 rounded-lg shadow-lg text-white transition-colors ${
            activeDirection === "forward" ? "bg-blue-600" : "bg-blue-500"
          } hover:bg-blue-600`}
          onPointerDown={() => handlePress("forward")}
          onPointerUp={handleRelease}
          onPointerLeave={handleRelease}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-6 h-6 mx-auto"
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
          className={`w-full p-4 rounded-lg shadow-lg text-white transition-colors ${
            activeDirection === "left" ? "bg-blue-600" : "bg-blue-500"
          } hover:bg-blue-600`}
          onPointerDown={() => handlePress("left")}
          onPointerUp={handleRelease}
          onPointerLeave={handleRelease}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-6 h-6 mx-auto"
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
          className={`w-full p-4 rounded-lg shadow-lg text-white transition-colors ${
            activeDirection === "right" ? "bg-blue-600" : "bg-blue-500"
          } hover:bg-blue-600`}
          onPointerDown={() => handlePress("right")}
          onPointerUp={handleRelease}
          onPointerLeave={handleRelease}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-6 h-6 mx-auto"
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

      {/* Backward */}
      <div className="col-start-2 row-start-3">
        <button
          ref={backwardRef}
          type="button"
          className={`w-full p-4 rounded-lg shadow-lg text-white transition-colors ${
            activeDirection === "backward" ? "bg-blue-600" : "bg-blue-500"
          } hover:bg-blue-600`}
          onPointerDown={() => handlePress("backward")}
          onPointerUp={handleRelease}
          onPointerLeave={handleRelease}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-6 h-6 mx-auto"
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
};

export default CarControls;
