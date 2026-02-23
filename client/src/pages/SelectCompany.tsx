import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { MapPin, ChevronRight, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_LOGO, APP_TITLE } from "@/const";

export default function SelectCompany() {
  const { companies, setActiveCompany, loading } = useCompany();
  const { user, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-600"></div>
          <p className="text-slate-500 text-sm">Carregando empresas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50/40 flex flex-col relative overflow-hidden">
      {/* Background decorativo sutil */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-amber-200/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-slate-200/30 rounded-full blur-3xl" />
      </div>

      {/* Header minimalista */}
      <header className="relative w-full border-b border-slate-200/60 bg-white/70 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-end">
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">{user?.name}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logout()}
              className="text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="relative flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl">
          {/* Logo ABRWF grande + título */}
          <div className="text-center mb-10">
            {APP_LOGO && (
              <img 
                src={APP_LOGO} 
                alt={APP_TITLE} 
                className="h-24 w-24 mx-auto mb-5 rounded-2xl object-cover shadow-lg ring-1 ring-slate-200" 
              />
            )}
            <h1 className="text-2xl font-bold text-slate-800 mb-2 tracking-tight">
              Selecionar Empresa
            </h1>
            <p className="text-slate-500 text-sm max-w-md mx-auto">
              Você tem acesso a {companies.length} empresa{companies.length !== 1 ? 's' : ''}. 
              Selecione qual deseja acessar.
            </p>
          </div>

          {/* Cards de empresas */}
          <div className="space-y-3">
            {companies.map((company) => (
              <button
                key={`${company.companyId}-${company.branchId}`}
                className="w-full text-left cursor-pointer transition-all duration-200 border border-slate-200 bg-white rounded-xl p-4 hover:shadow-md hover:border-amber-400/60 hover:-translate-y-0.5 group focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                onClick={() => setActiveCompany(company.companyId, company.branchId || 0)}
              >
                <div className="flex items-center gap-4">
                  {/* Logo da empresa */}
                  <div className="flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden ring-1 ring-slate-200 group-hover:ring-amber-400/50 transition-all shadow-sm">
                    {company.companyLogoUrl ? (
                      <img 
                        src={company.companyLogoUrl} 
                        alt={company.companyName || company.companyLegalName || ''} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white font-bold text-xl">
                        {(company.companyName || company.companyLegalName || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Info da empresa */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-800 text-base truncate group-hover:text-amber-700 transition-colors">
                      {company.companyName || company.companyLegalName}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      {company.branchName && (
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {company.branchName}
                          {company.branchCity && ` — ${company.branchCity}`}
                          {company.branchState && `/${company.branchState}`}
                        </span>
                      )}
                      {company.isDefault && (
                        <span className="text-[10px] font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                          Padrão
                        </span>
                      )}
                    </div>
                    {company.segment && (
                      <span className="text-xs text-slate-400 mt-0.5 block">
                        {company.segment}
                      </span>
                    )}
                  </div>

                  {/* Seta */}
                  <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-amber-500 transition-colors flex-shrink-0" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative w-full border-t border-slate-200/60 bg-white/40">
        <div className="max-w-3xl mx-auto px-6 py-3 text-center">
          <p className="text-xs text-slate-400">
            Após selecionar, você pode trocar de empresa a qualquer momento pelo menu lateral.
          </p>
        </div>
      </footer>
    </div>
  );
}
