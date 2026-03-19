import DashboardLayout from "@/components/DashboardLayout";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ShoppingBag, ArrowRight, Clock, CheckCircle2 } from "lucide-react";

// Configuração dos importadores disponíveis
const IMPORTERS = [
  {
    id: "ifood",
    name: "iFood",
    description: "Importe pedidos do iFood para o sistema de vendas",
    logo: "https://d2xsxph8kpxj0f.cloudfront.net/310519663140687549/7RkrCeS5KipYf8hkuNqrCk/ifood-logo-official_825ad8bc.jpg",
    path: "/importar-vendas/ifood",
    status: "active" as const,
    color: "#EA1D2C",
    bgGradient: "linear-gradient(135deg, #FFF5F5 0%, #FFE8E8 100%)",
  },
  {
    id: "99food",
    name: "99Food",
    description: "Importação de pedidos da plataforma 99Food",
    logo: null,
    path: "/importar-vendas/99food",
    status: "coming_soon" as const,
    color: "#FFCC00",
    bgGradient: "linear-gradient(135deg, #FFFDE8 0%, #FFF9C4 100%)",
  },
  {
    id: "mercadolivre",
    name: "Mercado Livre",
    description: "Importação de vendas do Mercado Livre",
    logo: null,
    path: "/importar-vendas/mercadolivre",
    status: "coming_soon" as const,
    color: "#FFE600",
    bgGradient: "linear-gradient(135deg, #FFFDE8 0%, #FFF9C4 100%)",
  },
  {
    id: "proprio",
    name: "Importação Própria",
    description: "Importe vendas via planilha Excel ou CSV",
    logo: null,
    path: "/importar-vendas/proprio",
    status: "coming_soon" as const,
    color: "#6366F1",
    bgGradient: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)",
  },
];

export default function ImportarVendas() {
  const [, navigate] = useLocation();
  const [animationReady, setAnimationReady] = useState(false);
  const [clickedCard, setClickedCard] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setAnimationReady(true), 80);
    return () => clearTimeout(timer);
  }, []);

  const handleCardClick = (importer: typeof IMPORTERS[0]) => {
    if (importer.status !== "active") return;
    setClickedCard(importer.id);
    // Transição suave antes de navegar
    setTimeout(() => {
      navigate(importer.path);
    }, 400);
  };

  return (
    <DashboardLayout>
      {/* CSS animations */}
      <style>{`
        @keyframes importerCardEntrance {
          0% { opacity: 0; transform: translateY(24px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes importerHeaderFade {
          0% { opacity: 0; transform: translateY(-12px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes importerCardClick {
          0% { transform: scale(1); }
          50% { transform: scale(1.03); }
          100% { transform: scale(0.97); opacity: 0.7; }
        }
        @keyframes importerPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(234, 29, 44, 0.15); }
          50% { box-shadow: 0 0 0 8px rgba(234, 29, 44, 0); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      <div className="space-y-8">
        {/* Header */}
        <div
          style={{
            animation: animationReady ? 'importerHeaderFade 0.5s ease-out forwards' : 'none',
            opacity: animationReady ? undefined : 0,
          }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 border border-gray-200/60">
              <ShoppingBag className="w-6 h-6 text-gray-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Importar Vendas</h1>
              <p className="text-sm text-gray-500">Selecione a plataforma para importar pedidos</p>
            </div>
          </div>
        </div>

        {/* Grid de importadores */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {IMPORTERS.map((importer, index) => {
            const isActive = importer.status === "active";
            const isClicked = clickedCard === importer.id;

            return (
              <div
                key={importer.id}
                onClick={() => handleCardClick(importer)}
                className={`
                  relative group rounded-2xl border-2 overflow-hidden transition-all duration-300
                  ${isActive
                    ? 'cursor-pointer border-gray-200 hover:border-gray-300 hover:shadow-lg active:scale-[0.98]'
                    : 'cursor-default border-dashed border-gray-200 opacity-65'
                  }
                `}
                style={{
                  animation: isClicked
                    ? 'importerCardClick 0.4s ease-out forwards'
                    : animationReady
                      ? `importerCardEntrance 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) ${index * 0.1}s forwards`
                      : 'none',
                  opacity: isClicked ? undefined : (animationReady ? undefined : 0),
                  background: isActive ? '#fff' : '#FAFAFA',
                }}
              >
                {/* Fundo gradiente sutil no hover */}
                {isActive && (
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ background: importer.bgGradient }}
                  />
                )}

                <div className="relative p-6 flex flex-col items-center text-center gap-4">
                  {/* Logo container */}
                  <div
                    className={`
                      w-20 h-20 rounded-2xl flex items-center justify-center overflow-hidden
                      transition-all duration-300
                      ${isActive
                        ? 'bg-white shadow-md border border-gray-100 group-hover:shadow-lg group-hover:scale-105'
                        : 'bg-gray-100 border border-gray-200'
                      }
                    `}
                    style={{
                      animation: isActive && animationReady ? `importerPulse 3s ease-in-out ${1 + index * 0.2}s infinite` : 'none',
                    }}
                  >
                    {importer.logo ? (
                      <img
                        src={importer.logo}
                        alt={importer.name}
                        className="w-14 h-14 object-contain"
                      />
                    ) : (
                      <div
                        className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold text-white"
                        style={{
                          background: isActive
                            ? importer.color
                            : 'linear-gradient(135deg, #D1D5DB, #9CA3AF)',
                        }}
                      >
                        {importer.name.charAt(0)}
                      </div>
                    )}
                  </div>

                  {/* Nome e descrição */}
                  <div>
                    <h3 className={`text-lg font-semibold mb-1 ${isActive ? 'text-gray-800' : 'text-gray-400'}`}>
                      {importer.name}
                    </h3>
                    <p className={`text-xs leading-relaxed ${isActive ? 'text-gray-500' : 'text-gray-400'}`}>
                      {importer.description}
                    </p>
                  </div>

                  {/* Badge de status */}
                  {isActive ? (
                    <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Disponível
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400 bg-gray-100 px-3 py-1.5 rounded-full border border-gray-200">
                      <Clock className="w-3.5 h-3.5" />
                      Em breve
                    </div>
                  )}

                  {/* Seta de ação (apenas ativos) */}
                  {isActive && (
                    <div
                      className="absolute top-4 right-4 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:translate-x-0 -translate-x-1"
                      style={{ backgroundColor: `${importer.color}15` }}
                    >
                      <ArrowRight className="w-4 h-4" style={{ color: importer.color }} />
                    </div>
                  )}
                </div>

                {/* Barra inferior de cor (apenas ativos) */}
                {isActive && (
                  <div
                    className="h-1 w-0 group-hover:w-full transition-all duration-500 ease-out"
                    style={{ backgroundColor: importer.color }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Nota informativa */}
        <div
          className="text-center text-xs text-gray-400 mt-4"
          style={{
            animation: animationReady ? 'importerHeaderFade 0.5s ease-out 0.6s forwards' : 'none',
            opacity: animationReady ? undefined : 0,
          }}
        >
          Novos canais de importação serão adicionados conforme a demanda.
          Entre em contato para solicitar uma integração específica.
        </div>
      </div>
    </DashboardLayout>
  );
}
