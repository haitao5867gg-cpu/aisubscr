import { AdminCouponForm } from "@/components/AdminCouponForm";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminCouponsPage() {
  const t = getDict(await getLocale());
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <div className="stack">
      <h1 className="page-title">{t.admin.coupons}</h1>
      <p className="page-desc">{t.admin.couponLead}</p>
      <AdminCouponForm
        coupons={coupons.map((coupon) => ({
          id: coupon.id,
          code: coupon.code,
          kind: coupon.kind,
          percentOff: coupon.percentOff,
          amountCents: coupon.amountCents,
          minOrderCents: coupon.minOrderCents,
          startsAt: coupon.startsAt?.toISOString() ?? null,
          endsAt: coupon.endsAt?.toISOString() ?? null,
          maxUses: coupon.maxUses,
          maxUsesPerUser: coupon.maxUsesPerUser,
          usedCount: coupon.usedCount,
          active: coupon.active,
          updatedAt: coupon.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}
