import { useAuth } from "@/_core/hooks/useAuth";

export function usePermissions() {
  const { user } = useAuth();
  const role = user?.role;

  return {
    // Roles
    isAdmin: role === "admin",
    isOperacional: role === "operacional",
    isConsultor: role === "consultor",

    // Permissões gerais
    canCreate: role === "admin" || role === "operacional",
    canEdit: role === "admin",
    canDelete: role === "admin",
    canView: true, // Todos podem visualizar

    // Permissões específicas por módulo
    products: {
      canCreate: role === "admin",
      canEdit: role === "admin",
      canDelete: role === "admin",
      canView: true,
      canViewCost: role === "admin" || role === "consultor", // Operacional não vê custo
    },

    sales: {
      canCreate: role === "admin" || role === "operacional",
      canEdit: role === "admin",
      canCancel: role === "admin",
      canView: true,
      canViewAll: role === "admin" || role === "consultor", // Operacional vê apenas suas vendas
    },

    purchases: {
      canCreate: role === "admin",
      canEdit: role === "admin",
      canDelete: role === "admin",
      canView: role === "admin" || role === "consultor",
    },

    expenses: {
      canCreate: role === "admin",
      canEdit: role === "admin",
      canDelete: role === "admin",
      canView: role === "admin" || role === "consultor",
    },

    partners: {
      canCreate: role === "admin",
      canEdit: role === "admin",
      canDelete: role === "admin",
      canView: true, // Todos podem visualizar
    },

    receivables: {
      canCreate: role === "admin",
      canEdit: role === "admin",
      canDelete: role === "admin",
      canView: true, // Todos podem visualizar
      canRegisterPayment: role === "admin" || role === "operacional", // Operacional pode registrar pagamentos
      canAddDebit: role === "admin" || role === "operacional", // Operacional pode lançar débitos
    },

    payables: {
      canCreate: role === "admin",
      canEdit: role === "admin",
      canDelete: role === "admin",
      canView: role === "admin" || role === "consultor",
    },

    users: {
      canCreate: role === "admin",
      canEdit: role === "admin",
      canDelete: role === "admin",
      canView: role === "admin",
    },

    reports: {
      canView: role === "admin" || role === "consultor",
    },
  };
}
