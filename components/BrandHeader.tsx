import Image from "next/image";
import Link from "next/link";

export function BrandHeader() {
  return (
    <header className="w-full border-b bg-white shadow-sm">
      <Link href="/" className="mx-auto flex h-24 max-w-7xl items-center justify-center px-4 sm:h-32">
        <Image
          src="/logo.png"
          alt="Quality One Care"
          width={420}
          height={120}
          priority
          className="h-[60px] w-auto object-contain sm:h-24 lg:h-28"
        />
        <span className="sr-only">Quality One Care</span>
      </Link>
    </header>
  );
}
