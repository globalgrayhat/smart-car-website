import React from "react";

interface CarControlButtonProps {
  active: boolean;
  innerRef: React.RefObject<HTMLButtonElement>;
  onPointerDown: () => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  children: React.ReactNode;
}

const CarControlButton: React.FC<CarControlButtonProps> = ({
  active,
  innerRef,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  children,
}) => {
  return (
    <button
      ref={innerRef}
      type="button"
      className={`control-button w-full p-4 rounded-lg ${
        active ? "bg-blue-600" : "bg-blue-500"
      } text-white shadow-lg hover:bg-blue-600 transition-colors`}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
    >
      {children}
    </button>
  );
};

export default CarControlButton;
