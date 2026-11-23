import { Icon, type IconProps } from "./IconBase";

export function Mic({ size = 20, className }: IconProps = {}) {
  return (
    <Icon title="Microphone" size={size} className={className}>
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </Icon>
  );
}

export function MicOff({ size = 20, className }: IconProps = {}) {
  return (
    <Icon title="Microphone off" size={size} className={className}>
      <line x1="2" x2="22" y1="2" y2="22" />
      <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
      <path d="M5 10v2a7 7 0 0 0 12 5" />
      <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </Icon>
  );
}

export function Video({ size = 20, className }: IconProps = {}) {
  return (
    <Icon title="Camera" size={size} className={className}>
      <path d="m22 8-6 4 6 4V8Z" />
      <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
    </Icon>
  );
}

export function VideoOff({ size = 20, className }: IconProps = {}) {
  return (
    <Icon title="Camera off" size={size} className={className}>
      <path d="M10.66 6H14a2 2 0 0 1 2 2v2.34l1 1L22 8v8" />
      <path d="M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2l10 10Z" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </Icon>
  );
}

export function ScreenShare({ size = 20, className }: IconProps = {}) {
  return (
    <Icon title="Screen share" size={size} className={className}>
      <path d="M4 8V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4" />
      <path d="M4 16v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
      <path d="M12 11v10" />
      <path d="m8 14 4-3 4 3" />
    </Icon>
  );
}

export function Pause({ size = 20, className }: IconProps = {}) {
  return (
    <Icon title="Pause" size={size} className={className}>
      <rect width="4" height="16" x="6" y="4" />
      <rect width="4" height="16" x="14" y="4" />
    </Icon>
  );
}

export function Play({ size = 20, className }: IconProps = {}) {
  return (
    <Icon title="Play" size={size} className={className}>
      <polygon points="5 3 19 12 5 21 5 3" />
    </Icon>
  );
}

export function Stop({ size = 20, className }: IconProps = {}) {
  return (
    <Icon title="Stop" size={size} className={className}>
      <rect width="12" height="12" x="6" y="6" rx="1" />
    </Icon>
  );
}

export function Gallery({ size = 20, className }: IconProps = {}) {
  return (
    <Icon title="Video gallery" size={size} className={className}>
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
    </Icon>
  );
}

export function Pip({ size = 20, className }: IconProps = {}) {
  return (
    <Icon title="Self-view" size={size} className={className}>
      {/* Main outer screen (stroke only) */}
      <rect
        width="16"
        height="12"
        x="4"
        y="6"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      {/* Inner PiP window (solid fill) */}
      <rect width="7" height="5" x="12" y="12" rx="1" fill="currentColor" />
    </Icon>
  );
}

export function Focus({ size = 20, className }: IconProps = {}) {
  return (
    <Icon title="Focus" size={size} className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
    </Icon>
  );
}
