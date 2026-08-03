import React, { useState, useRef, useEffect } from 'react';
import { BookProject } from '../types';
import { X, ChevronLeft, ChevronRight, BookOpen, List } from 'lucide-react';
import { buildCanonicalBookSequence } from '../lib/rendering/canonicalRenderer';

interface BookReaderModalProps {
  project: BookProject;
  onClose: () => void;
}

export const BookReaderModal: React.FC<BookReaderModalProps> = ({ project, onClose }) => {
  const sequence = buildCanonicalBookSequence(project);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [fontFamily, setFontFamily] = useState<'serif' | 'sans' | 'mono'>('serif');
  const [fontSize, setFontSize] = useState<number>(17);
  const [paperTheme, setPaperTheme] = useState<'white' | 'sepia' | 'slate' | 'dark'>('sepia');
  const [showToc, setShowToc] = useState<boolean>(false);
  const readerScrollRef = useRef<HTMLElement>(null);

  const currentSection = sequence[currentIndex] || {
    id: 'sec-empty',
    type: 'chapter',
    title: 'Seção',
    content: 'Nenhum conteúdo.',
  };

  useEffect(() => {
    if (readerScrollRef.current) {
      readerScrollRef.current.scrollTop = 0;
    }
  }, [currentIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        setCurrentIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight') {
        setCurrentIndex((prev) => Math.min(sequence.length - 1, prev + 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, sequence.length]);

  const themeClasses = {
    white: 'bg-white text-[#1C1917] border-[#E7E5E4]',
    sepia: 'bg-[#FDFCFB] text-[#1C1917] border-[#E7E5E4]',
    slate: 'bg-[#292524] text-stone-100 border-stone-700',
    dark: 'bg-[#1C1917] text-stone-200 border-stone-800',
  };

  const fontClasses = {
    serif: 'font-serif',
    sans: 'font-sans',
    mono: 'font-mono',
  };

  const wordCount = currentSection.content.split(/\s+/).length;
  const readingTime = Math.ceil(wordCount / 200);

  const renderFormattedContent = (content: string) => {
    if (!content) return <p className="italic text-stone-500">Nenhum texto nesta seção.</p>;

    if (currentSection.type === 'cover') {
      return (
        <div className="flex flex-col items-center justify-center space-y-4 py-8">
          <img
            src={content}
            alt="Capa do Livro"
            className="max-h-96 object-contain border shadow-lg"
          />
        </div>
      );
    }

    const blocks = content.split(/\n\s*\n/);
    return blocks.map((block, idx) => {
      const trimmed = block.trim();
      if (!trimmed) return null;

      return (
        <p key={idx} className="my-3 text-justify leading-relaxed indent-6 font-serif">
          {trimmed}
        </p>
      );
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Leitor: ${project.metadata.titulo}`}
      className="fixed inset-0 z-50 flex flex-col h-screen w-screen bg-stone-950/95 backdrop-blur-md animate-fade-in overflow-hidden"
    >
      {/* Top Navbar */}
      <header className="bg-[#1C1917] border-b border-stone-800 px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between text-stone-200 shrink-0 gap-3">
        <div className="flex items-center space-x-3 min-w-0">
          <BookOpen className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="min-w-0">
            <h2 className="font-serif italic font-bold text-xs sm:text-sm text-white truncate max-w-[160px] sm:max-w-md">
              {project.metadata.titulo}
            </h2>
            <p className="text-[10px] uppercase tracking-wider text-stone-400 truncate">
              {currentSection.title} • {currentIndex + 1} de {sequence.length} • ~{readingTime} min
            </p>
          </div>
        </div>

        {/* Reader Customization Controls */}
        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
          <button
            onClick={() => setShowToc(!showToc)}
            className="px-2.5 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 transition text-xs uppercase tracking-wider font-medium flex items-center space-x-1 border border-stone-700"
            title="Sumário da Obra Completa"
          >
            <List className="w-4 h-4" />
            <span className="hidden md:inline">Sumário Canônico</span>
          </button>

          {/* Font Size Adjusters */}
          <div className="flex items-center bg-stone-900 border border-stone-800 text-xs">
            <button
              onClick={() => setFontSize(Math.max(13, fontSize - 1))}
              className="px-2 py-1 text-stone-300 hover:text-white font-bold border-r border-stone-800"
              title="Diminuir fonte"
            >
              A-
            </button>
            <span className="px-1.5 text-[10px] text-stone-400 font-mono">{fontSize}px</span>
            <button
              onClick={() => setFontSize(Math.min(26, fontSize + 1))}
              className="px-2 py-1 text-stone-300 hover:text-white font-bold border-l border-stone-800"
              title="Aumentar fonte"
            >
              A+
            </button>
          </div>

          {/* Theme Selector */}
          <div className="hidden sm:flex items-center space-x-1 bg-stone-900 p-1 border border-stone-800">
            <button
              onClick={() => setPaperTheme('sepia')}
              className={`w-5 h-5 bg-[#FDFCFB] border ${paperTheme === 'sepia' ? 'ring-2 ring-amber-400' : ''}`}
              title="Papel Creme Editorial"
            />
            <button
              onClick={() => setPaperTheme('white')}
              className={`w-5 h-5 bg-white border ${paperTheme === 'white' ? 'ring-2 ring-amber-400' : ''}`}
              title="Papel Branco"
            />
            <button
              onClick={() => setPaperTheme('dark')}
              className={`w-5 h-5 bg-[#1C1917] border border-stone-700 ${paperTheme === 'dark' ? 'ring-2 ring-amber-400' : ''}`}
              title="Modo Escuro"
            />
          </div>

          <select
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value as any)}
            className="hidden sm:block bg-stone-900 border border-stone-800 text-xs px-2 py-1 text-stone-200 uppercase tracking-wider"
          >
            <option value="serif">Serifada (Classic Editorial)</option>
            <option value="sans">Sans (Clean)</option>
            <option value="mono">Mono (Code)</option>
          </select>

          <button
            onClick={onClose}
            className="p-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition border border-stone-700"
            title="Fechar leitor (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Reader Content */}
      <div className="flex-1 overflow-hidden relative flex">
        {showToc && (
          <aside className="absolute sm:relative inset-y-0 left-0 w-72 sm:w-80 bg-[#1C1917] border-r border-stone-800 p-4 overflow-y-auto space-y-2 z-30 shadow-2xl shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] uppercase tracking-[0.2em] font-semibold text-stone-400">
                Sumário Canônico Completo
              </h3>
              <button
                onClick={() => setShowToc(false)}
                className="text-stone-400 hover:text-white text-xs p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {sequence.map((sec, idx) => (
              <button
                key={sec.id}
                onClick={() => {
                  setCurrentIndex(idx);
                  setShowToc(false);
                }}
                className={`w-full text-left p-3 text-xs transition border ${
                  currentIndex === idx
                    ? 'bg-amber-400 text-[#1C1917] font-bold border-amber-500'
                    : 'text-stone-300 hover:bg-stone-800 border-stone-800/50'
                }`}
              >
                {sec.title}
              </button>
            ))}
          </aside>
        )}

        <main
          ref={readerScrollRef}
          className="flex-1 overflow-y-auto p-3 sm:p-8 md:p-12 flex justify-center items-start bg-stone-950/80"
        >
          <div
            className={`w-full max-w-2xl my-2 sm:my-6 p-4 sm:p-12 md:p-14 border shadow-2xl transition-all flex flex-col justify-between ${
              themeClasses[paperTheme]
            } ${fontClasses[fontFamily]}`}
            style={{ fontSize: `${fontSize}px`, lineHeight: 1.75 }}
          >
            <div>
              <div className="text-center pb-6 border-b border-current/20 mb-6 space-y-2">
                <h1 className="text-2xl sm:text-3xl font-serif italic font-bold leading-tight">
                  {currentSection.title}
                </h1>
                {currentSection.subtitle && (
                  <p className="text-xs italic opacity-80">{currentSection.subtitle}</p>
                )}
              </div>

              <div className="space-y-2">{renderFormattedContent(currentSection.content)}</div>
            </div>

            <div className="pt-8 mt-10 border-t border-current/15 text-center opacity-60 text-xs font-serif italic truncate max-w-full px-2">
              {project.metadata.titulo} • Omnia Publish AI
            </div>
          </div>
        </main>
      </div>

      {/* Footer Navigation */}
      <footer className="bg-[#1C1917] border-t border-stone-800 px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between text-stone-300 text-xs shrink-0">
        <button
          onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
          className="flex items-center space-x-1 px-3 sm:px-4 py-2 bg-stone-800 hover:bg-stone-700 disabled:opacity-30 transition uppercase tracking-wider text-[10px] font-bold border border-stone-700"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Anterior</span>
        </button>

        <span className="font-serif italic text-xs text-stone-300">
          {currentIndex + 1} de {sequence.length} ({currentSection.title})
        </span>

        <button
          onClick={() => setCurrentIndex(Math.min(sequence.length - 1, currentIndex + 1))}
          disabled={currentIndex === sequence.length - 1}
          className="flex items-center space-x-1 px-3 sm:px-4 py-2 bg-stone-800 hover:bg-stone-700 disabled:opacity-30 transition uppercase tracking-wider text-[10px] font-bold border border-stone-700"
        >
          <span>Próxima</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </footer>
    </div>
  );
};
