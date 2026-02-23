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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-600"></div>
          <p className="text-slate-500 text-sm">Carregando empresas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50/30 flex flex-col">
      {/* Header */}
      <header className="w-full border-b border-slate-200/60 bg-white/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {APP_LOGO && (
              <img src={APP_LOGO} alt={APP_TITLE} className="h-8 w-auto" />
            )}
            <span className="font-semibold text-slate-800 text-lg">{APP_TITLE}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">{user?.name}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logout()}
              className="text-slate-400 hover:text-slate-600"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 mb-4">
              <Building2 className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">
              Selecionar Empresa
            </h1>
            <p className="text-slate-500 text-sm max-w-md mx-auto">
              Você tem acesso a {companies.length} empresa{companies.length !== 1 ? 's' : ''}. 
              Selecione a empresa que deseja acessar.
            </p>
          </div>

          <div className="space-y-3">
            {companies.map((company) => (
              <Card
                key={`${company.companyId}-${company.branchId}`}
                className="cursor-pointer transition-all duration-200 hover:shadow-md hover:border-amber-300 border-slate-200 group"
                onClick={() => setActiveCompany(company.companyId, company.branchId || 0)}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                    {(company.companyName || company.companyLegalName || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-800 truncate">
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
                        <span className="text-[10px] font-medium bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                          Padrão
                        </span>
                      )}
                    </div>
                    {company.segment && (
                      <span className="text-xs text-slate-400 mt-1 block">
                        {company.segment}
                      </span>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-amber-500 transition-colors flex-shrink-0" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200/60 bg-white/50">
        <div className="max-w-3xl mx-auto px-6 py-3 text-center">
          <p className="text-xs text-slate-400">
            Após selecionar, você pode trocar de empresa a qualquer momento pelo menu lateral.
          </p>
        </div>
      </footer>
    </div>
  );
}
