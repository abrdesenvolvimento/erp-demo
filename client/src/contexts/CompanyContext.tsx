import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";

type CompanyAccess = {
  companyId: number;
  branchId: number | null;
  role: string;
  isDefault: boolean;
  companyName: string | null;
  companyLegalName: string;
  companyLogoUrl: string | null;
  companyDocNumber: string | null;
  segment: string | null;
  branchName: string | null;
  branchStreet: string | null;
  branchStreetNumber: string | null;
  branchNeighborhood: string | null;
  branchCity: string | null;
  branchState: string | null;
  branchZipCode: string | null;
};

type CompanyContextType = {
  companies: CompanyAccess[];
  activeCompanyId: number | null;
  activeBranchId: number | null;
  activeCompany: CompanyAccess | null;
  loading: boolean;
  switching: boolean;
  needsSelection: boolean;
  setActiveCompany: (companyId: number, branchId: number) => void;
};

const CompanyContext = createContext<CompanyContextType>({
  companies: [],
  activeCompanyId: null,
  activeBranchId: null,
  activeCompany: null,
  loading: true,
  switching: false,
  needsSelection: false,
  setActiveCompany: () => {},
});

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? match[2] : null;
}

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [switching, setSwitching] = useState(false);
  const [activeCompanyId, setActiveCompanyId] = useState<number | null>(() => {
    const saved = getCookie("activeCompanyId");
    return saved ? parseInt(saved, 10) : null;
  });
  const [activeBranchId, setActiveBranchId] = useState<number | null>(() => {
    const saved = getCookie("activeBranchId");
    return saved ? parseInt(saved, 10) : null;
  });

  const { data: companies = [], isLoading } = trpc.company.myCompanies.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const setActiveMutation = trpc.company.setActive.useMutation({
    onSuccess: () => {
      // Invalidar TODAS as queries do tRPC para recarregar dados da nova empresa
      queryClient.invalidateQueries();
      // Delay mínimo de 4s para transição suave entre empresas
      setTimeout(() => setSwitching(false), 4000);
    },
    onError: () => {
      setSwitching(false);
    },
  });

  // Auto-selecionar empresa padrão APENAS se o usuário tem acesso a UMA única empresa
  // Se tem múltiplas empresas, exibir tela de seleção
  useEffect(() => {
    if (companies.length === 1 && !activeCompanyId) {
      const company = companies[0];
      setActiveCompanyId(company.companyId);
      setActiveBranchId(company.branchId);
      setActiveMutation.mutate({
        companyId: company.companyId,
        branchId: company.branchId || 0,
      });
    }
  }, [companies, activeCompanyId]);

  // Determinar se precisa mostrar tela de seleção
  const needsSelection = !isLoading && companies.length > 1 && !activeCompanyId;

  const setActiveCompany = useCallback((companyId: number, branchId: number) => {
    if (companyId === activeCompanyId && branchId === activeBranchId) return;
    setSwitching(true);
    setActiveCompanyId(companyId);
    setActiveBranchId(branchId);
    // Setar cookies imediatamente para que o próximo request já use os novos valores
    document.cookie = `activeCompanyId=${companyId};path=/;max-age=31536000`;
    document.cookie = `activeBranchId=${branchId};path=/;max-age=31536000`;
    setActiveMutation.mutate({ companyId, branchId });
  }, [activeCompanyId, activeBranchId, setActiveMutation]);

  const activeCompany = useMemo(() => {
    return companies.find(
      c => c.companyId === activeCompanyId && 
           (c.branchId === activeBranchId || !c.branchId)
    ) || null;
  }, [companies, activeCompanyId, activeBranchId]);

  return (
    <CompanyContext.Provider
      value={{
        companies,
        activeCompanyId,
        activeBranchId,
        activeCompany,
        loading: isLoading,
        switching,
        needsSelection,
        setActiveCompany,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  return useContext(CompanyContext);
}
