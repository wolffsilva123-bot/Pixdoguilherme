interface MercadoPagoLogoProps {
  className?: string;
}

export function MercadoPagoLogo({
  className = "w-8 h-6",
}: MercadoPagoLogoProps) {
  return (
    <svg
      viewBox="0 0 64 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Signature Mercado Pago blue oval */}
      <ellipse
        cx="32"
        cy="22"
        rx="29"
        ry="19"
        fill="#009EE3"
        stroke="#FFFFFF"
        strokeWidth="2"
      />
      {/* Stylized handshake emblem */}
      <path
        d="M15.5 22.5c2.1-2.5 5.1-4.8 8.7-5.2 2.4-.2 4.3.6 5.9 1.7 1.1.8 2.4.8 3.6 0 1.6-1.1 3.5-1.9 5.9-1.7 3.6.4 6.6 2.7 8.7 5.2"
        stroke="#FFFFFF"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 24.5l4.4 4.1c1 .9 2.5.9 3.4-.1l.6-.6 2.2 2.1c1 .9 2.5.9 3.4-.1l.7-.7 1.4 1.3c.9.8 2.3.8 3.1-.1l3.1-3.4"
        stroke="#FFFFFF"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M27.2 20.6l4.6 4.2m3.8-4.2l-3.8 3.6"
        stroke="#FFFFFF"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
