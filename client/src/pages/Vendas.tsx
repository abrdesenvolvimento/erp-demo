import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ShoppingCart, Plus } from "lucide-react";

export default function Vendas() {
  return (
    <DashboardLayout>
      <div className="container py-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <ShoppingCart className="h-6 w-6" />
                  Vendas
                </h1>
                <p className="text-muted-foreground mt-1">
                  Registre e gerencie vendas do sistema
                </p>
              </div>

              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Venda
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <div className="text-center">
                <ShoppingCart className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">Módulo de Vendas em Desenvolvimento</p>
                <p className="text-sm mt-2">
                  Em breve você poderá registrar vendas de balcão, delivery e a prazo
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

