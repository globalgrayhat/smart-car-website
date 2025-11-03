// frontend/src/hooks/useCarControls.ts
// A tiny hook to manage car-direction UI state (forward/backward/left/right)
// It does NOT talk to the socket. Parent component should send the command.
// We only expose: activeDirection + refs + press/release handlers.

import { useState, useRef, useCallback, type RefObject } from "react";
import { gsap } from "gsap";

export type CarDirection = "forward" | "backward" | "left" | "right" | "";

type OnDirectionChange =
  | ((direction: string) => void)
  | React.Dispatch<React.SetStateAction<string>>
  | undefined;

export function useCarControls(onDirectionChange?: OnDirectionChange) {
  // which button is currently active (pressed)
  const [activeDirection, setActiveDirection] = useState<CarDirection>("");

  // refs for the four buttons, so we can animate them
  const forwardRef = useRef<HTMLButtonElement | null>(null);
  const backwardRef = useRef<HTMLButtonElement | null>(null);
  const leftRef = useRef<HTMLButtonElement | null>(null);
  const rightRef = useRef<HTMLButtonElement | null>(null);

  // map direction -> button ref
  const refs: Record<Exclude<CarDirection, "">, RefObject<HTMLButtonElement>> = {
    forward: forwardRef,
    backward: backwardRef,
    left: leftRef,
    right: rightRef,
  };

  // notify parent (Vehicles page / CameraPanel / whatever) so it can emit socket event
  const notifyParent = (value: string) => {
    if (!onDirectionChange) return;
    (onDirectionChange as React.Dispatch<React.SetStateAction<string>>)(value);
  };

  // called when user presses a direction button
  const handlePress = useCallback(
    (direction: Exclude<CarDirection, "">) => {
      setActiveDirection(direction);
      notifyParent(direction);

      // animate that specific button
      const btn = refs[direction].current;
      if (btn) {
        gsap.to(btn, {
          scale: 0.9,
          duration: 0.1,
          ease: "power1.out",
        });
      }
    },
    [refs, onDirectionChange],
  );

  // called when user releases / leaves the button
  const handleRelease = useCallback(() => {
    setActiveDirection("");
    notifyParent("");

    // restore all buttons scale
    const targets = [
      forwardRef.current,
      backwardRef.current,
      leftRef.current,
      rightRef.current,
    ].filter(Boolean) as HTMLButtonElement[];

    if (targets.length) {
      gsap.to(targets, {
        scale: 1,
        duration: 0.2,
        ease: "back.out(1.5)",
      });
    }
  }, [onDirectionChange]);

  return {
    activeDirection,
    forwardRef,
    backwardRef,
    leftRef,
    rightRef,
    handlePress,
    handleRelease,
  };
}
