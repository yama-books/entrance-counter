// 初期配色はユーザー承認の「アイボリーと赤煉瓦」。ほか4案は共通デザインライブラリ COL-0001を元にした候補。
export const themes = [
  { id: 'ivory-brick', no: '', name: 'アイボリーと赤煉瓦', note: '明るいアイボリー、若草と煉瓦色', colors: ['#FFF9ED', '#FFFEFA', '#78968A', '#B85E4E', '#59453E'] },
  { id: 'nordic-lake', no: '029', name: '北欧レイク', note: '静かな湖の青と淡いピンク', colors: ['#EFF4F3', '#C8D9DB', '#88ADB8', '#527F91', '#284957'] },
  { id: 'sakura-milk', no: '001', name: '桜ミルク', note: '淡い桜色と若草', colors: ['#FFF7F5', '#F4CCD2', '#E6A6B3', '#C9D7C4', '#695B64'] },
  { id: 'pink-lemonade', no: '067', name: 'ピンクレモネード', note: '明るく軽い甘さ', colors: ['#FFF8E5', '#F9E08E', '#F7BBC4', '#EC7C9E', '#A44E78'] },
  { id: 'melon-float', no: '056', name: 'メロンフロート', note: '緑とクリーム、さくらんぼ色', colors: ['#FFF8DB', '#D7EE8C', '#8ED16C', '#46A97B', '#EF7F8F'] },
];
export const themeKey = 'entrance-counter-theme';
export const defaultTheme = themes[0].id;
export function savedTheme() {
  try { const id = localStorage.getItem(themeKey); return themes.some(t => t.id === id) ? id : defaultTheme; } catch { return defaultTheme; }
}
export function applyTheme(id) {
  const theme = themes.find(t => t.id === id) || themes[0];
  document.documentElement.dataset.theme = theme.id;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.colors[0]);
  return theme.id;
}
