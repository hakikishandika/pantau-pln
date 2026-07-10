import Image from "next/image";

export function AppLogo({ size = 40 }: { size?: number }) {
  return (
    <Image
      src="/logo.png"
      alt="Logo Pantau Pemadaman PLN Banjarbaru"
      width={size}
      height={size}
      className="rounded-lg"
    />
  );
}
