// Valor de referência customizado padrão (inref global)
export const INREF = '-----';

// Configuração dos Splats disponíveis no viewer
export const SPLATS = [
  {
    id: 'Painel-Dec',
    title: 'Painel Dec(1.9Mi)',
    file: 'https://github.com/hdallp/hdalp/releases/download/v0.1/painel-dec.sog',
    description: 'Painel Dec 10',
    settings: {
      camera: {
        position: [0, 0, 1.8],
        target: [0, 0, 0],
        fov: 60
      }
    }
  },
  {
    id: 'Painel',
    title: 'Painel (2.9Mi)',
    file: 'https://github.com/hdallp/hdalp/releases/download/v0.1/painel.sog',
    description: 'Painel',
    settings: {
      camera: {
        position: [0, 0, 1.8],
        target: [0, 0, 0],
        fov: 60
      }
    }
  },
  {
    id: 'PainelVeu-Dec',
    title: 'Painel com Veu Dec(3.9Mi)',
    file: 'https://github.com/hdallp/hdalp/releases/download/v0.1/painelVeu-dec.sog',
    description: 'Painel',
    settings: {
      camera: {
        position: [0, 0, 1.8],
        target: [0, 0, 0],
        fov: 60
      }
    }
  },
  {
    id: 'head',
    title: 'Archive',
    file: './files/head.sog',
    locked: true,
    passwordHash: '395d8c817d4e9577d849ac5fd592652df94f34e439101cd7b079f3680331169a', // SHA-256 de "781975"
    description: 'head.sog',
    settings: {
      camera: {
        position: [0, 0, 1.8],
        target: [0, 0, 0],
        fov: 60
      }
    }
  },
  {
    id: 'emoji_facing_camera--LAB',
    title: 'Archive',
    file: 'https://github.com/hdallp/hdalp/releases/download/v0.1/emoji_facing_camera--LAB.sog',
    locked: true,
    passwordHash: '395d8c817d4e9577d849ac5fd592652df94f34e439101cd7b079f3680331169a', // SHA-256 de "781975"
    description: 'emoji_facing_camera--LAB',
    settings: {
      camera: {
        position: [0, 0, 1.8],
        target: [0, 0, 0],
        fov: 60
      }
    }
  }
];

export const DEFAULT_SPLAT_ID = 'Painel-Dec';
