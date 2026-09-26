import { KioskHydrator } from "@/components/KioskHydrator";
import { Shop } from "@/components/shop/Shop";
import { repo } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const items = await repo.listShopItems();
  return (
    <>
      <KioskHydrator />
      <Shop initialItems={items} />
    </>
  );
}
