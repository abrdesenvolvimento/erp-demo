import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, MapPin, ChevronRight, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_LOGO, APP_TITLE } from "@/const";

export default function SelectCompany() {
  const { companies, setActiveCompany, loading } = useCompany();
  const { user, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500"></div>
          <p className="text-slate-400 text-sm">Carregando empresas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col relative overflow-hidden">
      {/* Background decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-amber-600/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/3 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative w-full border-b border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {APP_LOGO && (
              <img src={APP_LOGO} alt={APP_TITLE} className="h-10 w-10 rounded-lg object-cover ring-1 ring-slate-700" />
            )}
            <span className="font-semibold text-white text-lg tracking-tight">{APP_TITLE}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">{user?.name}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logout()}
              className="text-slate-500 hover:text-slate-300 hover:bg-slate-800"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="relative flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">
              Selecionar Empresa
            </h1>
            <p className="text-slate-400 text-sm max-w-md mx-auto">
              Você tem acesso a {companies.length} empresa{companies.length !== 1 ? 's' : ''}. 
              Selecione a empresa que deseja acessar.
            </p>
          </div>

          <div className="space-y-4">
            {companies.map((company) => (
              <Card
                key={`${company.companyId}-${company.branchId}`}
                className="cursor-pointer transition-all duration-300 border-slate-700/60 bg-slate-800/50 backdrop-blur-sm hover:bg-slate-800/80 hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/5 group"
                onClick={() => setActiveCompany(company.companyId, company.branchId || 0)}
              >
                <CardContent className="p-5 flex items-center gap-5">
                  {/* Logo da empresa */}
                  <div className="flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden ring-1 ring-slate-600 group-hover:ring-amber-500/50 transition-all shadow-lg">
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
                    <h3 className="font-semibold text-white text-base truncate group-hover:text-amber-100 transition-colors">
                      {company.companyName || company.companyLegalName}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      {company.branchName && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {company.branchName}
                          {company.branchCity && ` — ${company.branchCity}`}
                          {company.branchState && `/${company.branchState}`}
                        </span>
                      )}
                      {company.isDefault && (
                        <span className="text-[10px] font-medium bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30">
                          Padrão
                        </span>
                      )}
                    </div>
                    {company.segment && (
                      <span className="text-xs text-slate-500 mt-1 block">
                        {company.segment}
                      </span>
                    )}
                  </div>

                  {/* Seta */}
                  <ChevronRight className="h-5 w-5 text-slate-600 group-hover:text-amber-500 transition-colors flex-shrink-0" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative w-full border-t border-slate-700/50 bg-slate-900/40">
        <div className="max-w-3xl mx-auto px-6 py-3 text-center">
          <p className="text-xs text-slate-500">
            Após selecionar, você pode trocar de empresa a qualquer momento pelo menu lateral.
          </p>
        </div>
      </footer>
    </div>
  );
}
