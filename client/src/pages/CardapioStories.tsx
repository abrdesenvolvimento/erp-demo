import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Download, Instagram, Loader2, Image as ImageIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface StoryResult {
  categoryName: string;
  displayName: string;
  imageUrl: string;
}

export default function CardapioStories() {
  const { user } = useAuth();
  const [stories, setStories] = useState<StoryResult[]>([]);
  const [generating, setGenerating] = useState(false);

  const generateMutation = trpc.cardapio.generateStories.useMutation({
    onSuccess: (data) => {
      setStories(data.stories);
      setGenerating(false);
      toast.success(`${data.stories.length} stories gerados com sucesso!`);
    },
    onError: (error) => {
      setGenerating(false);
      toast.error(`Erro ao gerar stories: ${error.message}`);
    },
  });

  const handleGenerate = () => {
    setGenerating(true);
    setStories([]);
    generateMutation.mutate({ companyId: 2 });
  };

  const handleDownload = async (story: StoryResult) => {
    try {
      const response = await fetch(story.imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cardapio-story-${story.categoryName.toLowerCase().replace(/[^a-z0-9]/g, "-")}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Erro ao baixar imagem");
    }
  };

  const handleDownloadAll = async () => {
    if (stories.length === 0) return;
    
    // Download each one sequentially
    for (const story of stories) {
      await handleDownload(story);
      // Small delay between downloads
      await new Promise(r => setTimeout(r, 300));
    }
    toast.success("Todas as imagens foram baixadas!");
  };

  if (!user) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Faça login para acessar esta funcionalidade.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Instagram className="h-6 w-6 text-pink-500" />
            Cardápio — Instagram Stories
          </h1>
          <p className="text-muted-foreground mt-1">
            Gere imagens do cardápio em formato Story (1080×1920) para postar no Instagram
          </p>
        </div>
      </div>

      {/* Action card */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">
                Cada categoria do cardápio gera uma imagem separada, ideal para salvar nos Destaques do Instagram.
                Os dados são sempre atualizados com os produtos e preços vigentes.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleGenerate}
                disabled={generating}
                className="bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Gerar Stories
                  </>
                )}
              </Button>
              {stories.length > 0 && (
                <Button variant="outline" onClick={handleDownloadAll}>
                  <Download className="h-4 w-4 mr-2" />
                  Baixar Todos
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading state */}
      {generating && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <Loader2 className="h-12 w-12 text-pink-500 animate-spin" />
          <p className="text-muted-foreground">Gerando imagens para cada categoria...</p>
          <p className="text-xs text-muted-foreground">Isso pode levar alguns segundos</p>
        </div>
      )}

      {/* Results grid */}
      {stories.length > 0 && !generating && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stories.map((story) => (
            <Card key={story.categoryName} className="overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <span>{story.displayName}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(story)}
                    className="h-8 w-8 p-0"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <div className="relative bg-gray-100 rounded-lg overflow-hidden" style={{ aspectRatio: '9/16' }}>
                  <img
                    src={story.imageUrl}
                    alt={`Story - ${story.displayName}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {stories.length === 0 && !generating && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <Instagram className="h-16 w-16 text-muted-foreground/30" />
          <div>
            <p className="text-muted-foreground font-medium">Nenhum story gerado ainda</p>
            <p className="text-xs text-muted-foreground mt-1">
              Clique em "Gerar Stories" para criar as imagens do cardápio
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
