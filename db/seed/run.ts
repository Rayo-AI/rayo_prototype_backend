// db/seed/run.ts
import { db } from "../index.ts";
import { categoriesTable } from "../schema/categories.ts";
import { SYSTEM_CATEGORIES } from "./category.ts";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("Seeding system categories...");

  for (const cat of SYSTEM_CATEGORIES) {
    const existing = await db
      .select()
      .from(categoriesTable)
      .where(eq(categoriesTable.slug, cat.slug))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  ✓ Already exists: ${cat.slug}`);
      continue;
    }

    await db.insert(categoriesTable).values({
      userId: null,       // system categories have no owner
      name: cat.name,
      slug: cat.slug,
      parentSlug: cat.parentSlug,
      emoji: cat.emoji,
      isSystem: true,
    });

    console.log(`  + Seeded: ${cat.slug}`);
  }

  console.log("Done.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});