import { describe, it, expect } from "vitest";
import { testWhatsAppConnection, isWhatsAppConfigured, formatPhoneNumber } from "../_core/whatsapp";

describe("WhatsApp Integration", () => {
  it("should have WhatsApp credentials configured", () => {
    expect(isWhatsAppConfigured()).toBe(true);
  });

  it("should format phone numbers correctly", () => {
    // Número com código do país
    expect(formatPhoneNumber("+55 11 98603-7317")).toBe("5511986037317");
    
    // Número sem código do país
    expect(formatPhoneNumber("11 98603-7317")).toBe("5511986037317");
    
    // Número já formatado
    expect(formatPhoneNumber("5511986037317")).toBe("5511986037317");
    
    // Número com parênteses
    expect(formatPhoneNumber("(11) 98603-7317")).toBe("5511986037317");
  });

  it("should connect to WhatsApp API successfully", async () => {
    const result = await testWhatsAppConnection();
    
    if (!result.success) {
      console.error("WhatsApp connection failed:", result.error);
    }
    
    expect(result.success).toBe(true);
  }, 30000); // Timeout de 30 segundos para chamada de API
});
