import React from "react";

interface CameraMobileBarProps {
  isMobile: boolean;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

const CameraMobileBar: React.FC<CameraMobileBarProps> = ({
  isMobile,
  zoom,
  onZoomIn,
  onZoomOut,
}) => {
  if (!isMobile) return null;
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 bg-black/30 backdrop-blur-sm">
      <span className="text-xs text-white/60">Zoom: {(zoom * 100).toFixed(0)}%</span>
      <div className="flex gap-2">
        <button
          onClick={onZoomOut}
          className="flex items-center justify-center w-8 h-8 text-sm text-white rounded-full bg-white/10"
        >
          -
        </button>
        <button
          onClick={onZoomIn}
          className="flex items-center justify-center w-8 h-8 text-sm text-white rounded-full bg-white/10"
        >
          +
        </button>
      </div>
    </div>
  );
};

export default CameraMobileBar;
