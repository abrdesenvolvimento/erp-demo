import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";
import { useLocation } from "wouter";

export default function AccessDenied() {
  const [, setLocation] = useLocation();

  return (
    <DashboardLayout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-red-100 p-4">
                <ShieldAlert className="h-12 w-12 text-red-600" />
              </div>
            </div>
            <CardTitle className="text-2xl">Acesso Negado</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Você não tem permissão para acessar esta página. Esta funcionalidade está disponível apenas para administradores do sistema.
            </p>
            <p className="text-sm text-muted-foreground">
              Se você acredita que deveria ter acesso, entre em contato com o administrador do sistema.
            </p>
            <div className="pt-4">
              <Button 
                onClick={() => setLocation("/")}
                className="w-full"
              >
                Voltar ao Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
