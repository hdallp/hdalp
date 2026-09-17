/**
 * EmojiCloud Effect Lab — Gradient Engine (Photoshop-Style Gradient Map)
 * Adaptado para interpolação RGB/LAB pura sem dependência externa.
 */
class GradientEngine {
  constructor() {
    this.colorStops = [];
    this.selectedColorStop = null;
    this._nextId = 100;
    this.setPreset('purple-white');
  }

  setPreset(name) {
    if (name === 'purple-white') {
      this.colorStops = [
        { id: 1, location: 0,    color: '#3800e6' },
        { id: 2, location: 0.55, color: '#e879f9' },
        { id: 3, location: 1.0,  color: '#ffffff' },
      ];
    } else if (name === 'blue-yellow') {
      this.colorStops = [
        { id: 1, location: 0,    color: '#0033ff' },
        { id: 2, location: 0.45, color: '#00e5ff' },
        { id: 3, location: 1.0,  color: '#ffe600' },
      ];
    } else if (name === 'rainbow') {
      this.colorStops = [
        { id: 1, location: 0,    color: '#3b00e3' },
        { id: 2, location: 0.25, color: '#00d2ff' },
        { id: 3, location: 0.5,  color: '#10b981' },
        { id: 4, location: 0.75, color: '#facc15' },
        { id: 5, location: 1.0,  color: '#ef4444' },
      ];
    } else if (name === 'sunset') {
      this.colorStops = [
        { id: 1, location: 0,    color: '#2e0854' },
        { id: 2, location: 0.35, color: '#991b1b' },
        { id: 3, location: 0.70, color: '#ea580c' },
        { id: 4, location: 1.0,  color: '#fde047' },
      ];
    } else if (name === 'emerald') {
      this.colorStops = [
        { id: 1, location: 0,    color: '#022c22' },
        { id: 2, location: 0.40, color: '#059669' },
        { id: 3, location: 0.75, color: '#34d399' },
        { id: 4, location: 1.0,  color: '#a7f3d0' },
      ];
    } else if (name === 'monochrome') {
      this.colorStops = [
        { id: 1, location: 0,    color: '#0f172a' },
        { id: 2, location: 0.50, color: '#64748b' },
        { id: 3, location: 1.0,  color: '#f8fafc' },
      ];
    } else if (name === 'pastel') {
      this.colorStops = [
        { id: 1, location: 0,    color: '#4338ca' },
        { id: 2, location: 0.50, color: '#f43f5e' },
        { id: 3, location: 1.0,  color: '#fbbf24' },
      ];
    } else if (name === 'fire') {
      this.colorStops = [
        { id: 1, location: 0,    color: '#450a0a' },
        { id: 2, location: 0.45, color: '#dc2626' },
        { id: 3, location: 0.80, color: '#f97316' },
        { id: 4, location: 1.0,  color: '#ffffff' },
      ];
    } else if (name === 'aurora') {
      this.colorStops = [
        { id: 1, location: 0,    color: '#0b132b' },
        { id: 2, location: 0.35, color: '#00f5d4' },
        { id: 3, location: 0.70, color: '#70e000' },
        { id: 4, location: 1.0,  color: '#ffffff' },
      ];
    } else if (name === 'tokyo-night') {
      this.colorStops = [
        { id: 1, location: 0,    color: '#1a103c' },
        { id: 2, location: 0.50, color: '#e024c3' },
        { id: 3, location: 1.0,  color: '#00e5ff' },
      ];
    } else if (name === 'deep-ocean') {
      this.colorStops = [
        { id: 1, location: 0,    color: '#03071e' },
        { id: 2, location: 0.40, color: '#0077b6' },
        { id: 3, location: 0.75, color: '#48cae4' },
        { id: 4, location: 1.0,  color: '#caf0f8' },
      ];
    } else if (name === 'golden-hour') {
      this.colorStops = [
        { id: 1, location: 0,    color: '#4a2810' },
        { id: 2, location: 0.35, color: '#d97706' },
        { id: 3, location: 0.75, color: '#fbbf24' },
        { id: 4, location: 1.0,  color: '#fef3c7' },
      ];
    } else if (name === 'hyper-acid') {
      this.colorStops = [
        { id: 1, location: 0,    color: '#0f291e' },
        { id: 2, location: 0.50, color: '#a3e635' },
        { id: 3, location: 1.0,  color: '#fde047' },
      ];
    } else if (name === 'cherry-blossom') {
      this.colorStops = [
        { id: 1, location: 0,    color: '#380424' },
        { id: 2, location: 0.40, color: '#f43f5e' },
        { id: 3, location: 0.75, color: '#fbcfe8' },
        { id: 4, location: 1.0,  color: '#ffffff' },
      ];
    } else if (name === 'quantum-noir') {
      this.colorStops = [
        { id: 1, location: 0,    color: '#050508' },
        { id: 2, location: 0.40, color: '#27272a' },
        { id: 3, location: 0.75, color: '#00f2fe' },
        { id: 4, location: 1.0,  color: '#f4f4f5' },
      ];
    }
    this.selectedColorStop = this.colorStops[0];
  }

  static getPresets() {
    return [
      { id: 'purple-white',    name: 'Roxo Neon',       stops: '#3800e6 0%, #e879f9 55%, #ffffff 100%' },
      { id: 'blue-yellow',     name: 'Cyberpunk',       stops: '#0033ff 0%, #00e5ff 45%, #ffe600 100%' },
      { id: 'aurora',          name: 'Aurora Boreal',   stops: '#0b132b 0%, #00f5d4 35%, #70e000 70%, #ffffff 100%' },
      { id: 'tokyo-night',     name: 'Tokyo Night',     stops: '#1a103c 0%, #e024c3 50%, #00e5ff 100%' },
      { id: 'deep-ocean',      name: 'Deep Ocean',      stops: '#03071e 0%, #0077b6 40%, #48cae4 75%, #caf0f8 100%' },
      { id: 'sunset',          name: 'Sunset Heat',     stops: '#2e0854 0%, #991b1b 35%, #ea580c 70%, #fde047 100%' },
      { id: 'golden-hour',     name: 'Golden Hour',     stops: '#4a2810 0%, #d97706 35%, #fbbf24 75%, #fef3c7 100%' },
      { id: 'emerald',         name: 'Neon Emerald',    stops: '#022c22 0%, #059669 40%, #34d399 75%, #a7f3d0 100%' },
      { id: 'hyper-acid',      name: 'Acid Lime',       stops: '#0f291e 0%, #a3e635 50%, #fde047 100%' },
      { id: 'cherry-blossom',  name: 'Cherry Blossom',  stops: '#380424 0%, #f43f5e 40%, #fbcfe8 75%, #ffffff 100%' },
      { id: 'quantum-noir',    name: 'Quantum Noir',    stops: '#050508 0%, #27272a 40%, #00f2fe 75%, #f4f4f5 100%' },
      { id: 'rainbow',         name: 'Heat Spectrum',   stops: '#3b00e3 0%, #00d2ff 25%, #10b981 50%, #facc15 75%, #ef4444 100%' },
      { id: 'pastel',          name: 'Vapor Wave',      stops: '#4338ca 0%, #f43f5e 50%, #fbbf24 100%' },
      { id: 'fire',            name: 'Solar Flare',     stops: '#450a0a 0%, #dc2626 45%, #f97316 80%, #ffffff 100%' },
      { id: 'monochrome',      name: 'Dark Metal',      stops: '#0f172a 0%, #64748b 50%, #f8fafc 100%' },
    ];
  }

  addColorStop(location, color) {
    const stop = { id: this._nextId++, location: Math.max(0, Math.min(1, location)), color };
    this.colorStops.push(stop);
    this.colorStops.sort((a, b) => a.location - b.location);
    this.selectedColorStop = stop;
    return stop;
  }

  removeColorStop(id) {
    if (this.colorStops.length <= 2) return;
    this.colorStops = this.colorStops.filter(s => s.id !== id);
    this.selectedColorStop = this.colorStops[0];
  }

  reverseGradient() {
    this.colorStops = this.colorStops.map(s => ({
      ...s,
      location: Math.round((1 - s.location) * 1000) / 1000
    })).sort((a, b) => a.location - b.location);
  }

  /** Retorna RGB [r, g, b] (0..255) na posição t ∈ [0, 1] */
  getColorAt(t) {
    t = Math.max(0, Math.min(1, t));
    const stops = [...this.colorStops].sort((a, b) => a.location - b.location);
    if (!stops.length) return [85, 0, 204];

    const parseHex = (hex) => {
      let c = (hex || '#000000').replace('#', '').trim();
      if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
      const num = parseInt(c, 16) || 0;
      return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
    };

    if (t <= stops[0].location) return parseHex(stops[0].color);
    if (t >= stops[stops.length - 1].location) return parseHex(stops[stops.length - 1].color);

    for (let i = 0; i < stops.length - 1; i++) {
      const s0 = stops[i], s1 = stops[i + 1];
      if (t >= s0.location && t <= s1.location) {
        const range = Math.max(1e-6, s1.location - s0.location);
        const f = (t - s0.location) / range;
        const c0 = parseHex(s0.color);
        const c1 = parseHex(s1.color);
        return [
          Math.round(c0[0] + (c1[0] - c0[0]) * f),
          Math.round(c0[1] + (c1[1] - c0[1]) * f),
          Math.round(c0[2] + (c1[2] - c0[2]) * f)
        ];
      }
    }
    return parseHex(stops[0].color);
  }

  /** Retorna Hex string na posição t ∈ [0, 1] */
  getHexAt(t) {
    const [r, g, b] = this.getColorAt(t);
    return '#' + [r, g, b].map(x => {
      const h = Math.max(0, Math.min(255, x)).toString(16);
      return h.length === 1 ? '0' + h : h;
    }).join('').toUpperCase();
  }

  /** String CSS linear-gradient para preview e elementos de UI */
  getCssGradient() {
    const sorted = [...this.colorStops].sort((a, b) => a.location - b.location);
    return `linear-gradient(90deg, ${sorted.map(s => `${s.color} ${Math.round(s.location * 100)}%`).join(', ')})`;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GradientEngine;
}
