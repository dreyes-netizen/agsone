import { SVGProps } from "react";

export function WhistleIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Mouthpiece */}
      <path d="M2 11.5h5v2H2z" />
      {/* Body */}
      <path d="M7 9h10a3.5 3.5 0 0 1 0 7H7V9z" />
      {/* Windway slot on top */}
      <line x1="9" y1="9" x2="13" y2="9" />
      {/* Cord ring */}
      <circle cx="16.5" cy="6.5" r="1.5" />
      <line x1="16.5" y1="8" x2="16.5" y2="9" />
    </svg>
  );
}
