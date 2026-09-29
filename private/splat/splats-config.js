// Valor de referência customizado padrão (inref global)
export const INREF = '-----';

// Configuração dos Splats disponíveis no viewer
export const SPLATS = [
  {
    id: 'Painel-Dec',
    title: 'Painel Dec(1.9Mi)',
    file: './files/painel-dec.sog',
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
    file: './files/painel.sog',
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
    id: 'PainelVeu',
    title: 'Painel com Veu (5.7Mi)',
    file: './files/painelVeu.sog',
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
    file: './files/painelVeu-dec.sog',
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
    file: './files/head.sog', // Altere para o novo arquivo .sog/.ply quando adicionar
    locked: true,             // Splat bloqueado com senha
    passwordHash: '395d8c817d4e9577d849ac5fd592652df94f34e439101cd7b079f3680331169a', // SHA-256
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
    file: './files/emoji_facing_camera--LAB.sog', // Altere para o novo arquivo .sog/.ply quando adicionar
    locked: true,             // Splat bloqueado com senha
    passwordHash: '395d8c817d4e9577d849ac5fd592652df94f34e439101cd7b079f3680331169a', // SHA-256
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
