import React from "react";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

const Header: React.FC<HeaderProps> = ({ title, subtitle }) => {
  // trigger custom event so mobile sidebar can open/close
  const handleMenuClick = () => {
    // Sidebar listens to this event name
    window.dispatchEvent(new CustomEvent("sidebar:toggle"));
  };

  return (
    <header className="sticky top-0 z-30 bg-slate-950/70 backdrop-blur border-b border-slate-800">
      <div className="flex items-center justify-between px-4 md:px-6 py-3 gap-3">
        {/* left block: mobile burger + titles */}
        <div className="flex items-center gap-3">
          {/* burger button (visible on mobile only) */}
          <button
            className="md:hidden p-2 rounded-md bg-slate-800 text-white hover:bg-slate-700"
            onClick={handleMenuClick}
            aria-label="فتح القائمة"
            type="button"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              stroke="currentColor"
              fill="none"
            >
              <path
                d="M4 6h16M4 12h16M4 18h16"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>

          <div>
            <h1 className="text-lg md:text-xl font-semibold text-white">
              {title}
            </h1>
            {subtitle ? (
              <p className="text-xs md:text-sm text-slate-400">{subtitle}</p>
            ) : null}
          </div>
        </div>

        {/* right block: reserved for future actions (notifications, profile, etc.) */}
        <div className="flex items-center gap-2">
          {/* actions can be added here later */}
        </div>
      </div>
    </header>
  );
};

export default Header;
