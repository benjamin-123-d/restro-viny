import { getFoodCostPageContext } from "@/components/food-cost/page-context";
import { QuickPurchaseSection } from "@/components/food-cost/quick-purchase-section";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";

export const metadata = { title: "Achats — Food cost" };

export default async function FoodPurchasesPage() {
  const page = await getFoodCostPageContext();
  if (!page) {
    return (
      <div className="p-4 lg:p-6">
        <EmptyState title="Aucun restaurant" description="Demandez à un administrateur de créer votre restaurant." />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 lg:p-6">
      <PageHeader title="Achats" description="Les courses du jour, saisies en quelques secondes : le stock et le prix suivent." />
      <QuickPurchaseSection ctx={page.ctx} canEdit={page.canEdit} />
    </div>
  );
}
