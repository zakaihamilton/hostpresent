function Icon({ title, size = 20, children }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <title>{title}</title>
      {children}
    </svg>
  );
}

export function Logo() {
  return (
    <Icon title="Host Present logo" size={24}>
      <path d="M2 12h20" />
      <path d="M12 2v20" />
      <path d="m4.93 4.93 14.14 14.14" />
      <path d="m19.07 4.93-14.14 14.14" />
    </Icon>
  );
}

export function Mic() {
  return (
    <Icon title="Microphone">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </Icon>
  );
}

export function MicOff() {
  return (
    <Icon title="Microphone off">
      <line x1="2" x2="22" y1="2" y2="22" />
      <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
      <path d="M5 10v2a7 7 0 0 0 12 5" />
      <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </Icon>
  );
}

export function Video() {
  return (
    <Icon title="Camera">
      <path d="m22 8-6 4 6 4V8Z" />
      <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
    </Icon>
  );
}

export function VideoOff() {
  return (
    <Icon title="Camera off">
      <path d="M10.66 6H14a2 2 0 0 1 2 2v2.34l1 1L22 8v8" />
      <path d="M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2l10 10Z" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </Icon>
  );
}

export function ScreenShare() {
  return (
    <Icon title="Screen share">
      <path d="M4 8V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4" />
      <path d="M4 16v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
      <path d="M12 11v10" />
      <path d="m8 14 4-3 4 3" />
    </Icon>
  );
}

export function Record() {
  return (
    <Icon title="Record">
      <circle cx="12" cy="12" r="8" />
    </Icon>
  );
}

export function Pause() {
  return (
    <Icon title="Pause">
      <rect width="4" height="16" x="6" y="4" />
      <rect width="4" height="16" x="14" y="4" />
    </Icon>
  );
}

export function Play() {
  return (
    <Icon title="Play">
      <polygon points="5 3 19 12 5 21 5 3" />
    </Icon>
  );
}

export function Stop() {
  return (
    <Icon title="Stop">
      <rect width="12" height="12" x="6" y="6" rx="1" />
    </Icon>
  );
}

export function Users() {
  return (
    <Icon title="Participants">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Icon>
  );
}

export function Gallery() {
  return (
    <Icon title="Video gallery">
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
    </Icon>
  );
}
