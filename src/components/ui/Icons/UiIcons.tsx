import { Icon, type IconProps } from "./IconBase";

export function ChevronDown({ size = 20, className }: IconProps = {}) {
  return (
    <Icon title="Open menu" size={size} className={className}>
      <path d="m6 9 6 6 6-6" />
    </Icon>
  );
}

export function ArrowLeft({ size = 20, className }: IconProps = {}) {
  return (
    <Icon title="Back" size={size} className={className}>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </Icon>
  );
}

export function Link({ size = 20, className }: IconProps = {}) {
  return (
    <Icon title="Link" size={size} className={className}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </Icon>
  );
}

export function X({ size = 20, className }: IconProps = {}) {
  return (
    <Icon title="Close" size={size} className={className}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </Icon>
  );
}

export function Sun({ size = 20, className }: IconProps = {}) {
  return (
    <Icon title="Light mode" size={size} className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </Icon>
  );
}

export function Moon({ size = 20, className }: IconProps = {}) {
  return (
    <Icon title="Dark mode" size={size} className={className}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </Icon>
  );
}

export function Edit({ size = 16, className }: IconProps = {}) {
  return (
    <Icon title="Rename" size={size} className={className}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </Icon>
  );
}

export function Chat({ size = 20, className }: IconProps = {}) {
  return (
    <Icon title="Chat" size={size} className={className}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </Icon>
  );
}

export function Send({ size = 20, className }: IconProps = {}) {
  return (
    <Icon title="Send" size={size} className={className}>
      <line x1="22" x2="11" y1="2" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </Icon>
  );
}

export function Users({ size = 20, className }: IconProps = {}) {
  return (
    <Icon title="Participants" size={size} className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Icon>
  );
}

export function UserCircle({ size = 20, className }: IconProps = {}) {
  return (
    <Icon title="Display name" size={size} className={className}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="10" r="3" />
      <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662" />
    </Icon>
  );
}

export function Download({ size = 20, className }: IconProps = {}) {
  return (
    <Icon title="Download" size={size} className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </Icon>
  );
}

export function Refresh({ size = 20, className }: IconProps = {}) {
  return (
    <Icon title="Reconnect" size={size} className={className}>
      <path d="M23 4v6h-6" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </Icon>
  );
}
