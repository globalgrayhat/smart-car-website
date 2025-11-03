import React from "react";

interface VehicleStartPromptProps {
  visible: boolean;
  countdown: number | null;
  onCancel: () => void;
}

const VehicleStartPrompt: React.FC<VehicleStartPromptProps> = ({
  visible,
  countdown,
  onCancel,
}) => {
  if (!visible) return null;
  return (
    <div className="flex items-center justify-between gap-3 p-4 border rounded-md bg-amber-500/10 border-amber-400/50">
      <div>
        <p className="text-sm font-medium text-amber-50">
          راح يطلب صلاحية الكاميرا والمايك.
        </p>
        <p className="text-xs text-amber-200">
          التشغيل بعد {countdown ?? 0}s ...
        </p>
      </div>
      <button
        onClick={onCancel}
        className="px-3 py-1 text-xs text-white rounded-md bg-amber-500/80"
      >
        إلغاء
      </button>
    </div>
  );
};

export default VehicleStartPrompt;
