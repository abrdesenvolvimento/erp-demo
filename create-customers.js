import { getDb } from "./server/db.js";
import { partners } from "./drizzle/schema.js";

async function createCustomers() {
  const db = await getDb();
  console.log("=== CRIANDO CLIENTES DE TESTE ===\n");
  
  const newCustomers = [
    {
      name: "Bar do João",
      partnerType: "CUSTOMER",
      cpfCnpj: "12345678901",
      phone: "(11) 98765-4321",
      email: "bar@joao.com.br",
      address: "Rua das Flores, 123",
      city: "São Paulo",
      state: "SP",
      zipCode: "01234-567",
      creditLimit: "5000.00",
      notes: "Cliente frequente, pagamento em dia"
    },
    {
      name: "Restaurante Sabor & Arte",
      partnerType: "CUSTOMER",
      cpfCnpj: "12345678000190",
      phone: "(11) 3456-7890",
      email: "contato@saborarte.com.br",
      address: "Av. Paulista, 1000",
      city: "São Paulo",
      state: "SP",
      zipCode: "01310-100",
      creditLimit: "10000.00",
      notes: "Restaurante de médio porte, compras semanais"
    },
    {
      name: "Mercearia Central",
      partnerType: "CUSTOMER",
      cpfCnpj: "98765432000101",
      phone: "(11) 2345-6789",
      email: "mercearia@central.com.br",
      address: "Rua do Comércio, 456",
      city: "São Paulo",
      state: "SP",
      zipCode: "03456-789",
      creditLimit: "3000.00",
      notes: "Mercearia de bairro, entregas quinzenais"
    },
    {
      name: "Lanchonete Bom Gosto",
      partnerType: "CUSTOMER",
      cpfCnpj: "11122233344",
      phone: "(11) 91234-5678",
      email: "lanchonete@bomgosto.com.br",
      address: "Rua Augusta, 789",
      city: "São Paulo",
      state: "SP",
      zipCode: "01305-100",
      creditLimit: "2000.00",
      notes: "Lanchonete, pedidos frequentes de bebidas"
    },
    {
      name: "Padaria Pão Quente",
      partnerType: "CUSTOMER",
      cpfCnpj: "55566677788",
      phone: "(11) 99876-5432",
      email: "padaria@paoquente.com.br",
      address: "Rua da Consolação, 321",
      city: "São Paulo",
      state: "SP",
      zipCode: "01301-000",
      creditLimit: "4000.00",
      notes: "Padaria tradicional, compras diárias"
    }
  ];
  
  console.log("Criando clientes...");
  for (const customer of newCustomers) {
    const [result] = await db.insert(partners).values(customer);
    console.log(`   ✓ ${customer.name} criado (ID: ${result.insertId})`);
  }
  
  console.log(`\n✅ ${newCustomers.length} clientes criados com sucesso!`);
  process.exit(0);
}

createCustomers().catch(console.error);
