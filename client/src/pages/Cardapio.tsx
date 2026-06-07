import { trpc } from "@/lib/trpc";
import { Flame, Utensils, Beer, Wine, GlassWater, Coffee } from "lucide-react";

/**
 * Public Cardápio page - accessible without authentication.
 * Displays active products grouped by category with A Brasa Reúne branding.
 * Designed for mobile-first (QR code on tables).
 */
export default function Cardapio() {
  const { data, isLoading, error } = trpc.cardapio.getMenu.useQuery({ companyId: 2 });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1C1C1C] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Flame className="h-12 w-12 text-orange-500 animate-pulse" />
          <p className="text-amber-100/70 text-sm">Carregando cardápio...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#1C1C1C] flex items-center justify-center p-6">
        <div className="text-center">
          <Flame className="h-12 w-12 text-orange-500 mx-auto mb-4" />
          <p className="text-amber-100 text-lg font-semibold">Cardápio indisponível</p>
          <p className="text-amber-100/50 text-sm mt-2">Tente novamente em instantes.</p>
        </div>
      </div>
    );
  }

  // Sub-group bebidas into logical sections
  const bebidasCategory = data.categories.find(c => c.name === "BEBIIDAS");
  const otherCategories = data.categories.filter(c => c.name !== "BEBIIDAS");

  // Split bebidas into sub-sections
  const bebidasSections = bebidasCategory ? groupBebidas(bebidasCategory.items) : [];

  return (
    <div className="min-h-screen bg-[#1C1C1C]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#1C1C1C]/95 backdrop-blur-sm border-b border-orange-900/30">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-center gap-3">
          <Flame className="h-6 w-6 text-orange-500" />
          <h1 className="text-xl font-bold text-amber-100 tracking-wide">
            A BRASA REÚNE
          </h1>
          <Flame className="h-6 w-6 text-orange-500" />
        </div>
      </header>

      {/* Content */}
      <main className="max-w-lg mx-auto px-4 py-6 pb-20">
        {/* Tagline */}
        <div className="text-center mb-8">
          <p className="text-amber-100/60 text-sm italic">
            Burgers artesanais & drinks autorais
          </p>
        </div>

        {/* Non-bebidas categories (Burgers, Entradas) */}
        {otherCategories.map((cat) => (
          <CategorySection
            key={cat.id}
            title={cat.displayName}
            icon={getCategoryIcon(cat.name)}
            items={cat.items}
          />
        ))}

        {/* Bebidas sub-sections */}
        {bebidasSections.map((section) => (
          <CategorySection
            key={section.title}
            title={section.title}
            icon={section.icon}
            items={section.items}
          />
        ))}

        {/* Footer note */}
        <div className="mt-12 text-center border-t border-orange-900/20 pt-6">
          <p className="text-amber-100/40 text-xs">
            Taxa de serviço (10%) opcional.
          </p>
          <p className="text-amber-100/40 text-xs mt-1">
            Informe ao atendente caso não deseje incluir.
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <Flame className="h-4 w-4 text-orange-600/50" />
            <span className="text-orange-600/50 text-xs font-medium">ABRWF</span>
            <Flame className="h-4 w-4 text-orange-600/50" />
          </div>
        </div>
      </main>
    </div>
  );
}

/** Category section component */
function CategorySection({ title, icon, items }: {
  title: string;
  icon: React.ReactNode;
  items: Array<{ id: number; name: string; price: number | null; description: string | null }>;
}) {
  return (
    <section className="mb-8">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="text-orange-500">{icon}</div>
        <h2 className="text-lg font-bold text-amber-100 uppercase tracking-wider">
          {title}
        </h2>
        <div className="flex-1 h-px bg-gradient-to-r from-orange-900/40 to-transparent ml-2" />
      </div>

      {/* Items */}
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-baseline justify-between gap-2">
            <div className="flex-1 min-w-0">
              <span className="text-amber-100/90 text-sm font-medium">
                {item.name}
              </span>
              {item.description && (
                <p className="text-amber-100/40 text-xs mt-0.5">{item.description}</p>
              )}
            </div>
            <div className="flex-shrink-0 flex items-baseline gap-0.5">
              {item.price !== null ? (
                <>
                  <span className="text-amber-100/40 text-xs">R$</span>
                  <span className="text-orange-400 font-bold text-sm">
                    {item.price.toFixed(2).replace('.', ',')}
                  </span>
                </>
              ) : (
                <span className="text-amber-100/30 text-xs italic">consulte</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Get icon for category */
function getCategoryIcon(catName: string): React.ReactNode {
  switch (catName) {
    case 'BURGERS': return <Flame className="h-5 w-5" />;
    case 'ENTRADAS E ACOMPANHAMENTOS': return <Utensils className="h-5 w-5" />;
    default: return <Utensils className="h-5 w-5" />;
  }
}

/** Group bebidas into logical sub-sections */
function groupBebidas(items: Array<{ id: number; name: string; price: number | null; description: string | null }>) {
  const sections: Array<{
    title: string;
    icon: React.ReactNode;
    items: typeof items;
  }> = [];

  const cervejas: typeof items = [];
  const drinks: typeof items = [];
  const sucos: typeof items = [];
  const aguasRefri: typeof items = [];

  for (const item of items) {
    const nameUpper = item.name.toUpperCase();
    if (
      nameUpper.includes('HEINEKEN') ||
      nameUpper.includes('CORONA') ||
      nameUpper.includes('ORIGINAL 6') ||
      nameUpper.includes('SPATEN') ||
      nameUpper.includes('LAGUNITAS') ||
      nameUpper.includes('BLUE MOON') ||
      nameUpper.includes('STELLA') ||
      nameUpper.includes('CERVEJA')
    ) {
      cervejas.push(item);
    } else if (
      nameUpper.includes('SUCO')
    ) {
      sucos.push(item);
    } else if (
      ((nameUpper.includes('AGUA') || nameUpper.includes('ÁGUA')) && !nameUpper.includes('TONICA') && !nameUpper.includes('TÔNICA')) ||
      nameUpper.includes('COCA') ||
      nameUpper.includes('GUARANA') ||
      nameUpper.includes('GUARANÁ')
    ) {
      aguasRefri.push(item);
    } else {
      // Drinks: Negroni, Aperol Spritz, Gin Tônica, Caipirinha, Caipiroska, Agua Tonica, etc.
      drinks.push(item);
    }
  }

  if (cervejas.length > 0) {
    sections.push({ title: "Cervejas", icon: <Beer className="h-5 w-5" />, items: cervejas });
  }
  if (drinks.length > 0) {
    sections.push({ title: "Drinks", icon: <Wine className="h-5 w-5" />, items: drinks });
  }
  if (sucos.length > 0) {
    sections.push({ title: "Sucos", icon: <Coffee className="h-5 w-5" />, items: sucos });
  }
  if (aguasRefri.length > 0) {
    sections.push({ title: "Águas & Refrigerantes", icon: <GlassWater className="h-5 w-5" />, items: aguasRefri });
  }

  return sections;
}
