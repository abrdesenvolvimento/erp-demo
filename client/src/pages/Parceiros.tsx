import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Users, Plus, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Parceiros() {
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const { data: partners, isLoading, refetch } = trpc.partners.list.useQuery({
    search: search || undefined,
  });
  
  const createPartner = trpc.partners.create.useMutation({
    onSuccess: () => {
      toast.success("Parceiro criado com sucesso!");
      setIsDialogOpen(false);
      refetch();
      setFormData({
        name: "",
        docNumber: "",
        partnerType: "CUSTOMER",
        phone: "",
        email: "",
        creditLimit: "0.00",
      });
    },
    onError: (error) => {
      toast.error("Erro ao criar parceiro: " + error.message);
    },
  });

  const [formData, setFormData] = useState({
    name: "",
    docNumber: "",
    partnerType: "CUSTOMER" as "CUSTOMER" | "SUPPLIER" | "BOTH",
    phone: "",
    email: "",
    creditLimit: "0.00",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createPartner.mutate({
      ...formData,
      docNumber: formData.docNumber || undefined,
      phone: formData.phone || undefined,
      email: formData.email || undefined,
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Parceiros</h1>
            <p className="text-muted-foreground">
              Gerencie clientes e fornecedores
            </p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Parceiro
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Novo Parceiro</DialogTitle>
                  <DialogDescription>
                    Cadastre um novo cliente ou fornecedor
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Nome/Razão Social *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="docNumber">CPF/CNPJ</Label>
                      <Input
                        id="docNumber"
                        value={formData.docNumber}
                        onChange={(e) =>
                          setFormData({ ...formData, docNumber: e.target.value })
                        }
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="partnerType">Tipo *</Label>
                      <Select
                        value={formData.partnerType}
                        onValueChange={(value: any) =>
                          setFormData({ ...formData, partnerType: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CUSTOMER">Cliente</SelectItem>
                          <SelectItem value="SUPPLIER">Fornecedor</SelectItem>
                          <SelectItem value="BOTH">Ambos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="phone">Telefone</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="email">E-mail</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  {(formData.partnerType === "CUSTOMER" || formData.partnerType === "BOTH") && (
                    <div className="grid gap-2">
                      <Label htmlFor="creditLimit">Limite de Crédito (R$)</Label>
                      <Input
                        id="creditLimit"
                        type="number"
                        step="0.01"
                        value={formData.creditLimit}
                        onChange={(e) =>
                          setFormData({ ...formData, creditLimit: e.target.value })
                        }
                      />
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createPartner.isPending}>
                    {createPartner.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar parceiros..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-muted-foreground">Carregando parceiros...</p>
              </div>
            ) : partners && partners.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead className="text-right">Limite Crédito</TableHead>
                    <TableHead className="text-right">Saldo Atual</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partners.map((partner) => (
                    <TableRow key={partner.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{partner.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {partner.docNumber || "-"}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-primary/10 text-primary">
                          {partner.partnerType === "CUSTOMER"
                            ? "Cliente"
                            : partner.partnerType === "SUPPLIER"
                            ? "Fornecedor"
                            : "Ambos"}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {partner.phone || partner.email || "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        R$ {parseFloat(partner.creditLimit || "0").toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            parseFloat(partner.currentBalance || "0") > 0
                              ? "text-red-600 font-medium"
                              : "text-green-600 font-medium"
                          }
                        >
                          R$ {parseFloat(partner.currentBalance || "0").toFixed(2)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {search
                    ? "Nenhum parceiro encontrado"
                    : "Nenhum parceiro cadastrado ainda"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

