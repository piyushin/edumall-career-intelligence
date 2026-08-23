import Image from "next/image";

export function BrandLogo({
  className = "h-auto w-[168px] sm:w-[190px]",
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/edumall-logo.png"
      alt="The EduMall"
      width={424}
      height={158}
      priority={priority}
      className={className}
    />
  );
}
