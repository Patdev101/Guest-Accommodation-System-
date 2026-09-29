import type { SVGAttributes } from 'react';

// Anchor mark, as on the Mindoro Marine documents. Stroke-only, so callers'
// fill utilities are overridden.
export default function AppLogoIcon(props: SVGAttributes<SVGElement>) {
    return (
        <svg
            {...props}
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ ...props.style, fill: 'none' }}
        >
            <circle cx="12" cy="5" r="2.5" />
            <path d="M12 7.5V21M5 12H3a9 9 0 0 0 18 0h-2M8 11h8" />
        </svg>
    );
}
