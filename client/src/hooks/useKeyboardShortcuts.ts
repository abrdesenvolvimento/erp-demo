import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';

/**
 * Hook para atalhos de teclado globais do sistema
 */
export function useKeyboardShortcuts(enabled = true) {
  const [, setLocation] = useLocation();
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (!enabled) return;
    const pendingKeys = new Set<(event: KeyboardEvent) => void>();
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!enabledRef.current || document.querySelector('.operator-access')) return;
      // Ignora se estiver digitando em input, textarea ou select
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      // Atalhos com Ctrl/Cmd
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'k':
            // Ctrl+K: Busca global (foca no campo de busca se existir)
            e.preventDefault();
            const searchInput = document.querySelector('input[type="search"], input[placeholder*="Buscar"]') as HTMLInputElement;
            searchInput?.focus();
            break;
        }
      }

      // Atalhos sem modificadores (apenas quando não está em campo de texto)
      switch (e.key.toLowerCase()) {
        case 'g':
          // G + tecla: Navegação rápida
          // Aguarda próxima tecla
          const nextKey = (nextE: KeyboardEvent) => {
            pendingKeys.delete(nextKey);
            if (!enabledRef.current || document.querySelector('.operator-access')) return;
            switch (nextE.key.toLowerCase()) {
              case 'h':
                // G+H: Home/Dashboard
                setLocation('/');
                break;
              case 'p':
                // G+P: Produtos
                setLocation('/produtos');
                break;
              case 'v':
                // G+V: Vendas
                setLocation('/vendas');
                break;
              case 'c':
                // G+C: Compras
                setLocation('/compras');
                break;
              case 'a':
                // G+A: Parceiros (clientes/fornecedores)
                setLocation('/parceiros');
                break;
              case 'r':
                // G+R: Contas a Receber
                setLocation('/contas-receber');
                break;
              case 'g':
                // G+G: Contas a Pagar
                setLocation('/contas-pagar');
                break;
              case 'd':
                // G+D: Despesas
                setLocation('/despesas');
                break;
            }
            document.removeEventListener('keydown', nextKey);
          };
          
          pendingKeys.add(nextKey);
          document.addEventListener('keydown', nextKey, { once: true });
          
          // Remove listener após 2 segundos se não pressionar nada
          const timer = setTimeout(() => {
            document.removeEventListener('keydown', nextKey);
            pendingKeys.delete(nextKey);
            timers.delete(timer);
          }, 2000);
          timers.add(timer);
          break;

        case '?':
          // ?: Mostrar ajuda de atalhos
          e.preventDefault();
          showShortcutsHelp();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);

    return () => {
      document.removeEventListener('keydown', handleKeyPress);
      pendingKeys.forEach(listener => document.removeEventListener('keydown', listener));
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [setLocation, enabled]);
}

/**
 * Mostra dialog com lista de atalhos disponíveis
 */
function showShortcutsHelp() {
  // Cria overlay
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center';
  overlay.onclick = () => overlay.remove();

  // Cria dialog
  const dialog = document.createElement('div');
  dialog.className = 'bg-white rounded-lg p-6 max-w-2xl w-full mx-4 shadow-xl';
  dialog.onclick = (e) => e.stopPropagation();

  dialog.innerHTML = `
    <div class="space-y-4">
      <div class="flex items-center justify-between border-b pb-4">
        <h2 class="text-2xl font-bold">Atalhos de Teclado</h2>
        <button onclick="this.closest('.fixed').remove()" class="text-gray-500 hover:text-gray-700">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <div class="grid grid-cols-2 gap-6">
        <div>
          <h3 class="font-semibold mb-2 text-sm text-gray-600">NAVEGAÇÃO</h3>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-600">Dashboard</span>
              <kbd class="px-2 py-1 bg-gray-100 rounded border">G</kbd>
              <kbd class="px-2 py-1 bg-gray-100 rounded border">H</kbd>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">Produtos</span>
              <kbd class="px-2 py-1 bg-gray-100 rounded border">G</kbd>
              <kbd class="px-2 py-1 bg-gray-100 rounded border">P</kbd>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">Vendas</span>
              <kbd class="px-2 py-1 bg-gray-100 rounded border">G</kbd>
              <kbd class="px-2 py-1 bg-gray-100 rounded border">V</kbd>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">Compras</span>
              <kbd class="px-2 py-1 bg-gray-100 rounded border">G</kbd>
              <kbd class="px-2 py-1 bg-gray-100 rounded border">C</kbd>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">Parceiros</span>
              <kbd class="px-2 py-1 bg-gray-100 rounded border">G</kbd>
              <kbd class="px-2 py-1 bg-gray-100 rounded border">A</kbd>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">Contas a Receber</span>
              <kbd class="px-2 py-1 bg-gray-100 rounded border">G</kbd>
              <kbd class="px-2 py-1 bg-gray-100 rounded border">R</kbd>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">Contas a Pagar</span>
              <kbd class="px-2 py-1 bg-gray-100 rounded border">G</kbd>
              <kbd class="px-2 py-1 bg-gray-100 rounded border">G</kbd>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">Despesas</span>
              <kbd class="px-2 py-1 bg-gray-100 rounded border">G</kbd>
              <kbd class="px-2 py-1 bg-gray-100 rounded border">D</kbd>
            </div>
          </div>
        </div>

        <div>
          <h3 class="font-semibold mb-2 text-sm text-gray-600">AÇÕES</h3>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-600">Buscar</span>
              <div class="flex gap-1">
                <kbd class="px-2 py-1 bg-gray-100 rounded border">Ctrl</kbd>
                <span>+</span>
                <kbd class="px-2 py-1 bg-gray-100 rounded border">K</kbd>
              </div>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">Ajuda</span>
              <kbd class="px-2 py-1 bg-gray-100 rounded border">?</kbd>
            </div>
          </div>

          <h3 class="font-semibold mt-6 mb-2 text-sm text-gray-600">DICAS</h3>
          <ul class="text-sm text-gray-600 space-y-1">
            <li>• Pressione <kbd class="px-1 bg-gray-100 rounded">G</kbd> seguido de uma letra para navegar</li>
            <li>• Use <kbd class="px-1 bg-gray-100 rounded">Tab</kbd> para navegar entre campos</li>
            <li>• Pressione <kbd class="px-1 bg-gray-100 rounded">Esc</kbd> para fechar diálogos</li>
          </ul>
        </div>
      </div>

      <div class="border-t pt-4 text-center">
        <button 
          onclick="this.closest('.fixed').remove()" 
          class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Fechar
        </button>
      </div>
    </div>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  // Fecha com ESC
  const handleEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', handleEsc);
    }
  };
  document.addEventListener('keydown', handleEsc);
}
