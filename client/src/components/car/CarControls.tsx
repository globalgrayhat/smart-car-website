import React, { useState, useRef } from "react";
import { useMedia } from "../../media/MediaContext";

interface CarControlsProps {
  // optional: لو أحد فوق يبغي يسمع للاتجاه
  onDirectionChange?:
    | ((direction: string) => void)
    | React.Dispatch<React.SetStateAction<string>>;
}

/**
 * Car controls:
 * - pointer down → send "vehicle:control" over /mediasoup socket
 * - pointer up/leave → send "vehicle:control" { action: "stop" }
 * - keeps local activeDirection for UI
 * - falls back to onDirectionChange prop if موجود
 */
export default function CarControls({ onDirectionChange }: CarControlsProps) {
  const media = useMedia() as any;
  const socket = media?.socket ?? null;
  const [activeDirection, setActiveDirection] = useState<string>("");

  const forwardRef = useRef<HTMLButtonElement | null>(null);
  const backwardRef = useRef<HTMLButtonElement | null>(null);
  const leftRef = useRef<HTMLButtonElement | null>(null);
  const rightRef = useRef<HTMLButtonElement | null>(null);

  const emitDir = (dir: string) => {
    // send to WS (mediasoup gateway)
    if (socket) {
      socket.emit("vehicle:control", { action: dir });
    }
    // notify parent if needed
    if (onDirectionChange) {
      onDirectionChange(dir);
    }
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
    <div className="grid w-full max-w-xs grid-cols-3 gap-2 mx-auto select-none car-controls">
      {/* UP */}
      <div className="col-start-2">
        <button
          ref={forwardRef}
          type="button"
          className={`control-button w-full p-4 rounded-lg ${
            activeDirection === "forward" ? "bg-blue-600" : "bg-blue-500"
          } text-white shadow-lg hover:bg-blue-600 transition-colors`}
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </div>

      {/* LEFT */}
      <div className="col-start-1 row-start-2">
        <button
          ref={leftRef}
          type="button"
          className={`control-button w-full p-4 rounded-lg ${
            activeDirection === "left" ? "bg-blue-600" : "bg-blue-500"
          } text-white shadow-lg hover:bg-blue-600 transition-colors`}
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* RIGHT */}
      <div className="col-start-3 row-start-2">
        <button
          ref={rightRef}
          type="button"
          className={`control-button w-full p-4 rounded-lg ${
            activeDirection === "right" ? "bg-blue-600" : "bg-blue-500"
          } text-white shadow-lg hover:bg-blue-600 transition-colors`}
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* DOWN */}
      <div className="col-start-2 row-start-3">
        <button
          ref={backwardRef}
          type="button"
          className={`control-button w-full p-4 rounded-lg ${
            activeDirection === "backward" ? "bg-blue-600" : "bg-blue-500"
          } text-white shadow-lg hover:bg-blue-600 transition-colors`}
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
