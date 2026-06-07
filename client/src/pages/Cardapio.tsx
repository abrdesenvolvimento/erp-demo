import { trpc } from "@/lib/trpc";
import { Flame } from "lucide-react";

/**
 * Public Cardápio page - accessible without authentication.
 * Displays active products grouped by category with A Brasa Reúne branding.
 * Layout matches the PDF reference: cream background, orange accents,
 * two-column beverage sections, dotted leaders, diamond separators.
 * Designed for mobile-first (QR code on tables) + print-optimized (2 pages A4).
 *
 * Category order: Entradas → Burgers → Água e Refrigerante → Suco → Cerveja → Drinks
 * Page break for print: before "Suco" section.
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

  // Separate food categories from bebidas
  const bebidasCategory = data.categories.find(c => c.name === "BEBIIDAS");
  const foodCategories = data.categories.filter(c => c.name !== "BEBIIDAS");

  // Split bebidas into sub-sections
  const bebidasGrouped = bebidasCategory ? groupBebidas(bebidasCategory.items) : { cervejas: [], drinks: [], sucos: [], aguasRefri: [] };

  // Order food categories: Entradas first, then Burgers
  const orderedFood = [...foodCategories].sort((a, b) => {
    const order: Record<string, number> = {
      "ENTRADAS E ACOMPANHAMENTOS": 1,
      "BURGERS": 2,
    };
    return (order[a.name] || 99) - (order[b.name] || 99);
  });

  return (
    <div className="bg-[#FAF5EF] print-container">
      {/* Print styles - removes browser headers/footers, fills A4 cleanly in exactly 2 pages */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm 12mm;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-container {
            min-height: auto !important;
          }
          .page-break-before {
            page-break-before: always;
            break-before: page;
          }
          .no-print { display: none !important; }
          .print-header { display: flex !important; }
          /* Hide Made in Manus badge and ALL platform-injected elements */
          [class*="manus"], [class*="Manus"], #manus-badge, .manus-badge,
          [data-manus], [id*="manus"], [id*="Manus"],
          body > div:not(#root),
          body > aside, body > footer, body > span,
          body > a, body > p,
          #root ~ *, 
          [style*="position: fixed"],
          [style*="position:fixed"] {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            width: 0 !important;
            overflow: hidden !important;
            position: absolute !important;
            left: -9999px !important;
          }
          /* CRITICAL: Prevent blank third page */
          html, body, #root, .print-container {
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
          }
          /* Extend creme background to fill entire printed page */
          html, body {
            background-color: #FAF5EF !important;
          }
          #root {
            background-color: #FAF5EF !important;
          }
          #root {
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-container {
            padding-bottom: 0 !important;
            margin-bottom: 0 !important;
          }
          main {
            padding-bottom: 0 !important;
            margin-bottom: 0 !important;
          }
          /* Prevent orphan content from pushing to third page */
          .last-print-section {
            page-break-after: auto;
            break-after: auto;
          }
          .print-footer {
            page-break-after: avoid;
            break-after: avoid;
            margin-bottom: 0 !important;
            padding-bottom: 0 !important;
            margin-top: 2mm !important;
          }
          /* Compact page 2 spacing to fit in 2 pages */
          .page-break-before .print-header {
            margin-bottom: 2mm !important;
            padding-top: 1mm !important;
          }
          .page-break-before .print-header img {
            width: 12mm !important;
            height: 12mm !important;
          }
          /* Reduce diamond separator spacing in print */
          .diamond-sep {
            margin-top: 2mm !important;
            margin-bottom: 2mm !important;
          }
          /* Reduce section margins in print */
          section {
            margin-bottom: 0 !important;
          }
          /* Reduce section header margins */
          section .flex.items-center.gap-3 {
            margin-bottom: 1.5mm !important;
          }
          /* Compact dark section */
          .last-print-section section {
            padding-top: 3mm !important;
            padding-bottom: 3mm !important;
          }
        }
        @media screen {
          .print-header { display: none !important; }
        }
      `}</style>

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
      <main className="max-w-2xl mx-auto px-6 py-6 pb-0">

        {/* === PAGE 1: Entradas, Burgers === */}

        {/* Food categories (Entradas, Burgers) */}
        {orderedFood.map((cat) => (
          <LightSection
            key={cat.id}
            title={cat.displayName}
            items={sortItems(cat.items)}
            twoColumns={false}
          />
        ))}

        {/* === PAGE 2: Água e Refrigerante, Suco, Cerveja, Drinks === */}

        {/* Page break for print + repeated header on page 2 */}
        <div className="page-break-before">
          {/* Mini header for page 2 (print only) */}
          <div className="print-header flex-col items-center mb-6 pt-4">
            <img
              src="/manus-storage/logo-abrasa-circle_54a46a8b.png"
              alt="A Brasa Reúne"
              className="w-16 h-16 mx-auto mb-2"
            />
            <p className="text-center text-xs text-[#4A3728]/60 tracking-[0.2em] uppercase">
              A Brasa Reúne — Bar & Hamburgueria
            </p>
          </div>
        </div>

        {/* Água e Refrigerante */}
        {bebidasGrouped.aguasRefri.length > 0 && (
          <LightSection
            title="Água e Refrigerante"
            items={bebidasGrouped.aguasRefri}
            twoColumns={true}
          />
        )}

        {/* Suco */}
        {bebidasGrouped.sucos.length > 0 && (
          <LightSection
            title="Sucos"
            items={bebidasGrouped.sucos}
            twoColumns={true}
          />
        )}

        {/* Cerveja */}
        {bebidasGrouped.cervejas.length > 0 && (
          <LightSection
            title="Cervejas"
            items={bebidasGrouped.cervejas}
            twoColumns={true}
          />
        )}

        {/* Drinks (dark section) - last section on page 2 */}
        {bebidasGrouped.drinks.length > 0 && (
          <div className="last-print-section">
            <DarkSection
              title="Drinks"
              items={bebidasGrouped.drinks}
              twoColumns={true}
            />
          </div>
        )}

        {/* Footer text - positioned lower on the page */}
        <div className="print-footer flex flex-col items-center justify-center mt-8 pb-4 gap-1">
          <span className="text-[#4A3728]/40 text-xs tracking-[0.2em] uppercase">
            A Brasa Reúne | Bar & Hamburgueria
          </span>
          <span className="text-[#4A3728]/35 text-[10px] tracking-[0.1em]">
            @abrasareune
          </span>
        </div>

      </main>
    </div>
  );
}

/** Diamond separator between sections */
function DiamondSeparator() {
  return (
    <div className="diamond-sep flex items-center justify-center my-6">
      <span className="text-[#E87A2F] text-sm">◆</span>
    </div>
  );
}

/** Sort items: Cheese Burger first, then alphabetical, Carijó immediately before Choripan */
function sortItems(items: Array<{ id: number; name: string; price: number | null; description: string | null }>) {
  // Custom order: Cheese Burger first, then alphabetical, Carijó before Choripan
  const sorted = [...items].sort((a, b) => {
    const nameA = a.name.toUpperCase();
    const nameB = b.name.toUpperCase();

    // Cheese Burger always first
    if (nameA === 'CHEESE BURGER') return -1;
    if (nameB === 'CHEESE BURGER') return 1;

    // Default alphabetical
    return nameA.localeCompare(nameB, 'pt-BR');
  });

  // Then move Carijó to be immediately before Choripan
  const carijoIdx = sorted.findIndex(i => i.name.toUpperCase().includes('CARIJ'));
  const choripanIdx = sorted.findIndex(i => i.name.toUpperCase().includes('CHORIPAN'));

  if (carijoIdx !== -1 && choripanIdx !== -1 && carijoIdx !== choripanIdx - 1) {
    const [carijo] = sorted.splice(carijoIdx, 1);
    const newChoripanIdx = sorted.findIndex(i => i.name.toUpperCase().includes('CHORIPAN'));
    sorted.splice(newChoripanIdx, 0, carijo);
  }

  return sorted;
}

/** Light background section */
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
    <section className="mb-0 -mx-6 px-6 py-6 bg-[#2C2C2C]">
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
