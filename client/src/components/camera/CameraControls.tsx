import React from "react";
import {
  IconMinus,
  IconPlus,
  IconReset,
  IconShare,
  IconMax,
  IconMin,
} from "./CameraIcons";

interface CameraControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onShare: () => void;
  onFullscreen: () => void;
  isFullscreen: boolean;
}

const CameraControls: React.FC<CameraControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onReset,
  onShare,
  onFullscreen,
  isFullscreen,
}) => {
  return (
    <div className="absolute z-20 flex items-center gap-2 top-3 right-3">
      <button
        type="button"
        className="p-2 text-white transition-colors rounded-md bg-white/10 hover:bg-white/20"
        onClick={onZoomOut}
        aria-label="تصغير"
      >
        <IconMinus />
      </button>
      <button
        type="button"
        className="p-2 text-white transition-colors rounded-md bg-white/10 hover:bg-white/20"
        onClick={onZoomIn}
        aria-label="تكبير"
      >
        <IconPlus />
      </button>
      <button
        type="button"
        className="p-2 text-white transition-colors rounded-md bg-white/10 hover:bg-white/20"
        onClick={onReset}
        aria-label="إعادة الضبط"
      >
        <IconReset />
      </button>
      <button
        type="button"
        className="p-2 text-white transition-colors rounded-md bg-white/10 hover:bg-white/20"
        onClick={onShare}
        aria-label="مشاركة الشاشة"
      >
        <IconShare />
      </button>
      <button
        type="button"
        className="p-2 text-white transition-colors rounded-md bg-white/10 hover:bg-white/20"
        onClick={onFullscreen}
        aria-label="ملء الشاشة"
      >
        {isFullscreen ? <IconMin /> : <IconMax />}
      </button>
    </div>
  );
};

export default CameraControls;
