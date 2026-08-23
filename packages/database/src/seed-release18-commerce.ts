import { CommerceProductKind, CommerceProductStatus, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const products = [
    {
      code: "CAREER_REPORT",
      name: "Detailed Career Intelligence Report",
      description:
        "Detailed Career Intelligence report with governed assessment interpretation and CareerFit directions.",
      kind: CommerceProductKind.REPORT,
      currency: "INR",
      priceMinor: 69000,
    },
    {
      code: "CAREER_REPORT_COUNSELLING",
      name: "Career Intelligence Report + Expert Counselling",
      description: "Detailed Career Intelligence report plus one expert counselling entitlement.",
      kind: CommerceProductKind.REPORT_AND_COUNSELLING,
      currency: "INR",
      priceMinor: 149000,
    },
  ];

  for (const product of products) {
    await prisma.commerceProduct.upsert({
      where: { code: product.code },
      create: {
        ...product,
        status: CommerceProductStatus.ACTIVE,
        metadata: {
          release: "18",
          source: "THE_EDUMALL_DEFAULT",
        },
      },
      update: {
        name: product.name,
        description: product.description,
        kind: product.kind,
        currency: product.currency,
        priceMinor: product.priceMinor,
        status: CommerceProductStatus.ACTIVE,
      },
    });
  }

  console.log("Release 18 default commerce products: READY");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
