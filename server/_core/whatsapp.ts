/**
 * WhatsApp Business API Helper
 * Envia mensagens e documentos via WhatsApp
 */

const WHATSAPP_API_URL = "https://graph.facebook.com/v18.0";

interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
}

function getConfig(): WhatsAppConfig {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    throw new Error("WhatsApp credentials not configured. Please set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN.");
  }

  return { phoneNumberId, accessToken };
}

/**
 * Formata número de telefone para o formato internacional do WhatsApp
 * Ex: +55 11 98603-7317 -> 5511986037317
 */
export function formatPhoneNumber(phone: string): string {
  // Remove tudo que não é número
  const cleaned = phone.replace(/\D/g, "");
  
  // Se não começar com 55, adiciona
  if (!cleaned.startsWith("55")) {
    return "55" + cleaned;
  }
  
  return cleaned;
}

/**
 * Envia uma mensagem de texto simples via WhatsApp
 */
export async function sendWhatsAppMessage(
  to: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const config = getConfig();
    const formattedPhone = formatPhoneNumber(to);

    const response = await fetch(
      `${WHATSAPP_API_URL}/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: formattedPhone,
          type: "text",
          text: {
            preview_url: false,
            body: message,
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("[WhatsApp] Error sending message:", data);
      return {
        success: false,
        error: data.error?.message || "Failed to send message",
      };
    }

    console.log("[WhatsApp] Message sent successfully:", data);
    return {
      success: true,
      messageId: data.messages?.[0]?.id,
    };
  } catch (error) {
    console.error("[WhatsApp] Exception:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Envia um documento (PDF) via WhatsApp
 */
export async function sendWhatsAppDocument(
  to: string,
  documentUrl: string,
  filename: string,
  caption?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const config = getConfig();
    const formattedPhone = formatPhoneNumber(to);

    const response = await fetch(
      `${WHATSAPP_API_URL}/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: formattedPhone,
          type: "document",
          document: {
            link: documentUrl,
            filename: filename,
            caption: caption || "",
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("[WhatsApp] Error sending document:", data);
      return {
        success: false,
        error: data.error?.message || "Failed to send document",
      };
    }

    console.log("[WhatsApp] Document sent successfully:", data);
    return {
      success: true,
      messageId: data.messages?.[0]?.id,
    };
  } catch (error) {
    console.error("[WhatsApp] Exception:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Verifica se as credenciais do WhatsApp estão configuradas
 */
export function isWhatsAppConfigured(): boolean {
  return !!(
    process.env.WHATSAPP_PHONE_NUMBER_ID &&
    process.env.WHATSAPP_ACCESS_TOKEN
  );
}

/**
 * Testa a conexão com a API do WhatsApp
 */
export async function testWhatsAppConnection(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const config = getConfig();

    // Faz uma requisição GET para verificar o número de telefone
    const response = await fetch(
      `${WHATSAPP_API_URL}/${config.phoneNumberId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error?.message || "Failed to connect to WhatsApp API",
      };
    }

    console.log("[WhatsApp] Connection test successful:", data);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
