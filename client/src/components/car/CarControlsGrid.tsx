import React from "react";
import CarControlButton from "./CarControlButton";
import { useMedia } from "../../media/MediaContext";

interface CarControlsGridProps {
  activeDirection: string;
  refs: {
    forwardRef: React.RefObject<HTMLButtonElement>;
    backwardRef: React.RefObject<HTMLButtonElement>;
    leftRef: React.RefObject<HTMLButtonElement>;
    rightRef: React.RefObject<HTMLButtonElement>;
  };
  onPress?: (dir: "forward" | "backward" | "left" | "right") => void;
  onRelease?: () => void;
}

const CarControlsGrid: React.FC<CarControlsGridProps> = ({
  activeDirection,
  refs,
  onPress,
  onRelease,
}) => {
  const media = useMedia() as any;
  const socket = media?.socket ?? null;

  const emitDir = (dir: string) => {
    if (socket) {
      socket.emit("vehicle:control", { action: dir });
    }
    if (onPress && dir !== "stop") onPress(dir as any);
    if (onRelease && dir === "stop") onRelease();
  };

  const handlePress = (dir: "forward" | "backward" | "left" | "right") => {
    emitDir(dir);
  };

  const handleRelease = () => {
    emitDir("stop");
  };

  return (
    <div className="grid w-full max-w-xs grid-cols-3 gap-2 mx-auto select-none car-controls">
      {/* forward */}
      <div className="col-start-2">
        <CarControlButton
          active={activeDirection === "forward"}
          innerRef={refs.forwardRef}
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
        </CarControlButton>
      </div>

      {/* left */}
      <div className="col-start-1 row-start-2">
        <CarControlButton
          active={activeDirection === "left"}
          innerRef={refs.leftRef}
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
        </CarControlButton>
      </div>

      {/* right */}
      <div className="col-start-3 row-start-2">
        <CarControlButton
          active={activeDirection === "right"}
          innerRef={refs.rightRef}
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
        </CarControlButton>
      </div>

      {/* backward */}
      <div className="col-start-2 row-start-3">
        <CarControlButton
          active={activeDirection === "backward"}
          innerRef={refs.backwardRef}
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
        </CarControlButton>
      </div>
    </div>
  );
};

export default CarControlsGrid;
