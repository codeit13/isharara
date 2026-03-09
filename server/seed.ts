import { db } from "./db";
import { products, productSizes, reviews, promotions, users, tenants, tenantMembers } from "@shared/schema";
import { sql, eq, and } from "drizzle-orm";
import { authStorage } from "./auth/storage";

export async function seedDatabase() {
  const existingProducts = await db.select().from(products);
  if (existingProducts.length > 0) {
    await ensureDemoUser();
    await ensureB2G1PromoDescription();
    await ensureFirstOrderPromo();
    return;
  }

  console.log("Seeding database with initial data...");

  const seedProducts = [
    {
      name: "Velvet Rose",
      brand: "ISHQARA",
      description: "A romantic, velvety blend of Turkish rose and soft musk. This enchanting fragrance opens with dewy rose petals, transitions into warm jasmine, and settles into a creamy sandalwood base. Perfect for date nights and special occasions.",
      category: "Floral",
      notes: ["Turkish Rose", "Jasmine", "Sandalwood", "Musk"],
      image: "/images/perfume-1.png",
      isBestseller: true,
      isTrending: true,
      isNewArrival: false,
      gender: "women",
      avgRating: "4.8",
      reviewCount: 47,
    },
    {
      name: "Golden Oud",
      brand: "ISHQARA",
      description: "Rich, warm, and utterly captivating. Golden Oud combines premium Cambodian oud with amber and vanilla for a scent that commands attention. A sophisticated fragrance that lasts all day and turns heads wherever you go.",
      category: "Oriental",
      notes: ["Oud", "Amber", "Vanilla", "Saffron"],
      image: "/images/perfume-2.png",
      isBestseller: true,
      isTrending: false,
      isNewArrival: false,
      gender: "unisex",
      avgRating: "4.7",
      reviewCount: 63,
    },
    {
      name: "Lavender Dreams",
      brand: "ISHQARA",
      description: "Calming yet sophisticated. French lavender meets bergamot and white tea in this modern take on a classic note. Lightweight and versatile, perfect for everyday wear that keeps you feeling fresh and confident.",
      category: "Fresh",
      notes: ["Lavender", "Bergamot", "White Tea", "Cedar"],
      image: "/images/perfume-3.png",
      isBestseller: false,
      isTrending: true,
      isNewArrival: true,
      gender: "unisex",
      avgRating: "4.5",
      reviewCount: 28,
    },
    {
      name: "Midnight Blue",
      brand: "ISHQARA",
      description: "Bold and mysterious. A striking blend of marine accord, black pepper, and vetiver creates a scent that's both refreshing and deeply masculine. The go-to fragrance for men who want to make a statement.",
      category: "Woody",
      notes: ["Marine Accord", "Black Pepper", "Vetiver", "Leather"],
      image: "/images/perfume-4.png",
      isBestseller: false,
      isTrending: true,
      isNewArrival: false,
      gender: "men",
      avgRating: "4.6",
      reviewCount: 35,
    },
    {
      name: "Amber Elixir",
      brand: "ISHQARA",
      description: "Warm, sweet, and irresistible. This luxurious elixir weaves together rich amber, tonka bean, and a hint of dark chocolate. An evening fragrance that wraps you in warmth and sophistication.",
      category: "Oriental",
      notes: ["Amber", "Tonka Bean", "Dark Chocolate", "Benzoin"],
      image: "/images/perfume-5.png",
      isBestseller: true,
      isTrending: false,
      isNewArrival: false,
      gender: "unisex",
      avgRating: "4.9",
      reviewCount: 72,
    },
    {
      name: "Citrus Garden",
      brand: "ISHQARA",
      description: "Bright, zesty, and uplifting. Italian lemon and grapefruit dance with green tea and white musk for a fragrance that's as refreshing as a morning breeze. Your perfect everyday companion.",
      category: "Citrus",
      notes: ["Lemon", "Grapefruit", "Green Tea", "White Musk"],
      image: "/images/perfume-6.png",
      isBestseller: false,
      isTrending: false,
      isNewArrival: true,
      gender: "unisex",
      avgRating: "4.3",
      reviewCount: 19,
    },
    {
      name: "Pink Peony",
      brand: "ISHQARA",
      description: "Feminine, fresh, and utterly delightful. Lush peony petals are complemented by sweet peach and a whisper of raspberry. A youthful, playful scent perfect for the modern woman who loves life.",
      category: "Floral",
      notes: ["Peony", "Peach", "Raspberry", "Lily"],
      image: "/images/perfume-7.png",
      isBestseller: false,
      isTrending: true,
      isNewArrival: true,
      gender: "women",
      avgRating: "4.4",
      reviewCount: 31,
    },
    {
      name: "Royal Saffron",
      brand: "ISHQARA",
      description: "Opulent and regal. Precious saffron threads meet Bulgarian rose and smoky oud in this masterpiece of perfumery. A truly special scent for those who appreciate the finer things in life.",
      category: "Oriental",
      notes: ["Saffron", "Bulgarian Rose", "Oud", "Patchouli"],
      image: "/images/perfume-8.png",
      isBestseller: true,
      isTrending: false,
      isNewArrival: false,
      gender: "unisex",
      avgRating: "4.8",
      reviewCount: 54,
    },
  ];

  for (const product of seedProducts) {
    const [created] = await db.insert(products).values(product).returning();

    const basePrices: Record<string, { s50: number; s100: number }> = {
      "Velvet Rose": { s50: 499, s100: 799 },
      "Golden Oud": { s50: 499, s100: 799 },
      "Lavender Dreams": { s50: 499, s100: 799 },
      "Midnight Blue": { s50: 499, s100: 799 },
      "Amber Elixir": { s50: 499, s100: 799 },
      "Citrus Garden": { s50: 499, s100: 799 },
      "Pink Peony": { s50: 499, s100: 799 },
      "Royal Saffron": { s50: 499, s100: 799 },
    };

    const prices = basePrices[product.name] || { s50: 499, s100: 799 };
    const hasDiscount = ["Velvet Rose", "Golden Oud", "Amber Elixir"].includes(product.name);

    await db.insert(productSizes).values([
      {
        productId: created.id,
        size: "50ml",
        price: prices.s50,
        originalPrice: hasDiscount ? Math.round(prices.s50 * 1.15) : null,
        stock: 30,
      },
      {
        productId: created.id,
        size: "100ml",
        price: prices.s100,
        originalPrice: hasDiscount ? Math.round(prices.s100 * 1.1) : null,
        stock: 20,
      },
    ]);
  }

  const allProducts = await db.select().from(products);
  const sampleReviews = [
    { name: "Priya S.", rating: 5, comment: "Absolutely love this fragrance! It lasts all day and I get compliments every time I wear it. Best purchase I've made in a while." },
    { name: "Arjun M.", rating: 4, comment: "Great scent, very premium feel. Projection is good for the first 4-5 hours. Packaging was beautiful too." },
    { name: "Meera K.", rating: 5, comment: "This is my third bottle! The fragrance is divine and perfect for Indian weather. Highly recommend ISHQARA." },
    { name: "Rahul D.", rating: 4, comment: "Excellent quality for the price. Smells luxurious and sophisticated. Will definitely buy more from this brand." },
    { name: "Ananya P.", rating: 5, comment: "Gifted this to my mom and she absolutely loved it. The packaging is so premium, perfect for gifting!" },
  ];

  for (const product of allProducts) {
    const reviewCount = Math.min(sampleReviews.length, Math.floor(Math.random() * 3) + 2);
    for (let i = 0; i < reviewCount; i++) {
      const r = sampleReviews[i];
      await db.insert(reviews).values({
        productId: product.id,
        customerName: r.name,
        rating: r.rating,
        comment: r.comment,
      });
    }
    const productReviews = await db.select().from(reviews).where(sql`${reviews.productId} = ${product.id}`);
    const avgRating = productReviews.reduce((s, r) => s + r.rating, 0) / productReviews.length;
    await db.update(products).set({
      avgRating: avgRating.toFixed(1),
      reviewCount: productReviews.length,
    }).where(sql`${products.id} = ${product.id}`);
  }

  await db.insert(promotions).values([
    {
      title: "First Order Discount",
      description: "Get 10% off on your first order",
      discountType: "percentage",
      discountValue: 10,
      code: "FIRST10",
      isActive: true,
      firstOrderOnly: true,
    },
    {
      title: "Buy 2 Get 1 Free",
      description: "Buy 2 Get 1 Free",
      discountType: "bundle",
      discountValue: 100,
      code: "B2G1",
      isActive: true,
    },
    {
      title: "Summer Sale",
      description: "Flat Rs. 200 off on orders above Rs. 1999",
      discountType: "flat",
      discountValue: 200,
      code: "SUMMER200",
      isActive: true,
    },
  ]);

  await ensureDemoUser();
  await ensureAdminUser();
  await ensureB2G1PromoDescription();
  console.log("Database seeded successfully!");
}

async function ensureB2G1PromoDescription() {
  const [b2g1] = await db.select().from(promotions).where(eq(promotions.code, "B2G1"));
  if (b2g1 && b2g1.description !== "Buy 2 Get 1 Free") {
    await db.update(promotions).set({ title: "Buy 2 Get 1 Free", description: "Buy 2 Get 1 Free" }).where(eq(promotions.code, "B2G1"));
  }
}

async function ensureFirstOrderPromo() {
  const [first10] = await db.select().from(promotions).where(eq(promotions.code, "FIRST10"));
  if (first10 && !(first10 as { firstOrderOnly?: boolean }).firstOrderOnly) {
    await db.update(promotions).set({ firstOrderOnly: true } as any).where(eq(promotions.code, "FIRST10"));
  }
}

async function ensureAdminUser() {
  const adminEmail = "admin@example.com";
  const [existing] = await db.select().from(users).where(eq(users.email, adminEmail));
  if (existing) {
    if (!existing.isSuperAdmin) {
      await db.update(users).set({ isSuperAdmin: true }).where(eq(users.id, existing.id));
    }
    // Ensure tenant membership
    const [hasMember] = await db.select().from(tenantMembers).where(and(eq(tenantMembers.tenantId, 1), eq(tenantMembers.userId, existing.id)));
    if (!hasMember) {
      await db.insert(tenantMembers).values({ tenantId: 1, userId: existing.id, role: "owner" });
    }
    return;
  }
  const user = await authStorage.createUser({
    email: adminEmail,
    password: "admin123",
    firstName: "Admin",
    lastName: "User",
  });
  await db.update(users).set({ isSuperAdmin: true }).where(eq(users.id, user.id));
  await db.insert(tenantMembers).values({ tenantId: 1, userId: user.id, role: "owner" });
}

async function ensureDemoUser() {
  const [existing] = await db.select().from(users).where(eq(users.id, "demo"));
  if (existing) return;
  await db.insert(users).values({
    id: "demo",
    email: "demo@example.com",
    firstName: "Demo",
    lastName: "User",
    provider: "email",
    isSuperAdmin: true,
  });
  await db.insert(tenantMembers).values({ tenantId: 1, userId: "demo", role: "owner" }).onConflictDoNothing();
}

/**
 * One-time migration: seed the default tenant, promote existing admins to
 * tenant_members with 'owner' role, and mark them as isSuperAdmin.
 */
export async function migrateMultiTenant() {
  // 1. Ensure the default tenant exists (id = 1, slug = "ishqara")
  const [existing] = await db.select().from(tenants).where(eq(tenants.slug, "ishqara"));
  if (!existing) {
    await db.insert(tenants).values({
      id: 1,
      name: "ISHQARA",
      slug: "ishqara",
      domain: "ishqara.com",
      supportEmail: "ishqaraperfumes@gmail.com",
      supportPhone: "+91 98679 02305",
      isActive: true,
    }).onConflictDoNothing();
    console.log("[multi-tenant] Default tenant 'ishqara' created.");
  }

  // 2. Ensure super-admin users are in tenant_members for default tenant
  const superAdmins = await db.select().from(users).where(eq(users.isSuperAdmin, true));
  for (const admin of superAdmins) {
    const [memberExists] = await db
      .select()
      .from(tenantMembers)
      .where(and(eq(tenantMembers.tenantId, 1), eq(tenantMembers.userId, admin.id)));
    if (!memberExists) {
      await db.insert(tenantMembers).values({
        tenantId: 1,
        userId: admin.id,
        role: "owner",
      });
      console.log(`[multi-tenant] Added super-admin ${admin.email ?? admin.id} → tenant_members (owner)`);
    }
  }
}
