import { Flame } from "lucide-react";

/**
 * Aviso de Inauguração - Folha separada para impressão em meia-folha A4 ou A5.
 * Pode ser colocada em porta-avisos nas mesas ou como encarte no cardápio.
 * Rota: /aviso-inauguracao
 */
export default function AvisoInauguracao() {
  return (
    <div className="aviso-container bg-[#FAF5EF] min-h-screen flex items-center justify-center p-4">
      {/* Print styles for A5 / half-A4 */}
      <style>{`
        @media print {
          @page {
            size: A5 landscape;
            margin: 15mm;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .aviso-container {
            min-height: auto !important;
            padding: 0 !important;
          }
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
          html, body, #root, .aviso-container {
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
          }
        }
      `}</style>

      <div className="max-w-md w-full text-center pt-10">
        {/* Logo */}
        <img
          src="/manus-storage/logo-abrasa-circle_54a46a8b.png"
          alt="A Brasa Reúne"
          className="w-20 h-20 mx-auto mb-3 drop-shadow-lg"
        />

        {/* Title */}
        <h1 className="text-lg font-bold text-[#2C2C2C] tracking-[0.15em] uppercase mb-0.5">
          A Brasa Reúne
        </h1>
        <p className="text-[#4A3728]/60 text-[10px] tracking-[0.2em] uppercase mb-4">
          Bar & Hamburgueria
        </p>

        {/* Divider */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-10 h-[2px] bg-[#E87A2F]" />
          <Flame className="h-4 w-4 text-[#E87A2F]" />
          <div className="w-10 h-[2px] bg-[#E87A2F]" />
        </div>

        {/* Main message */}
        <h2 className="text-base font-bold text-[#2C2C2C] mb-3">
          Bem-vindo à nossa inauguração!
        </h2>

        <p className="text-[#4A3728]/80 text-sm leading-relaxed mb-3">
          Preparamos uma seleção especial para garantir a melhor experiência possível neste primeiro dia.
        </p>

        <p className="text-[#4A3728]/80 text-sm leading-relaxed mb-5">
          Já na próxima semana, novas opções serão adicionadas ao cardápio, incluindo os exclusivos
          <strong className="text-[#2C2C2C]"> Hambúrgueres da Copa do Mundo</strong>.
          Fique de olho nas novidades!
        </p>

        {/* QR Codes side by side */}
        <div className="flex items-center justify-center gap-8 mb-5">
          {/* Instagram QR */}
          <div className="flex flex-col items-center gap-2">
            <img
              src="/manus-storage/qr-instagram_6d1c9f2c.jpg"
              alt="QR Code Instagram"
              className="w-28 h-28 rounded-lg shadow-sm"
            />
            <span className="text-[#4A3728]/70 text-[10px] font-medium tracking-wide">
              Siga-nos
            </span>
          </div>

          {/* Google Review QR */}
          <div className="flex flex-col items-center gap-2">
            <img
              src="/manus-storage/qr-google_ce0b0250.png"
              alt="QR Code Avaliação Google"
              className="w-28 h-28 rounded-lg shadow-sm border border-gray-200 p-2 bg-white"
            />
            <span className="text-[#4A3728]/70 text-[10px] font-medium tracking-wide">
              Avalie-nos
            </span>
          </div>
        </div>

        {/* Footer */}
        <p className="text-[#4A3728]/40 text-xs tracking-[0.15em] uppercase">
          Obrigado pela presença!
        </p>
      </div>
    </div>
  );
}
