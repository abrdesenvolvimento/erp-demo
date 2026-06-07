import { trpc } from "@/lib/trpc";
import { Flame } from "lucide-react";

/**
 * Public Cardápio page - accessible without authentication.
 * Displays active products grouped by category with A Brasa Reúne branding.
 * Layout matches the PDF reference: cream background, orange accents,
 * two-column beverage sections, dotted leaders, diamond separators.
 * Designed for mobile-first (QR code on tables).
 */
export default function Cardapio() {
  const { data, isLoading, error } = trpc.cardapio.getMenu.useQuery({ companyId: 2 });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAF5EF] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Flame className="h-12 w-12 text-[#E87A2F] animate-pulse" />
          <p className="text-[#4A3728]/60 text-sm">Carregando cardápio...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#FAF5EF] flex items-center justify-center p-6">
        <div className="text-center">
          <Flame className="h-12 w-12 text-[#E87A2F] mx-auto mb-4" />
          <p className="text-[#4A3728] text-lg font-semibold">Cardápio indisponível</p>
          <p className="text-[#4A3728]/50 text-sm mt-2">Tente novamente em instantes.</p>
        </div>
      </div>
    );
  }

  // Sub-group bebidas into logical sections
  const bebidasCategory = data.categories.find(c => c.name === "BEBIIDAS");
  const otherCategories = data.categories.filter(c => c.name !== "BEBIIDAS");

  // Split bebidas into sub-sections
  const bebidasSections = bebidasCategory ? groupBebidas(bebidasCategory.items) : [];

  // Reorder: Entradas, Burgers first, then Sucos, Águas, Cervejas, Drinks
  const orderedSections = reorderSections(bebidasSections);

  return (
    <div className="min-h-screen bg-[#FAF5EF]">
      {/* Header */}
      <header className="pt-8 pb-4">
        <div className="max-w-2xl mx-auto px-6 flex flex-col items-center">
          {/* Logo */}
          <img
            src="/manus-storage/logo-abrasa-circle_54a46a8b.png"
            alt="A Brasa Reúne"
            className="w-28 h-28 md:w-32 md:h-32 mb-4 mx-auto drop-shadow-lg"
          />
          <h1 className="text-2xl md:text-3xl font-bold text-[#2C2C2C] tracking-[0.2em] uppercase">
            A Brasa Reúne
          </h1>
          <p className="text-[#4A3728]/60 text-xs tracking-[0.3em] uppercase mt-1">
            Bar & Hamburgueria
          </p>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-6 py-6 pb-20">

        {/* Non-bebidas categories (Entradas, Burgers) */}
        {otherCategories.map((cat) => (
          <LightSection
            key={cat.id}
            title={cat.displayName}
            items={cat.items}
            twoColumns={false}
          />
        ))}

        {/* Bebidas sub-sections */}
        {orderedSections.map((section) => (
          section.dark ? (
            <DarkSection
              key={section.title}
              title={section.title}
              items={section.items}
              twoColumns={section.twoColumns}
            />
          ) : (
            <LightSection
              key={section.title}
              title={section.title}
              items={section.items}
              twoColumns={section.twoColumns}
            />
          )
        ))}

        {/* Footer */}
        <div className="mt-12 text-center pt-6">
          <p className="text-[#4A3728]/50 text-xs">
            Taxa de serviço (10%) opcional.
          </p>
          <p className="text-[#4A3728]/50 text-xs mt-1">
            Informe ao atendente caso não deseje incluir.
          </p>
          <div className="flex items-center justify-center gap-2 mt-6">
            <span className="text-[#4A3728]/40 text-xs tracking-[0.2em] uppercase">
              A Brasa Reúne — Bar & Hamburgueria
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}

/** Diamond separator between sections */
function DiamondSeparator() {
  return (
    <div className="flex items-center justify-center my-6">
      <span className="text-[#E87A2F] text-sm">◆</span>
    </div>
  );
}

/** Light background section (Entradas, Burgers, Sucos, Águas, Cervejas) */
function LightSection({ title, items, twoColumns }: {
  title: string;
  items: Array<{ id: number; name: string; price: number | null; description: string | null }>;
  twoColumns: boolean;
}) {
  return (
    <>
      <section className="mb-2">
        {/* Section header with orange line */}
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-base md:text-lg font-bold text-[#2C2C2C] uppercase tracking-[0.15em] whitespace-nowrap">
            {title}
          </h2>
          <div className="flex-1 h-[2px] bg-[#E87A2F]" />
        </div>

        {/* Items */}
        {twoColumns ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
            {items.map((item) => (
              <MenuItem key={item.id} item={item} dark={false} />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <MenuItem key={item.id} item={item} dark={false} />
            ))}
          </div>
        )}
      </section>
      <DiamondSeparator />
    </>
  );
}

/** Dark background section (Drinks) */
function DarkSection({ title, items, twoColumns }: {
  title: string;
  items: Array<{ id: number; name: string; price: number | null; description: string | null }>;
  twoColumns: boolean;
}) {
  return (
    <section className="mb-6 -mx-6 px-6 py-6 bg-[#2C2C2C]">
      {/* Section header with orange line */}
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-base md:text-lg font-bold text-[#FAF5EF] uppercase tracking-[0.15em] whitespace-nowrap">
          {title}
        </h2>
        <div className="flex-1 h-[2px] bg-[#E87A2F]" />
      </div>

      {/* Items */}
      {twoColumns ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
          {items.map((item) => (
            <MenuItem key={item.id} item={item} dark={true} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <MenuItem key={item.id} item={item} dark={true} />
          ))}
        </div>
      )}
    </section>
  );
}

/** Single menu item with dotted leader to price */
function MenuItem({ item, dark }: {
  item: { id: number; name: string; price: number | null; description: string | null };
  dark: boolean;
}) {
  const textColor = dark ? "text-[#FAF5EF]" : "text-[#2C2C2C]";
  const descColor = dark ? "text-[#FAF5EF]/50" : "text-[#4A3728]/60";
  const priceColor = "text-[#E87A2F]";
  const dotColor = dark ? "border-[#FAF5EF]/20" : "border-[#4A3728]/30";

  return (
    <div>
      <div className="flex items-baseline gap-1">
        <span className={`${textColor} text-sm font-bold uppercase whitespace-nowrap`}>
          {item.name}
        </span>
        <span className={`flex-1 border-b border-dotted ${dotColor} min-w-[20px] translate-y-[-3px]`} />
        {item.price !== null ? (
          <span className={`${priceColor} font-bold text-sm whitespace-nowrap`}>
            R$ {item.price.toFixed(2).replace('.', ',')}
          </span>
        ) : (
          <span className={`${descColor} text-xs italic`}>consulte</span>
        )}
      </div>
      {item.description && (
        <p className={`${descColor} text-xs mt-0.5 italic`}>{item.description}</p>
      )}
    </div>
  );
}

/** Group bebidas into logical sub-sections */
function groupBebidas(items: Array<{ id: number; name: string; price: number | null; description: string | null }>) {
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
      ((nameUpper.includes('AGUA') || nameUpper.includes('ÁGUA'))) ||
      nameUpper.includes('COCA') ||
      nameUpper.includes('GUARANA') ||
      nameUpper.includes('GUARANÁ')
    ) {
      aguasRefri.push(item);
    } else {
      // Drinks: Negroni, Aperol Spritz, Gin Tônica, Caipirinha, Caipiroska, etc.
      drinks.push(item);
    }
  }

  return { cervejas, drinks, sucos, aguasRefri };
}

/** Reorder sections to match PDF reference: Sucos, Águas, Cervejas, Drinks (dark) */
function reorderSections(grouped: ReturnType<typeof groupBebidas>) {
  const sections: Array<{
    title: string;
    items: Array<{ id: number; name: string; price: number | null; description: string | null }>;
    twoColumns: boolean;
    dark: boolean;
  }> = [];

  if (grouped.sucos.length > 0) {
    sections.push({ title: "Sucos", items: grouped.sucos, twoColumns: true, dark: false });
  }
  if (grouped.aguasRefri.length > 0) {
    sections.push({ title: "Água e Refrigerante", items: grouped.aguasRefri, twoColumns: true, dark: false });
  }
  if (grouped.cervejas.length > 0) {
    sections.push({ title: "Cervejas", items: grouped.cervejas, twoColumns: true, dark: false });
  }
  if (grouped.drinks.length > 0) {
    sections.push({ title: "Drinks", items: grouped.drinks, twoColumns: true, dark: true });
  }

  return sections;
}
