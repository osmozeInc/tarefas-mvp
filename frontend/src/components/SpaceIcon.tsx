import React from 'react';
import {
  Folder,
  Rocket,
  GraduationCap,
  Heart,
  User,
  Briefcase,
  Zap,
  Target,
  BookOpen,
  Wrench,
  Code,
  Globe,
  Layers,
  Star,
  Bookmark,
  Terminal,
  Cpu,
  Compass,
  Award,
  Shield,
} from 'lucide-react';

export const SPACE_ICON_OPTIONS = [
  { id: 'folder', icon: Folder, label: 'Pasta' },
  { id: 'rocket', icon: Rocket, label: 'Foguete' },
  { id: 'graduation', icon: GraduationCap, label: 'Estudos' },
  { id: 'heart', icon: Heart, label: 'Coração' },
  { id: 'user', icon: User, label: 'Pessoal' },
  { id: 'briefcase', icon: Briefcase, label: 'Trabalho' },
  { id: 'zap', icon: Zap, label: 'Energia' },
  { id: 'target', icon: Target, label: 'Meta' },
  { id: 'book', icon: BookOpen, label: 'Leitura' },
  { id: 'wrench', icon: Wrench, label: 'Ferramenta' },
  { id: 'code', icon: Code, label: 'Código' },
  { id: 'terminal', icon: Terminal, label: 'Terminal' },
  { id: 'cpu', icon: Cpu, label: 'Sistema' },
  { id: 'globe', icon: Globe, label: 'Global' },
  { id: 'layers', icon: Layers, label: 'Camadas' },
  { id: 'compass', icon: Compass, label: 'Direção' },
  { id: 'star', icon: Star, label: 'Destaque' },
  { id: 'bookmark', icon: Bookmark, label: 'Salvo' },
  { id: 'award', icon: Award, label: 'Conquista' },
  { id: 'shield', icon: Shield, label: 'Segurança' },
];

export function normalizeIconKey(raw?: string | null): string {
  if (!raw) return 'folder';
  return SPACE_ICON_OPTIONS.some((o) => o.id === raw) ? raw : 'folder';
}

export const SpaceIcon: React.FC<{ icon?: string | null; className?: string }> = ({
  icon,
  className = 'h-4 w-4',
}) => {
  const found = SPACE_ICON_OPTIONS.find((o) => o.id === icon);
  const IconComponent = found ? found.icon : Folder;
  return <IconComponent className={className} />;
};